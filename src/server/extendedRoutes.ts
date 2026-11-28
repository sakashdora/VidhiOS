import type express from 'express';
import { z } from 'zod';
import { isUserAdminRole, requireAuth, type AuthRequest } from './auth.js';
import { executeMultiAgentWorkflow } from './agentOrchestrator.js';
import { isCorporateProviderConfigured, lookupCorporateEntity } from './corporateService.js';
import { getNvidiaConfig } from './nvidiaService.js';
import { isGeminiConfigured } from './geminiService.js';
import { getNeonHealthSnapshot, isNeonConfigured, testNeonConnection } from './neonDatabase.js';
import {
  buildMatterKnowledgeGraph,
  generateLitigationStrategy,
  SUPPORTED_TRANSLATION_LANGUAGES,
  translateLegalContent,
} from './intelligenceService.js';
import { detectPrecedentConflicts } from './realtimeLegalSearch.js';
import { repository } from './repository.js';
import type { SubscriptionTier } from '../types/legal.js';

function errMsg(err: unknown): string {
  if (err instanceof z.ZodError) {
    return err.issues.map((i) => `${i.path.join('.') || 'input'}: ${i.message}`).join('; ');
  }
  if (err instanceof Error) return err.message;
  return 'Unexpected server error';
}

export interface ApiMetricsSnapshot {
  totalRequests: number;
  errorCount: number;
  aiRequestCount: number;
  aiFailureCount: number;
  avgLatencyMs: number;
  startedAt: string;
}

export function registerExtendedRoutes(
  app: express.Express,
  metrics: ApiMetricsSnapshot
): void {
  const requireAdmin = (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
    requireAuth(req, res, async () => {
      const user = await repository.getUserById(req.authUser!.userId);
      if (!user || !isUserAdminRole(user)) {
        repository.logAuditEvent({
          organizationId: user?.organizationId || '',
          userId: req.authUser!.userId,
          actorEmail: req.authUser!.email,
          eventType: 'admin_access_denied',
          resourceType: 'admin',
          status: 'denied',
          details: `Unauthorized admin route access attempted: ${req.path}`,
        });
        await repository.persist().catch(() => {});
        res.status(403).json({ error: 'Access denied: Administrator privileges required.' });
        return;
      }
      next();
    });
  };

  // --- Matter Update ---
  app.patch('/api/matters/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        title: z.string().min(3).max(200).optional(),
        status: z.enum(['active', 'pending_hearing', 'in_review', 'closed']).optional(),
        forum: z.string().min(2).max(200).optional(),
        opposingParty: z.string().max(160).optional(),
        clientName: z.string().min(2).max(160).optional(),
        summaryFacts: z.string().max(6000).optional(),
        cnrNumber: z.string().max(80).optional(),
        caseType: z.string().max(100).optional(),
        assignedAdvocate: z.string().max(160).optional(),
        filingDate: z.string().max(30).optional(),
      });
      const data = schema.parse(req.body);
      const updated = repository.updateMatter(req.authUser!.userId, String(req.params.id), data);
      if (!updated) {
        res.status(404).json({ error: 'Matter not found or permission denied.' });
        return;
      }
      await repository.persist();
      res.json(updated);
    } catch (err) {
      res.status(400).json({ error: errMsg(err) });
    }
  });

  // --- Clients ---
  app.post('/api/clients', requireAuth, async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        name: z.string().min(2).max(160),
        email: z.string().email().or(z.literal('')).default(''),
        phone: z.string().max(40).default(''),
        company: z.string().max(160).default(''),
        address: z.string().max(300).default(''),
        panOrCin: z.string().max(40).optional(),
        notes: z.string().max(2000).default(''),
        portalAccessEnabled: z.boolean().default(false),
      });
      const data = schema.parse(req.body);
      const user = await repository.getUserById(req.authUser!.userId);
      if (!user || user.orgRole === 'client') {
        res.status(403).json({ error: 'Permission denied to create client profiles.' });
        return;
      }
      const client = repository.addClient({
        ...data,
        organizationId: user.organizationId || '',
        userId: user.id,
      });
      await repository.persist();
      res.status(201).json(client);
    } catch (err) {
      res.status(400).json({ error: errMsg(err) });
    }
  });

  // --- Matter Tasks ---
  app.post('/api/tasks', requireAuth, async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        matterId: z.string().min(1),
        title: z.string().min(2).max(200),
        priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
        dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        assignedToName: z.string().max(120).optional(),
      });
      const data = schema.parse(req.body);
      const matter = repository.getMatterForUser(req.authUser!.userId, data.matterId, true);
      if (!matter) {
        res.status(404).json({ error: 'Matter not found or write access denied.' });
        return;
      }
      const user = await repository.getUserById(req.authUser!.userId);
      const task = repository.addTask({
        organizationId: user?.organizationId || matter.organizationId || '',
        matterId: matter.id,
        userId: req.authUser!.userId,
        assignedToUserId: req.authUser!.userId,
        assignedToName: data.assignedToName || user?.fullName || 'Counsel',
        title: data.title,
        priority: data.priority,
        status: 'todo',
        dueDate: data.dueDate,
      });
      await repository.persist();
      res.status(201).json(task);
    } catch (err) {
      res.status(400).json({ error: errMsg(err) });
    }
  });

  app.patch('/api/tasks/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        status: z.enum(['todo', 'in_progress', 'review', 'done']),
      });
      const { status } = schema.parse(req.body);
      const updated = repository.updateTaskStatus(req.authUser!.userId, String(req.params.id), status);
      if (!updated) {
        res.status(404).json({ error: 'Task not found or permission denied.' });
        return;
      }
      await repository.persist();
      res.json(updated);
    } catch (err) {
      res.status(400).json({ error: errMsg(err) });
    }
  });

  // --- Hearing History & Cause List Log ---
  app.post('/api/hearings', requireAuth, async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        matterId: z.string().min(1),
        hearingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        court: z.string().min(2).max(200),
        courtroom: z.string().max(80).default(''),
        bench: z.string().max(160).default(''),
        causeListItem: z.string().max(80).default(''),
        outcome: z.enum([
          'scheduled',
          'heard',
          'adjourned',
          'part_heard',
          'order_reserved',
          'disposed',
        ]),
        nextHearingDate: z.string().optional(),
        adjournmentReason: z.string().max(400).optional(),
        notes: z.string().max(2000).default(''),
      });
      const data = schema.parse(req.body);
      const matter = repository.getMatterForUser(req.authUser!.userId, data.matterId, true);
      if (!matter) {
        res.status(404).json({ error: 'Matter not found.' });
        return;
      }
      const user = await repository.getUserById(req.authUser!.userId);
      const hearing = repository.addHearing({
        ...data,
        organizationId: user?.organizationId || matter.organizationId || '',
        userId: req.authUser!.userId,
      });
      await repository.persist();
      res.status(201).json(hearing);
    } catch (err) {
      res.status(400).json({ error: errMsg(err) });
    }
  });

  // --- Vault Document Human Correction & Status ---
  app.patch('/api/vault/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        extractedText: z.string().max(120000).optional(),
        translatedText: z.string().max(120000).optional(),
        chronology: z
          .array(
            z.object({
              date: z.string(),
              event: z.string(),
              sourceDoc: z.string(),
              pageOrPara: z.string().optional(),
              significance: z.string(),
              userCorrected: z.boolean().optional(),
            })
          )
          .optional(),
        processingStatus: z
          .enum(['uploaded', 'queued', 'processing', 'review_required', 'completed', 'failed'])
          .optional(),
      });
      const data = schema.parse(req.body);
      const updated = repository.updateVaultDocument(
        req.authUser!.userId,
        String(req.params.id),
        data
      );
      if (!updated) {
        res.status(404).json({ error: 'Vault document not found.' });
        return;
      }
      await repository.persist();
      res.json(updated);
    } catch (err) {
      res.status(400).json({ error: errMsg(err) });
    }
  });

  // --- Multi-Agent Legal AI Orchestrator ---
  app.post('/api/ai/workflows/run', requireAuth, async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        matterId: z.string().nullable().optional(),
        workflowType: z.enum([
          'full_matter_brief',
          'research_verification',
          'draft_audit',
          'contract_risk_audit',
          'compliance_deadline_check',
        ]),
        goal: z.string().min(5).max(3000),
        extraContext: z.string().max(12000).optional(),
      });
      const data = schema.parse(req.body);
      const userId = req.authUser!.userId;
      const quota = repository.checkAiQuota(userId);
      if (!quota.allowed) {
        res.status(402).json({ error: quota.reason });
        return;
      }

      const user = await repository.getUserById(userId);
      const matter = data.matterId
        ? repository.getMatterForUser(userId, data.matterId) ?? null
        : null;
      if (data.matterId && !matter) {
        res.status(404).json({ error: 'Matter not found.' });
        return;
      }

      const runData = await executeMultiAgentWorkflow({
        organizationId: user?.organizationId || '',
        userId,
        matter,
        jurisdiction: matter?.jurisdiction ?? user?.defaultJurisdiction ?? 'india_litigation',
        workflowType: data.workflowType,
        goal: data.goal,
        extraContext: data.extraContext,
      });

      const savedRun = repository.addWorkflowRun(runData);
      repository.recordAiUsage(userId, savedRun.totalTokens);
      await repository.persist();
      res.status(201).json(savedRun);
    } catch (err) {
      res.status(500).json({ error: errMsg(err) });
    }
  });

  app.post('/api/ai/workflows/:id/approve', requireAuth, async (req: AuthRequest, res) => {
    const approved = repository.approveWorkflowRun(req.authUser!.userId, String(req.params.id));
    if (!approved) {
      res.status(404).json({ error: 'Workflow run not found.' });
      return;
    }
    await repository.persist();
    res.json(approved);
  });

  // --- Legal Translation Studio (10 Indian Languages) ---
  app.post('/api/ai/translate', requireAuth, async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        sourceText: z.string().min(3).max(20000),
        sourceLanguage: z.string().max(40).default('English'),
        targetLanguage: z.enum(SUPPORTED_TRANSLATION_LANGUAGES),
        jurisdiction: z
          .enum(['india_litigation', 'corporate_ma', 'global_multi'])
          .default('india_litigation'),
      });
      const data = schema.parse(req.body);
      const quota = repository.checkAiQuota(req.authUser!.userId);
      if (!quota.allowed) {
        res.status(402).json({ error: quota.reason });
        return;
      }
      const result = await translateLegalContent(data);
      repository.recordAiUsage(req.authUser!.userId, Math.ceil(data.sourceText.length / 3));
      await repository.persist();
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: errMsg(err) });
    }
  });

  // --- Corporate Intelligence & MCA Lookup ---
  app.post('/api/corporate/lookup', requireAuth, async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        query: z.string().min(2).max(160),
        matterId: z.string().optional(),
      });
      const data = schema.parse(req.body);
      const user = await repository.getUserById(req.authUser!.userId);
      if (!user) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }
      const profileData = await lookupCorporateEntity({
        query: data.query,
        organizationId: user.organizationId || '',
        userId: user.id,
        matterId: data.matterId,
      });
      const saved = repository.addCorporateProfile(profileData);
      await repository.persist();
      res.status(201).json({
        profile: saved,
        providerConfigured: isCorporateProviderConfigured(),
      });
    } catch (err) {
      res.status(500).json({ error: errMsg(err) });
    }
  });

  // --- Legal Knowledge Graph, Precedent Conflicts, Strategy & Evidence ---
  app.get('/api/intelligence/graph', requireAuth, async (req: AuthRequest, res) => {
    const matterId = String(req.query.matterId || '');
    const bundle = await repository.getWorkspaceBundle(req.authUser!.userId);
    if (!bundle) {
      res.status(404).json({ error: 'Workspace not found.' });
      return;
    }
    const matter =
      (matterId ? bundle.matters.find((m) => m.id === matterId) : bundle.matters[0]) ?? null;
    const memos = bundle.researchMemos.filter((m) => !matter || m.matterId === matter.id);
    const docs = bundle.vaultDocuments.filter((d) => !matter || d.matterId === matter.id);
    const graph = buildMatterKnowledgeGraph({ matter, memos, vaultDocuments: docs });
    const conflicts = matter
      ? detectPrecedentConflicts(`${matter.title} ${matter.summaryFacts}`, matter.jurisdiction)
      : [];
    res.json({ graph, conflicts });
  });

  app.post('/api/intelligence/strategy', requireAuth, async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        matterId: z.string().min(1),
      });
      const { matterId } = schema.parse(req.body);
      const userId = req.authUser!.userId;
      const matter = repository.getMatterForUser(userId, matterId, true);
      if (!matter) {
        res.status(404).json({ error: 'Matter not found.' });
        return;
      }
      const user = await repository.getUserById(userId);
      const strategyData = await generateLitigationStrategy({
        matter,
        organizationId: user?.organizationId || matter.organizationId || '',
        userId,
      });
      const saved = repository.upsertLitigationStrategy(strategyData);
      await repository.persist();
      res.status(201).json(saved);
    } catch (err) {
      res.status(500).json({ error: errMsg(err) });
    }
  });

  app.post('/api/intelligence/evidence', requireAuth, async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        matterId: z.string().min(1),
        exhibitNumber: z.string().min(1).max(40),
        title: z.string().min(2).max(200),
        sourceDocumentId: z.string().optional(),
        witnessName: z.string().max(160).optional(),
        admissibilityStatus: z.enum([
          'verified_63_bsa',
          'primary_original',
          'requires_certificate',
          'contested',
        ]),
        notes: z.string().max(2000).default(''),
      });
      const data = schema.parse(req.body);
      const matter = repository.getMatterForUser(req.authUser!.userId, data.matterId, true);
      if (!matter) {
        res.status(404).json({ error: 'Matter not found.' });
        return;
      }
      const user = await repository.getUserById(req.authUser!.userId);
      const created = repository.addEvidenceItem({
        ...data,
        organizationId: user?.organizationId || matter.organizationId || '',
        userId: req.authUser!.userId,
      });
      await repository.persist();
      res.status(201).json(created);
    } catch (err) {
      res.status(400).json({ error: errMsg(err) });
    }
  });

  // --- Notifications ---
  app.patch('/api/notifications/:id/read', requireAuth, async (req: AuthRequest, res) => {
    const updated = repository.markNotificationRead(req.authUser!.userId, String(req.params.id));
    if (!updated) {
      res.status(404).json({ error: 'Notification not found.' });
      return;
    }
    await repository.persist();
    res.json(updated);
  });

  // --- Subscriptions ---
  app.post('/api/subscription/upgrade', requireAuth, async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        tier: z.enum(['FREE', 'PRO', 'CHAMBERS', 'ENTERPRISE']),
      });
      const { tier } = schema.parse(req.body);
      const user = await repository.getUserById(req.authUser!.userId);
      if (!user?.organizationId) {
        res.status(400).json({ error: 'Organization context missing.' });
        return;
      }
      if (user.orgRole !== 'owner' && user.orgRole !== 'admin' && !isUserAdminRole(user)) {
        res.status(403).json({ error: 'Only organization owners or administrators can change plans.' });
        return;
      }
      const sub = await repository.updateSubscriptionTier(user.organizationId, tier);
      res.json({
        subscription: sub,
        billingNote: 'Plan tier updated in development/sandbox mode. Connect payment provider for live billing.',
      });
    } catch (err) {
      res.status(400).json({ error: errMsg(err) });
    }
  });

  // --- Admin Monitoring & Governance ---
  app.get('/api/admin/overview', requireAdmin, async (_req: AuthRequest, res) => {
    const nv = getNvidiaConfig();
    const neonCheck = isNeonConfigured() ? await testNeonConnection() : null;
    res.json({
      organizations: repository.getAllOrganizations(),
      auditEvents: repository.getAuditEvents(),
      counts: repository.getSystemCounts(),
      metrics,
      health: {
        storageEngine: repository.engine,
        neon: neonCheck,
        neonSync: getNeonHealthSnapshot(),
        lastPersistError: repository.lastPersistError,
        aiEngine: {
          nvidiaConfigured: nv.configured,
          geminiConfigured: isGeminiConfigured(),
          primaryModel: nv.primaryModel,
          fastModel: nv.fastModel,
        },
        corporateProviderConfigured: isCorporateProviderConfigured(),
      },
    });
  });

  app.post('/api/admin/organizations/:orgId/subscription', requireAdmin, async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        tier: z.enum(['FREE', 'PRO', 'CHAMBERS', 'ENTERPRISE']),
      });
      const { tier } = schema.parse(req.body);
      const sub = await repository.updateSubscriptionTier(
        String(req.params.orgId),
        tier as SubscriptionTier
      );
      res.json({ subscription: sub });
    } catch (err) {
      res.status(400).json({ error: errMsg(err) });
    }
  });
}
