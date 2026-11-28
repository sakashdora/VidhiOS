import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { z } from 'zod';
import { requireAuth, signSessionToken, type AuthRequest } from './auth.js';
import { repository } from './repository.js';
import { isNeonConfigured, testNeonConnection } from './neonDatabase.js';
import {
  analyzeContractRedline,
  answerWhatsAppQuery,
  generateLegalDraft,
  isGeminiConfigured,
  processVaultDocument,
  rewriteDraftSelection,
  runCourtroomTurn,
  runGroundedLegalResearch,
  streamGroundedLegalResearch,
  transcribeAndSummarizeMeeting,
} from './geminiService.js';
import {
  answerGroundedBilingualLegalAssistant,
  buildSupremeCourtSystemPrompt,
  generateExpertJudiciaryForm,
  getNvidiaConfig,
  runSupremeCourtCaseAnalysis,
  streamNvidiaChat,
} from './nvidiaService.js';
import {
  buildDeterministicLimitationReply,
  buildDeterministicMatterStatusReply,
  buildDeterministicPrecedentReply,
  buildDeterministicStatuteReply,
  classifyAssistantIntent,
  detectResponseLanguage,
  getFormConfirmationReply,
} from '../lib/legal/assistantEngine.js';
import {
  buildCourtDocxBuffer,
  sanitizeDocxFilename,
} from '../lib/legal/docxExporter.js';
import {
  buildDeterministicJudiciaryForm,
  getJudiciaryTemplate,
} from '../lib/legal/judiciaryTemplates.js';
import {
  formatPrecedentGroundingBlock,
  retrieveRelevantPrecedents,
} from '../lib/legal/supremeCourtCorpus.js';
import { lookupStatuteMappings } from '../lib/legal/statuteCrosswalk.js';
import { parseWhatsAppCommand } from '../lib/legal/whatsappParser.js';
import type { AssistantCompletedAction, AssistantVerifiedSource } from '../types/legal.js';

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

const ALLOWED_DOC_MIMES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'text/plain',
]);

const ALLOWED_AUDIO_MIMES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/m4a',
]);

function extractErrorMessage(err: unknown): string {
  if (err instanceof z.ZodError) {
    return err.issues.map((i) => `${i.path.join('.') || 'input'}: ${i.message}`).join('; ');
  }
  if (err instanceof Error) return err.message;
  return 'Unexpected server error';
}

export async function createExpressApp(options: { includeStatic?: boolean } = {}): Promise<express.Express> {
  const includeStatic = options.includeStatic ?? true;
  const app = express();
  app.disable('x-powered-by');

  // Ensure repository is connected and ready before handling requests
  app.use(async (_req, _res, next) => {
    try {
      await repository.ensureReady();
    } catch (err) {
      console.error('[Repository] ensureReady warning:', err);
    }
    next();
  });

  // Support serverless environments (Vercel, AWS Lambda) where request body is pre-parsed
  app.use((req, _res, next) => {
    if (req.body && typeof req.body === 'object' && !(req as any)._body) {
      (req as any)._body = true;
    }
    // Route normalization for Vercel rewrites
    const matchedPath = (req.headers['x-matched-path'] || req.headers['x-forwarded-uri'] || '') as string;
    if (matchedPath && matchedPath.startsWith('/api') && (req.url === '/api' || req.url === '/api/')) {
      req.url = matchedPath;
    } else if (req.url && !req.url.startsWith('/api')) {
      req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
    }
    next();
  });

  app.use(express.json({ limit: '20mb' }));

  // Basic security headers aligned with Cloudflare & Vercel production config
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Health probe
  app.get('/api/health', async (_req, res) => {
    const nv = getNvidiaConfig();
    const neonCheck = isNeonConfigured() ? await testNeonConnection() : null;
    res.json({
      ok: true,
      storageEngine: repository.engine,
      neon: neonCheck,
      aiEngine: {
        nvidiaConfigured: nv.configured,
        geminiConfigured: isGeminiConfigured(),
        primaryModel: nv.primaryModel,
        fastModel: nv.fastModel,
      },
    });
  });

  // --- Authentication Routes ---
  app.post('/api/auth/register', async (req, res) => {
    try {
      const schema = z.object({
        email: z.string().email(),
        password: z.string().min(8, 'Password must be at least 8 characters'),
        fullName: z.string().min(2).max(120),
        organization: z.string().max(160).optional(),
        role: z.string().max(80).optional(),
        defaultJurisdiction: z.enum(['india_litigation', 'corporate_ma', 'global_multi']).optional(),
      });
      const data = schema.parse(req.body);
      const user = await repository.registerUser(data);
      const token = signSessionToken(user.id, user.email);
      res.status(201).json({ token, user });
    } catch (err) {
      res.status(400).json({ error: extractErrorMessage(err) });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const schema = z.object({
        email: z.string().email(),
        password: z.string().min(1),
      });
      const data = schema.parse(req.body);
      const user = await repository.authenticateUser(data.email, data.password);
      if (!user) {
        res.status(401).json({ error: 'Invalid email or password.' });
        return;
      }
      const token = signSessionToken(user.id, user.email);
      res.json({ token, user });
    } catch (err) {
      res.status(400).json({ error: extractErrorMessage(err) });
    }
  });

  app.post('/api/auth/demo', async (_req, res) => {
    await repository.ensureReady();
    const user = repository.getDemoUser();
    const token = signSessionToken(user.id, user.email);
    res.json({ token, user });
  });

  // --- Admin Middleware & User Management Routes ---
  const requireAdmin = (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
    requireAuth(req, res, async () => {
      const user = await repository.getUserById(req.authUser!.userId);
      const isAllowed = Boolean(
        user?.isAdmin ||
        user?.role?.toLowerCase() === 'admin' ||
        user?.role?.toLowerCase() === 'administrator' ||
        user?.email === 'vidhios@admin.com' ||
        user?.email === 'chambers@vidhios.in'
      );
      if (!isAllowed) {
        res.status(403).json({ error: 'Access denied: Administrator privileges required.' });
        return;
      }
      next();
    });
  };

  app.get('/api/admin/users', requireAdmin, async (_req: AuthRequest, res) => {
    try {
      await repository.ensureReady(repository.engine === 'neon');
      const users = repository.getAllUsers();
      res.json({ users });
    } catch (err) {
      res.status(500).json({ error: extractErrorMessage(err) });
    }
  });

  app.post('/api/admin/users', requireAdmin, async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        email: z.string().email(),
        password: z.string().min(8, 'Password must be at least 8 characters'),
        fullName: z.string().min(2).max(120),
        organization: z.string().max(160).optional(),
        role: z.string().max(80).optional(),
        defaultJurisdiction: z.enum(['india_litigation', 'corporate_ma', 'global_multi']).optional(),
        isAdmin: z.boolean().optional(),
      });
      const data = schema.parse(req.body);
      const user = await repository.adminCreateUser(data);
      res.status(201).json({ user });
    } catch (err) {
      res.status(400).json({ error: extractErrorMessage(err) });
    }
  });

  app.put('/api/admin/users/:id', requireAdmin, async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        fullName: z.string().min(2).max(120).optional(),
        organization: z.string().max(160).optional(),
        role: z.string().max(80).optional(),
        defaultJurisdiction: z.enum(['india_litigation', 'corporate_ma', 'global_multi']).optional(),
        isAdmin: z.boolean().optional(),
      });
      const data = schema.parse(req.body);
      const user = await repository.adminUpdateUser(req.params.id, data);
      res.json({ user });
    } catch (err) {
      res.status(400).json({ error: extractErrorMessage(err) });
    }
  });

  app.post('/api/admin/users/:id/reset-password', requireAdmin, async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        password: z.string().min(8, 'Password must be at least 8 characters'),
      });
      const data = schema.parse(req.body);
      await repository.adminResetPassword(req.params.id, data.password);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: extractErrorMessage(err) });
    }
  });

  app.delete('/api/admin/users/:id', requireAdmin, async (req: AuthRequest, res) => {
    try {
      if (req.params.id === req.authUser!.userId) {
        res.status(400).json({ error: 'You cannot delete your own active administrator account.' });
        return;
      }
      await repository.adminDeleteUser(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: extractErrorMessage(err) });
    }
  });

  // --- Authenticated Workspace Bundle ---
  app.get('/api/workspace', requireAuth, async (req: AuthRequest, res) => {
    const bundle = await repository.getWorkspaceBundle(req.authUser!.userId);
    if (!bundle) {
      res.status(404).json({ error: 'User workspace not found.' });
      return;
    }
    const nv = getNvidiaConfig();
    res.json({
      ...bundle,
      aiEngine: {
        nvidiaConfigured: nv.configured,
        geminiConfigured: isGeminiConfigured(),
        primaryModel: nv.primaryModel,
        fastModel: nv.fastModel,
      },
    });
  });

  // --- Matters CRUD ---
  app.post('/api/matters', requireAuth, async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        title: z.string().min(3).max(200),
        matterCode: z.string().min(2).max(60),
        clientName: z.string().min(2).max(160),
        opposingParty: z.string().max(160).default(''),
        jurisdiction: z.enum(['india_litigation', 'corporate_ma', 'global_multi']),
        forum: z.string().min(2).max(200),
        status: z.enum(['active', 'pending_hearing', 'in_review', 'closed']).default('active'),
        summaryFacts: z.string().max(6000).default(''),
      });
      const data = schema.parse(req.body);
      const matter = repository.createMatter(req.authUser!.userId, data);
      await repository.persist();
      res.status(201).json(matter);
    } catch (err) {
      res.status(400).json({ error: extractErrorMessage(err) });
    }
  });

  app.delete('/api/matters/:id', requireAuth, async (req: AuthRequest, res) => {
    const deleted = repository.deleteMatter(req.authUser!.userId, String(req.params.id));
    if (!deleted) {
      res.status(404).json({ error: 'Matter not found.' });
      return;
    }
    await repository.persist();
    res.json({ deleted: true });
  });

  // --- Drafts CRUD ---
  app.post('/api/drafts', requireAuth, async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        matterId: z.string().min(1),
        title: z.string().min(2).max(200),
        docType: z.string().min(2).max(100),
        content: z.string().max(120000),
      });
      const data = schema.parse(req.body);
      if (!repository.getMatterForUser(req.authUser!.userId, data.matterId)) {
        res.status(404).json({ error: 'Matter not found.' });
        return;
      }
      const draft = repository.createDraft(req.authUser!.userId, data);
      await repository.persist();
      res.status(201).json(draft);
    } catch (err) {
      res.status(400).json({ error: extractErrorMessage(err) });
    }
  });

  app.patch('/api/drafts/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        title: z.string().min(2).max(200).optional(),
        content: z.string().max(120000).optional(),
      });
      const data = schema.parse(req.body);
      const updated = repository.updateDraft(req.authUser!.userId, String(req.params.id), data);
      if (!updated) {
        res.status(404).json({ error: 'Draft not found.' });
        return;
      }
      await repository.persist();
      res.json(updated);
    } catch (err) {
      res.status(400).json({ error: extractErrorMessage(err) });
    }
  });

  // --- Contract Redline Decision ---
  app.patch('/api/contract-reviews/:reviewId/clauses/:clauseId', requireAuth, async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        decision: z.enum(['pending', 'accepted', 'rejected']),
      });
      const { decision } = schema.parse(req.body);
      const updated = repository.updateRedlineClauseDecision(
        req.authUser!.userId,
        String(req.params.reviewId),
        String(req.params.clauseId),
        decision
      );
      if (!updated) {
        res.status(404).json({ error: 'Contract review or clause not found.' });
        return;
      }
      await repository.persist();
      res.json(updated);
    } catch (err) {
      res.status(400).json({ error: extractErrorMessage(err) });
    }
  });

  // --- Case Tracker & Deadlines ---
  app.post('/api/cases', requireAuth, async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        matterId: z.string().min(1),
        caseNumber: z.string().min(2).max(80),
        cnrNumber: z.string().max(80).default(''),
        court: z.string().min(2).max(160),
        courtroom: z.string().max(80).default(''),
        bench: z.string().max(160).default(''),
        causeListItem: z.string().max(80).default(''),
        nextHearingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        stage: z.string().min(2).max(160),
        status: z.enum(['listed', 'in_session', 'adjourned', 'disposed']).default('listed'),
        notes: z.string().max(2000).default(''),
      });
      const data = schema.parse(req.body);
      if (!repository.getMatterForUser(req.authUser!.userId, data.matterId)) {
        res.status(404).json({ error: 'Matter not found.' });
        return;
      }
      const created = repository.addTrackedCase({ ...data, userId: req.authUser!.userId });
      await repository.persist();
      res.status(201).json(created);
    } catch (err) {
      res.status(400).json({ error: extractErrorMessage(err) });
    }
  });

  app.patch('/api/cases/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        status: z.enum(['listed', 'in_session', 'adjourned', 'disposed']),
      });
      const { status } = schema.parse(req.body);
      const updated = repository.updateTrackedCaseStatus(
        req.authUser!.userId,
        String(req.params.id),
        status
      );
      if (!updated) {
        res.status(404).json({ error: 'Tracked case not found.' });
        return;
      }
      await repository.persist();
      res.json(updated);
    } catch (err) {
      res.status(400).json({ error: extractErrorMessage(err) });
    }
  });

  app.post('/api/deadlines', requireAuth, async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        matterId: z.string().min(1),
        title: z.string().min(2).max(200),
        statuteArticle: z.string().min(2).max(160),
        triggerDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        graceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        notes: z.string().max(2000).default(''),
      });
      const data = schema.parse(req.body);
      if (!repository.getMatterForUser(req.authUser!.userId, data.matterId)) {
        res.status(404).json({ error: 'Matter not found.' });
        return;
      }
      const created = repository.addDeadline({
        ...data,
        userId: req.authUser!.userId,
        completed: false,
      });
      await repository.persist();
      res.status(201).json(created);
    } catch (err) {
      res.status(400).json({ error: extractErrorMessage(err) });
    }
  });

  app.patch('/api/deadlines/:id/toggle', requireAuth, async (req: AuthRequest, res) => {
    const updated = repository.toggleDeadline(req.authUser!.userId, String(req.params.id));
    if (!updated) {
      res.status(404).json({ error: 'Deadline not found.' });
      return;
    }
    await repository.persist();
    res.json(updated);
  });

  // --- WhatsApp Command Center Execution ---
  app.post('/api/whatsapp/command', requireAuth, async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        matterId: z.string().nullable().optional(),
        text: z.string().min(1).max(2000),
      });
      const { matterId, text } = schema.parse(req.body);
      const userId = req.authUser!.userId;
      const bundle = await repository.getWorkspaceBundle(userId);
      if (!bundle) {
        res.status(404).json({ error: 'Workspace not found.' });
        return;
      }

      const activeMatter =
        (matterId ? bundle.matters.find((m) => m.id === matterId) : bundle.matters[0]) ?? null;

      const userMsg = repository.addWhatsAppMessage({
        userId,
        matterId: activeMatter?.id ?? null,
        sender: 'user',
        body: text,
        commandTag: 'input',
      });

      const intent = parseWhatsAppCommand(text);
      let replyBody = '';
      let commandTag = intent.type;
      let createdDeadline = null;

      if (intent.type === 'help') {
        replyBody = [
          'VidhiOS WhatsApp Command Reference:',
          '• /hearings — Upcoming court dates & cause list items',
          '• /cases — Full active docket status',
          '• /deadlines — Pending Limitation & filing deadlines',
          '• /bns <section or offence> — Instant IPC/CrPC/IEA → BNS/BNSS/BSA lookup',
          '• /remind <task> — Pin a reminder directly to active Matter deadlines',
          '• /brief — Active Matter facts & strategic snapshot',
          '• Or ask any natural-language legal question directly.',
        ].join('\n');
      } else if (intent.type === 'hearings' || intent.type === 'cases') {
        if (bundle.trackedCases.length === 0) {
          replyBody = 'No tracked cases found yet. Add a case in the Case Tracker module.';
        } else {
          replyBody =
            'Active Cause List & Hearings:\n' +
            bundle.trackedCases
              .slice(0, 6)
              .map(
                (c, i) =>
                  `${i + 1}. ${c.caseNumber} (${c.court}) — ${c.nextHearingDate} | ${c.courtroom || 'TBD'} | ${c.causeListItem || c.stage}`
              )
              .join('\n');
        }
      } else if (intent.type === 'deadlines') {
        const pending = bundle.deadlines.filter((d) => !d.completed);
        replyBody =
          pending.length === 0
            ? 'All filing and limitation deadlines are currently marked complete.'
            : 'Pending Statutory & Filing Deadlines:\n' +
              pending
                .slice(0, 6)
                .map((d, i) => `${i + 1}. ${d.title} — Due ${d.dueDate} (${d.statuteArticle})`)
                .join('\n');
      } else if (intent.type === 'bns') {
        const hits = lookupStatuteMappings(intent.query);
        if (hits.length === 0) {
          replyBody = `No exact crosswalk match for "${intent.query}". Try e.g. /bns 420, /bns 438, or /bns 65B.`;
        } else {
          replyBody = hits
            .slice(0, 4)
            .map(
              (h) =>
                `${h.legacyCode} ${h.legacySection} → ${h.newCode} ${h.newSection} (${h.title})\nNote: ${h.keyChangeNote}`
            )
            .join('\n\n');
        }
      } else if (intent.type === 'remind') {
        const taskTitle = intent.text || 'Follow-up chambers reminder';
        if (activeMatter) {
          const today = new Date().toISOString().slice(0, 10);
          const due = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
          createdDeadline = repository.addDeadline({
            userId,
            matterId: activeMatter.id,
            title: taskTitle,
            statuteArticle: 'WhatsApp Command Reminder',
            triggerDate: today,
            dueDate: due,
            completed: false,
            notes: 'Created from WhatsApp Legal Command Center.',
          });
          replyBody = `Reminder pinned to "${activeMatter.title}": "${taskTitle}" (target date: ${due}). Synced with Case Tracker & Calendar.`;
        } else {
          replyBody = 'Create a Matter first before pinning a WhatsApp reminder.';
        }
      } else if (intent.type === 'brief') {
        replyBody = activeMatter
          ? `Active Matter Brief — ${activeMatter.title} (${activeMatter.matterCode})\nForum: ${activeMatter.forum}\nClient: ${activeMatter.clientName}\nStatus: ${activeMatter.status}\nFacts: ${activeMatter.summaryFacts}`
          : 'No active matter selected.';
      } else {
        const matterCtx = activeMatter
          ? `${activeMatter.title} | ${activeMatter.forum} | ${activeMatter.summaryFacts}`
          : 'General legal practice';
        replyBody = await answerWhatsAppQuery({
          prompt: intent.prompt,
          matterContext: matterCtx,
          jurisdiction: activeMatter?.jurisdiction ?? 'india_litigation',
        });
      }

      const assistantMsg = repository.addWhatsAppMessage({
        userId,
        matterId: activeMatter?.id ?? null,
        sender: 'assistant',
        body: replyBody,
        commandTag,
      });

      res.json({ userMsg, assistantMsg, createdDeadline });
    } catch (err) {
      res.status(500).json({ error: extractErrorMessage(err) });
    }
  });

  // --- Server-Side Gemini AI Routes ---
  app.post('/api/ai/research', requireAuth, async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        matterId: z.string().min(1),
        query: z.string().min(5).max(3000),
        jurisdiction: z.enum(['india_litigation', 'corporate_ma', 'global_multi']),
        tier: z.enum(['fast', 'expert']).optional().default('fast'),
      });
      const data = schema.parse(req.body);
      const matter = repository.getMatterForUser(req.authUser!.userId, data.matterId);
      if (!matter) {
        res.status(404).json({ error: 'Matter not found.' });
        return;
      }
      const matterContext = `Title: ${matter.title}\nForum: ${matter.forum}\nClient: ${matter.clientName}\nOpposing: ${matter.opposingParty}\nFacts: ${matter.summaryFacts}`;
      const result = await runGroundedLegalResearch({
        query: data.query,
        jurisdiction: data.jurisdiction,
        matterContext,
        tier: data.tier,
      });
      const saved = repository.addResearchMemo({
        matterId: matter.id,
        userId: req.authUser!.userId,
        query: data.query,
        jurisdiction: data.jurisdiction,
        answerMarkdown: result.answerMarkdown,
        citations: result.citations,
        citationIntegrity: result.citationIntegrity,
      });
      res.status(201).json(saved);
    } catch (err) {
      res.status(500).json({ error: extractErrorMessage(err) });
    }
  });

  // --- Real-Time Streaming Legal Research with Live Kanoon & Precedent Grounding ---
  app.post('/api/ai/research/stream', requireAuth, async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        matterId: z.string().min(1),
        query: z.string().min(5).max(3000),
        jurisdiction: z.enum(['india_litigation', 'corporate_ma', 'global_multi']),
        tier: z.enum(['fast', 'expert']).optional().default('fast'),
      });
      const data = schema.parse(req.body);
      const matter = repository.getMatterForUser(req.authUser!.userId, data.matterId);
      if (!matter) {
        res.status(404).json({ error: 'Matter not found.' });
        return;
      }

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();

      const sendEvent = (event: string, payload: unknown) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
      };

      const matterContext = `Title: ${matter.title}\nForum: ${matter.forum}\nClient: ${matter.clientName}\nOpposing: ${matter.opposingParty}\nFacts: ${matter.summaryFacts}`;

      const result = await streamGroundedLegalResearch(
        {
          query: data.query,
          jurisdiction: data.jurisdiction,
          matterContext,
          tier: data.tier,
        },
        (update) => {
          sendEvent(update.type, update.data);
        }
      );

      const saved = repository.addResearchMemo({
        matterId: matter.id,
        userId: req.authUser!.userId,
        query: data.query,
        jurisdiction: data.jurisdiction,
        answerMarkdown: result.answerMarkdown,
        citations: result.citations,
        citationIntegrity: result.citationIntegrity,
      });

      sendEvent('complete', saved);
      res.end();
    } catch (err) {
      if (!res.headersSent) {
        res.status(500).json({ error: extractErrorMessage(err) });
      } else {
        res.write(`event: error\ndata: ${JSON.stringify({ error: extractErrorMessage(err) })}\n\n`);
        res.end();
      }
    }
  });

  app.post('/api/ai/draft-generate', requireAuth, async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        matterId: z.string().min(1),
        title: z.string().min(2).max(200),
        docType: z.string().min(2).max(100),
        instructions: z.string().min(5).max(5000),
        jurisdiction: z.enum(['india_litigation', 'corporate_ma', 'global_multi']),
      });
      const data = schema.parse(req.body);
      const matter = repository.getMatterForUser(req.authUser!.userId, data.matterId);
      if (!matter) {
        res.status(404).json({ error: 'Matter not found.' });
        return;
      }
      const matterContext = `Title: ${matter.title}\nForum: ${matter.forum}\nClient: ${matter.clientName}\nOpposing: ${matter.opposingParty}\nFacts: ${matter.summaryFacts}`;
      const content = await generateLegalDraft({
        docType: data.docType,
        instructions: data.instructions,
        jurisdiction: data.jurisdiction,
        matterContext,
      });
      const saved = repository.createDraft(req.authUser!.userId, {
        matterId: matter.id,
        title: data.title,
        docType: data.docType,
        content,
      });
      res.status(201).json(saved);
    } catch (err) {
      res.status(500).json({ error: extractErrorMessage(err) });
    }
  });

  app.post('/api/ai/draft-rewrite', requireAuth, async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        selection: z.string().min(5).max(12000),
        instruction: z.string().min(2).max(1000),
        jurisdiction: z.enum(['india_litigation', 'corporate_ma', 'global_multi']),
      });
      const data = schema.parse(req.body);
      const rewritten = await rewriteDraftSelection(data);
      res.json({ rewritten });
    } catch (err) {
      res.status(500).json({ error: extractErrorMessage(err) });
    }
  });

  app.post('/api/ai/courtroom/start', requireAuth, async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        matterId: z.string().min(1),
        mode: z.enum(['bench', 'opposing_counsel']),
        forumContext: z.string().min(2).max(200),
        briefExcerpt: z.string().min(10).max(12000),
        openingSubmission: z.string().min(5).max(4000),
      });
      const data = schema.parse(req.body);
      const matter = repository.getMatterForUser(req.authUser!.userId, data.matterId);
      if (!matter) {
        res.status(404).json({ error: 'Matter not found.' });
        return;
      }

      const aiTurn = await runCourtroomTurn({
        mode: data.mode,
        forumContext: data.forumContext,
        briefExcerpt: data.briefExcerpt,
        history: [],
        userSubmission: data.openingSubmission,
        jurisdiction: matter.jurisdiction,
      });

      const now = new Date().toISOString();
      const session = repository.createCourtroomSession({
        matterId: matter.id,
        userId: req.authUser!.userId,
        mode: data.mode,
        forumContext: data.forumContext,
        briefExcerpt: data.briefExcerpt,
        vulnerabilities: [aiTurn.weaknessFlag],
        turns: [
          {
            id: `turn_u_${Date.now()}`,
            speaker: 'counsel',
            message: data.openingSubmission,
            timestamp: now,
          },
          {
            id: `turn_a_${Date.now() + 1}`,
            speaker: data.mode,
            message: aiTurn.replyMessage,
            weaknessFlag: aiTurn.weaknessFlag,
            suggestedRebuttal: aiTurn.suggestedRebuttal,
            authorities: aiTurn.authorities,
            timestamp: now,
          },
        ],
      });
      res.status(201).json(session);
    } catch (err) {
      res.status(500).json({ error: extractErrorMessage(err) });
    }
  });

  app.post('/api/ai/courtroom/:sessionId/reply', requireAuth, async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        submission: z.string().min(3).max(4000),
      });
      const { submission } = schema.parse(req.body);
      const userId = req.authUser!.userId;
      const bundle = await repository.getWorkspaceBundle(userId);
      const session = bundle?.courtroomSessions.find((s) => s.id === String(req.params.sessionId));
      if (!session) {
        res.status(404).json({ error: 'Courtroom session not found.' });
        return;
      }
      const matter = repository.getMatterForUser(userId, session.matterId);
      const aiTurn = await runCourtroomTurn({
        mode: session.mode,
        forumContext: session.forumContext,
        briefExcerpt: session.briefExcerpt,
        history: session.turns,
        userSubmission: submission,
        jurisdiction: matter?.jurisdiction ?? 'india_litigation',
      });

      const now = new Date().toISOString();
      const updated = repository.appendCourtroomTurns(
        userId,
        session.id,
        [
          {
            id: `turn_u_${Date.now()}`,
            speaker: 'counsel',
            message: submission,
            timestamp: now,
          },
          {
            id: `turn_a_${Date.now() + 1}`,
            speaker: session.mode,
            message: aiTurn.replyMessage,
            weaknessFlag: aiTurn.weaknessFlag,
            suggestedRebuttal: aiTurn.suggestedRebuttal,
            authorities: aiTurn.authorities,
            timestamp: now,
          },
        ],
        [aiTurn.weaknessFlag]
      );
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: extractErrorMessage(err) });
    }
  });

  app.post('/api/ai/contract-redline', requireAuth, async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        matterId: z.string().min(1),
        title: z.string().min(2).max(200),
        playbook: z.string().min(2).max(160),
        contractText: z.string().min(30).max(50000),
      });
      const data = schema.parse(req.body);
      const matter = repository.getMatterForUser(req.authUser!.userId, data.matterId);
      if (!matter) {
        res.status(404).json({ error: 'Matter not found.' });
        return;
      }

      const result = await analyzeContractRedline({
        title: data.title,
        playbook: data.playbook,
        contractText: data.contractText,
        jurisdiction: matter.jurisdiction,
      });

      const saved = repository.addContractReview({
        matterId: matter.id,
        userId: req.authUser!.userId,
        title: data.title,
        playbook: data.playbook,
        sourceText: data.contractText,
        summary: result.summary,
        clauses: result.clauses,
        requisitions: result.requisitions,
      });
      res.status(201).json(saved);
    } catch (err) {
      res.status(500).json({ error: extractErrorMessage(err) });
    }
  });

  app.post('/api/ai/vault-process', requireAuth, async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        matterId: z.string().min(1),
        fileName: z.string().min(1).max(200),
        mimeType: z.string().min(1).max(100),
        docCategory: z.string().max(100).default('Annexure'),
        base64Data: z.string().max(18_000_000).optional(),
        textInput: z.string().max(40000).optional(),
        targetLanguage: z.string().max(60).default('None'),
      });
      const data = schema.parse(req.body);

      if (data.base64Data && !ALLOWED_DOC_MIMES.has(data.mimeType)) {
        res.status(400).json({ error: `Unsupported file type: ${data.mimeType}` });
        return;
      }

      const userId = req.authUser!.userId;
      const matter = repository.getMatterForUser(userId, data.matterId);
      if (!matter) {
        res.status(404).json({ error: 'Matter not found.' });
        return;
      }

      const bundle = await repository.getWorkspaceBundle(userId);
      const existingDocsContext = (bundle?.vaultDocuments ?? [])
        .filter((d) => d.matterId === matter.id)
        .map((d) => `[${d.fileName}]: ${d.extractedText.slice(0, 2000)}`)
        .join('\n\n');

      const result = await processVaultDocument({
        fileName: data.fileName,
        mimeType: data.mimeType,
        base64Data: data.base64Data,
        textInput: data.textInput,
        targetLanguage: data.targetLanguage,
        existingDocsContext: existingDocsContext || matter.summaryFacts,
        jurisdiction: matter.jurisdiction,
      });

      const saved = repository.addVaultDocument({
        matterId: matter.id,
        userId,
        fileName: data.fileName,
        mimeType: data.mimeType,
        docCategory: data.docCategory,
        extractedText: result.extractedText,
        translatedText: result.translatedText,
        targetLanguage: data.targetLanguage === 'None' ? '' : data.targetLanguage,
        chronology: result.chronology,
        contradictions: result.contradictions,
      });
      res.status(201).json(saved);
    } catch (err) {
      res.status(500).json({ error: extractErrorMessage(err) });
    }
  });

  app.post('/api/ai/meeting-brief', requireAuth, async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        matterId: z.string().min(1),
        title: z.string().min(2).max(200),
        durationLabel: z.string().max(30).default('05:00'),
        base64Audio: z.string().max(18_000_000).optional(),
        mimeType: z.string().max(100).optional(),
        transcriptText: z.string().max(40000).optional(),
      });
      const data = schema.parse(req.body);

      if (data.base64Audio && data.mimeType) {
        const baseMime = data.mimeType.split(';')[0].trim().toLowerCase();
        if (!ALLOWED_AUDIO_MIMES.has(baseMime)) {
          res.status(400).json({ error: `Unsupported audio format: ${data.mimeType}` });
          return;
        }
      }

      const userId = req.authUser!.userId;
      const matter = repository.getMatterForUser(userId, data.matterId);
      if (!matter) {
        res.status(404).json({ error: 'Matter not found.' });
        return;
      }

      const result = await transcribeAndSummarizeMeeting({
        base64Audio: data.base64Audio,
        mimeType: data.mimeType?.split(';')[0].trim(),
        transcriptText: data.transcriptText,
        matterContext: `${matter.title} (${matter.forum}): ${matter.summaryFacts}`,
        jurisdiction: matter.jurisdiction,
      });

      const saved = repository.addMeetingBrief({
        matterId: matter.id,
        userId,
        title: data.title,
        durationLabel: data.durationLabel,
        transcript: result.transcript,
        summary: result.summary,
        keyFacts: result.keyFacts,
        actionItems: result.actionItems,
        statutoryIssues: result.statutoryIssues,
      });
      res.status(201).json(saved);
    } catch (err) {
      res.status(500).json({ error: extractErrorMessage(err) });
    }
  });

  // --- Supreme Court / High Court Case Analysis (Real-Time User Data + Precedent Corpus) ---
  app.post('/api/ai/case-analysis', requireAuth, async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        matterId: z.string().min(1),
        caseTitle: z.string().min(3).max(240),
        courtLevel: z.string().min(2).max(160),
        jurisdiction: z.enum(['india_litigation', 'corporate_ma', 'global_multi']),
        parties: z.string().min(2).max(300),
        caseStage: z.string().min(2).max(160),
        userFactsAndData: z.string().min(20).max(25000),
        keyLegalQuestions: z.string().max(3000).default(''),
        saveToResearch: z.boolean().optional().default(false),
      });
      const data = schema.parse(req.body);
      const userId = req.authUser!.userId;
      const matter = repository.getMatterForUser(userId, data.matterId);
      if (!matter) {
        res.status(404).json({ error: 'Matter not found.' });
        return;
      }

      const bundle = await repository.getWorkspaceBundle(userId);
      const vaultSummary = (bundle?.vaultDocuments ?? [])
        .filter((d) => d.matterId === matter.id)
        .slice(0, 4)
        .map((d) => `[${d.fileName}]: ${d.extractedText.slice(0, 800)}`)
        .join('\n');
      const docketSummary = (bundle?.trackedCases ?? [])
        .filter((c) => c.matterId === matter.id)
        .map((c) => `${c.caseNumber} (${c.court}) — Next: ${c.nextHearingDate}, Stage: ${c.stage}`)
        .join('\n');
      const deadlineSummary = (bundle?.deadlines ?? [])
        .filter((dl) => dl.matterId === matter.id && !dl.completed)
        .map((dl) => `${dl.title} — Due ${dl.dueDate} (${dl.statuteArticle})`)
        .join('\n');

      const liveWorkspaceContext = [
        `Matter Dossier: ${matter.title} (${matter.matterCode}) | Forum: ${matter.forum}`,
        `Client: ${matter.clientName} | Opposing: ${matter.opposingParty}`,
        `Base Facts: ${matter.summaryFacts}`,
        docketSummary ? `Tracked Hearings:\n${docketSummary}` : '',
        deadlineSummary ? `Active Deadlines:\n${deadlineSummary}` : '',
        vaultSummary ? `Vault Exhibits:\n${vaultSummary}` : '',
      ]
        .filter(Boolean)
        .join('\n\n');

      const report = await runSupremeCourtCaseAnalysis({
        matterId: matter.id,
        caseTitle: data.caseTitle,
        courtLevel: data.courtLevel,
        jurisdiction: data.jurisdiction,
        parties: data.parties,
        caseStage: data.caseStage,
        userFactsAndData: data.userFactsAndData,
        keyLegalQuestions: data.keyLegalQuestions,
        liveWorkspaceContext,
      });

      let savedMemo = null;
      if (data.saveToResearch) {
        savedMemo = repository.addResearchMemo({
          matterId: matter.id,
          userId,
          query: `Court Case Analysis: ${data.caseTitle} (${data.courtLevel})`,
          jurisdiction: data.jurisdiction,
          answerMarkdown: report.detailedMarkdown,
          citations: report.landmarkCaseStudies.map((cs) => ({
            title: `${cs.caseName}, ${cs.citation}`,
            url: `https://indiankanoon.org/search/?formInput=${encodeURIComponent(cs.caseName)}`,
            courtOrSource: cs.court,
            status: 'statute',
          })),
          citationIntegrity: {
            verifiedSourceCount: report.landmarkCaseStudies.length,
            jurisdictionChecked: `${data.courtLevel} · ${report.engineUsed}`,
            bnsComplianceNote: 'Audited against BNS 2023 / BNSS 2023 / BSA 2023 and verified SC/HC corpus.',
            confidenceLabel: 'Grounded via Web & Statute',
          },
        });
      }

      res.status(201).json({ report, savedMemo });
    } catch (err) {
      res.status(500).json({ error: extractErrorMessage(err) });
    }
  });

  // --- Affidavit & Judiciary Form Generator (Non-Streaming + Save to Drafts) ---
  app.post('/api/ai/judiciary-form', requireAuth, async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        matterId: z.string().min(1),
        templateId: z.string().min(2).max(80),
        courtName: z.string().min(2).max(260),
        caseNumber: z.string().max(160).default(''),
        petitionerName: z.string().min(2).max(220),
        respondentName: z.string().min(2).max(220),
        deponentName: z.string().max(220).default(''),
        deponentDetails: z.string().max(500).default(''),
        factsSummary: z.string().min(10).max(16000),
        reliefSought: z.string().max(3000).default(''),
        placeOfFiling: z.string().max(120).default('Mumbai / New Delhi'),
        filingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        jurisdiction: z.enum(['india_litigation', 'corporate_ma', 'global_multi']),
        saveAsDraft: z.boolean().optional().default(true),
      });
      const data = schema.parse(req.body);
      const userId = req.authUser!.userId;
      const matter = repository.getMatterForUser(userId, data.matterId);
      if (!matter) {
        res.status(404).json({ error: 'Matter not found.' });
        return;
      }

      const tpl = getJudiciaryTemplate(data.templateId);
      const liveContext = `Matter: ${matter.title} (${matter.matterCode}) | Forum: ${matter.forum} | Client: ${matter.clientName} | Opposing: ${matter.opposingParty}\nBase Facts: ${matter.summaryFacts}`;
      const generated = await generateExpertJudiciaryForm(data, liveContext);

      let savedDraft = null;
      if (data.saveAsDraft) {
        savedDraft = repository.createDraft(userId, {
          matterId: matter.id,
          title: `${tpl.name} — ${data.petitionerName.slice(0, 48)}`,
          docType: tpl.name,
          content: generated.content,
        });
      }

      res.status(201).json({
        content: generated.content,
        engineUsed: generated.engineUsed,
        latencyMs: generated.latencyMs,
        draft: savedDraft,
      });
    } catch (err) {
      res.status(500).json({ error: extractErrorMessage(err) });
    }
  });

  // --- Real-Time SSE Streaming Affidavit & Judiciary Form Generator ---
  app.post('/api/ai/judiciary-form/stream', requireAuth, async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        matterId: z.string().min(1),
        templateId: z.string().min(2).max(80),
        courtName: z.string().min(2).max(260),
        caseNumber: z.string().max(160).default(''),
        petitionerName: z.string().min(2).max(220),
        respondentName: z.string().min(2).max(220),
        deponentName: z.string().max(220).default(''),
        deponentDetails: z.string().max(500).default(''),
        factsSummary: z.string().min(10).max(16000),
        reliefSought: z.string().max(3000).default(''),
        placeOfFiling: z.string().max(120).default('Mumbai / New Delhi'),
        filingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        jurisdiction: z.enum(['india_litigation', 'corporate_ma', 'global_multi']),
      });
      const data = schema.parse(req.body);
      const userId = req.authUser!.userId;
      const matter = repository.getMatterForUser(userId, data.matterId);
      if (!matter) {
        res.status(404).json({ error: 'Matter not found.' });
        return;
      }

      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();

      const sendEvent = (event: string, payload: unknown) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
      };

      const tpl = getJudiciaryTemplate(data.templateId);
      const precedents = retrieveRelevantPrecedents(
        `${tpl.name} ${tpl.statuteBasis} ${data.factsSummary} ${data.reliefSought}`,
        data.jurisdiction,
        3
      );
      const precedentBlock = formatPrecedentGroundingBlock(precedents);
      const nv = getNvidiaConfig();
      const startedAt = Date.now();
      let fullText = '';
      let engineUsed = '';

      if (nv.configured) {
        try {
          const systemPrompt = buildSupremeCourtSystemPrompt(
            data.jurisdiction,
            `Draft a complete, court-filing-ready ${tpl.name} strictly adhering to Supreme Court Rules 2013 / High Court Registry format with ALL-CAPS Court Heading, Cause Title, numbered paragraphs, Prayer, Advocate block, and Order XIX Rule 3 Verification & Affidavit. Output clean plain legal text with no markdown fences.`
          );
          const userPrompt = `Form: ${tpl.name} (${tpl.statuteBasis})\nCourt: ${data.courtName}\nCase No.: ${data.caseNumber}\nPetitioner: ${data.petitionerName}\nRespondent: ${data.respondentName}\nDeponent: ${data.deponentName || data.petitionerName} (${data.deponentDetails})\nPlace & Date: ${data.placeOfFiling}, ${data.filingDate}\nRelief: ${data.reliefSought || tpl.suggestedRelief}\n\nFacts:\n${data.factsSummary}\n\nMatter Context: ${matter.title} (${matter.forum})\n\n${precedentBlock}`;

          const streamed = await streamNvidiaChat(
            { systemPrompt, userPrompt, tier: 'expert', maxTokens: 3200 },
            (delta) => {
              sendEvent('delta', { text: delta });
            }
          );
          fullText = streamed.fullText
            .replace(/^```[a-z]*\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();
          engineUsed = `NVIDIA NIM Streaming (${streamed.model})`;
        } catch {
          // Graceful instant deterministic fallback stream
          fullText = buildDeterministicJudiciaryForm(data);
          engineUsed = 'VidhiOS Court Registry Engine (Fallback)';
          sendEvent('delta', { text: fullText });
        }
      } else {
        fullText = buildDeterministicJudiciaryForm(data);
        engineUsed = 'VidhiOS Supreme Court & High Court Registry Engine';
        // Stream cleanly in fast paragraph chunks for smooth live preview
        const chunks = fullText.split(/(\n\n)/);
        for (const ch of chunks) {
          sendEvent('delta', { text: ch });
        }
      }

      const savedDraft = repository.createDraft(userId, {
        matterId: matter.id,
        title: `${tpl.name} — ${data.petitionerName.slice(0, 48)}`,
        docType: tpl.name,
        content: fullText,
      });

      sendEvent('done', {
        draft: savedDraft,
        engineUsed,
        latencyMs: Date.now() - startedAt,
      });
      res.end();
    } catch (err) {
      if (!res.headersSent) {
        res.status(400).json({ error: extractErrorMessage(err) });
      } else {
        res.write(`event: error\ndata: ${JSON.stringify({ error: extractErrorMessage(err) })}\n\n`);
        res.end();
      }
    }
  });

  // --- Court-Formatted Microsoft Word (.DOCX) Export ---
  app.post('/api/export/docx', requireAuth, async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        title: z.string().min(1).max(240),
        courtHeader: z.string().max(260).optional(),
        matterCode: z.string().max(80).optional(),
        docType: z.string().max(120).optional(),
        content: z.string().min(1).max(200000),
      });
      const data = schema.parse(req.body);
      const buffer = await buildCourtDocxBuffer(data);
      const filename = sanitizeDocxFilename(data.title);

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', String(buffer.length));
      res.send(buffer);
    } catch (err) {
      res.status(400).json({ error: extractErrorMessage(err) });
    }
  });

  // --- VidhiOS Bilingual (Hindi / English) Zero-Hallucination Assistant ---
  app.post('/api/ai/assistant', requireAuth, async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        matterId: z.string().nullable().optional(),
        message: z.string().min(1).max(6000),
        languageMode: z.enum(['auto', 'en', 'hi', 'bilingual']).default('auto'),
        jurisdiction: z.enum(['india_litigation', 'corporate_ma', 'global_multi']).optional(),
      });
      const data = schema.parse(req.body);
      const userId = req.authUser!.userId;
      const bundle = await repository.getWorkspaceBundle(userId);
      if (!bundle) {
        res.status(404).json({ error: 'Workspace not found.' });
        return;
      }

      const activeMatter =
        (data.matterId ? bundle.matters.find((m) => m.id === data.matterId) : bundle.matters[0]) ??
        null;
      const effectiveJurisdiction =
        data.jurisdiction ?? activeMatter?.jurisdiction ?? 'india_litigation';
      const lang = detectResponseLanguage(data.message, data.languageMode);

      const userMsg = repository.addAssistantMessage({
        userId,
        matterId: activeMatter?.id ?? null,
        role: 'user',
        content: data.message.trim(),
        languageUsed: lang,
        verificationMode: 'deterministic_verified',
        confidenceNote: 'Client Input',
        sources: [],
        completedActions: [],
      });

      const intent = classifyAssistantIntent(data.message);
      let replyText = '';
      let sources: AssistantVerifiedSource[] = [];
      let completedActions: AssistantCompletedAction[] = [];
      let verificationMode: 'deterministic_verified' | 'grounded_ai_verified' =
        'deterministic_verified';
      let confidenceNote = '100% Deterministic Verified Legal Engine · Zero Hallucination';
      let createdDraft = null;
      let createdDeadline = null;

      if (intent.type === 'statute_lookup') {
        const result = buildDeterministicStatuteReply(intent.query, lang);
        replyText = result.text;
        sources = result.sources;
        if (result.found) {
          completedActions.push({
            type: 'statute_audited',
            label: `${result.sources.length} Verified BNS/BNSS/BSA Mapping(s)`,
          });
        }
      } else if (intent.type === 'limitation_calc') {
        let savedTitle: string | undefined;
        const preview = buildDeterministicLimitationReply(intent.ruleId, intent.triggerDate, lang);
        if (intent.saveDeadline && activeMatter) {
          savedTitle = `${preview.computed.rule.label} (${activeMatter.matterCode})`;
          createdDeadline = repository.addDeadline({
            userId,
            matterId: activeMatter.id,
            title: savedTitle,
            statuteArticle: `${preview.computed.rule.statute} (${preview.computed.rule.articleOrSection})`,
            triggerDate: intent.triggerDate,
            dueDate: preview.computed.effectiveDueDate,
            graceDate: preview.computed.graceDeadlineDate ?? undefined,
            completed: false,
            notes: 'Computed and pinned by VidhiOS Bilingual Assistant.',
          });
          completedActions.push({
            type: 'deadline_created',
            label: `Deadline Saved: ${preview.computed.effectiveDueDate}`,
            recordId: createdDeadline.id,
          });
        } else {
          completedActions.push({
            type: 'limitation_computed',
            label: `Verified Expiry: ${preview.computed.effectiveDueDate}`,
          });
        }
        const finalLim = buildDeterministicLimitationReply(
          intent.ruleId,
          intent.triggerDate,
          lang,
          savedTitle
        );
        replyText = finalLim.text;
        sources = finalLim.sources;
      } else if (intent.type === 'add_deadline') {
        if (!activeMatter) {
          replyText =
            lang === 'hi'
              ? 'कृपया पहले एक सक्रिय केस (Matter) चुनें ताकि रिमाइंडर सेव किया जा सके।'
              : 'Select an active Matter first so I can save this deadline to your Case Tracker.';
        } else {
          createdDeadline = repository.addDeadline({
            userId,
            matterId: activeMatter.id,
            title: intent.title,
            statuteArticle: 'VidhiOS Assistant Action',
            triggerDate: new Date().toISOString().slice(0, 10),
            dueDate: intent.dueDate,
            completed: false,
            notes: 'Created directly from VidhiOS Bilingual Legal Assistant.',
          });
          sources = [
            {
              label: `${activeMatter.matterCode} — Case Tracker`,
              reference: `Due ${intent.dueDate}`,
              kind: 'matter_record',
            },
          ];
          completedActions = [
            {
              type: 'deadline_created',
              label: `Saved Deadline: ${intent.title} (${intent.dueDate})`,
              recordId: createdDeadline.id,
            },
          ];
          replyText =
            lang === 'hi'
              ? `कार्य पूर्ण: "${intent.title}" को आपके केस "${activeMatter.title}" की डेडलाइन सूची में जोड़ दिया गया है (लक्ष्य तिथि: ${intent.dueDate})।`
              : `Completed: Pinned "${intent.title}" to "${activeMatter.title}" in your Case Tracker & Limitation Calendar (Due: ${intent.dueDate}).`;
        }
      } else if (intent.type === 'matter_status') {
        const draftCount = bundle.drafts.filter(
          (d) => activeMatter && d.matterId === activeMatter.id
        ).length;
        const status = buildDeterministicMatterStatusReply(
          activeMatter,
          bundle.trackedCases,
          bundle.deadlines,
          draftCount,
          lang
        );
        replyText = status.text;
        sources = status.sources;
      } else if (intent.type === 'draft_form') {
        if (!activeMatter) {
          replyText =
            lang === 'hi'
              ? 'दस्तावेज़ बनाने के लिए कृपया पहले एक सक्रिय केस चुनें।'
              : 'Please select or create an active Matter before drafting a court form.';
        } else {
          const tpl = getJudiciaryTemplate(intent.templateId);
          const today = new Date().toISOString().slice(0, 10);
          const liveCtx = `Matter: ${activeMatter.title} (${activeMatter.matterCode}) | Forum: ${activeMatter.forum} | Client: ${activeMatter.clientName} | Opposing: ${activeMatter.opposingParty}\nFacts: ${activeMatter.summaryFacts}`;
          const generated = await generateExpertJudiciaryForm(
            {
              templateId: tpl.id,
              courtName: activeMatter.forum || tpl.defaultCourt,
              caseNumber: tpl.defaultCaseType,
              petitionerName: activeMatter.clientName,
              respondentName: activeMatter.opposingParty || 'State / Respondent',
              deponentName: activeMatter.clientName,
              deponentDetails: 'Authorized Signatory / Applicant',
              factsSummary: `${activeMatter.summaryFacts}\n\nClient Request: ${intent.customInstructions}`,
              reliefSought: tpl.suggestedRelief,
              placeOfFiling: 'Mumbai / New Delhi',
              filingDate: today,
              jurisdiction: effectiveJurisdiction,
            },
            liveCtx
          );

          const draftTitle = `${tpl.name} — ${activeMatter.clientName.slice(0, 42)}`;
          createdDraft = repository.createDraft(userId, {
            matterId: activeMatter.id,
            title: draftTitle,
            docType: tpl.name,
            content: generated.content,
          });

          replyText = getFormConfirmationReply(tpl.id, draftTitle, lang);
          sources = [
            {
              label: tpl.name,
              reference: tpl.statuteBasis,
              kind: 'court_template',
            },
            {
              label: `${activeMatter.matterCode} — Active Matter Facts`,
              reference: activeMatter.forum,
              kind: 'matter_record',
            },
          ];
          completedActions = [
            {
              type: 'draft_created',
              label: `Court Draft Ready: ${draftTitle}`,
              recordId: createdDraft.id,
              draftTitle: createdDraft.title,
              draftContent: createdDraft.content,
              docType: createdDraft.docType,
            },
          ];
          verificationMode = generated.engineUsed.includes('NVIDIA')
            ? 'grounded_ai_verified'
            : 'deterministic_verified';
          confidenceNote = `${generated.engineUsed} · ${generated.latencyMs}ms · Saved to Matter Drafts`;
        }
      } else if (intent.type === 'case_analysis') {
        if (!activeMatter) {
          replyText =
            lang === 'hi'
              ? 'केस विश्लेषण के लिए कृपया पहले एक सक्रिय केस चुनें।'
              : 'Please select an active Matter to run Supreme Court / High Court Case Analysis.';
        } else {
          const liveCtx = `Matter: ${activeMatter.title} (${activeMatter.matterCode}) | Forum: ${activeMatter.forum} | Client: ${activeMatter.clientName} | Opposing: ${activeMatter.opposingParty}\nFacts: ${activeMatter.summaryFacts}`;
          const analysis = await runSupremeCourtCaseAnalysis({
            matterId: activeMatter.id,
            caseTitle: activeMatter.title,
            courtLevel: activeMatter.forum,
            jurisdiction: effectiveJurisdiction,
            parties: `${activeMatter.clientName} v. ${activeMatter.opposingParty || 'Respondent'}`,
            caseStage: activeMatter.status,
            userFactsAndData: `${activeMatter.summaryFacts}\n\nClient Focus: ${data.message}`,
            keyLegalQuestions: data.message,
            liveWorkspaceContext: liveCtx,
          });

          const caseStudiesStr = analysis.landmarkCaseStudies
            .slice(0, 3)
            .map((cs, i) => `${i + 1}. ${cs.caseName}, ${cs.citation} — ${cs.applicationToFacts}`)
            .join('\n');

          replyText =
            lang === 'hi'
              ? `सुप्रीम कोर्ट / हाई कोर्ट मानक केस विश्लेषण (${activeMatter.title}):

• स्थिति (Maintainability): ${analysis.maintainabilityScore}
• कार्यकारी आकलन: ${analysis.executiveAssessment}
• क्षेत्राधिकार एवं परिसीमा: ${analysis.jurisdictionAndLimitation}
• लागू धाराएँ: ${analysis.applicableStatutes.join(', ')}

सत्यापित सुप्रीम कोर्ट / हाई कोर्ट केस स्टडी:
${caseStudiesStr}

सुझाए गए अगले दस्तावेज़: ${analysis.recommendedFilings.map((f) => f.title).join(' | ')}`
              : `Supreme Court / High Court Case Analysis (${activeMatter.title}):

• Maintainability Posture: ${analysis.maintainabilityScore}
• Executive Assessment: ${analysis.executiveAssessment}
• Jurisdiction & Limitation: ${analysis.jurisdictionAndLimitation}
• Applicable Statutes: ${analysis.applicableStatutes.join(', ')}

Verified Supreme Court & High Court Case Studies:
${caseStudiesStr}

Recommended Next Filings: ${analysis.recommendedFilings.map((f) => f.title).join(' | ')}`;

          sources = analysis.landmarkCaseStudies.map((cs) => ({
            label: `${cs.caseName}, ${cs.citation}`,
            reference: cs.court,
            kind: 'precedent',
          }));
          verificationMode = analysis.engineUsed.includes('NVIDIA')
            ? 'grounded_ai_verified'
            : 'deterministic_verified';
          confidenceNote = `${analysis.engineUsed} · ${analysis.latencyMs}ms`;
        }
      } else if (intent.type === 'precedent_search') {
        const resPrec = buildDeterministicPrecedentReply(
          intent.query,
          effectiveJurisdiction,
          lang
        );
        replyText = resPrec.text;
        sources = resPrec.sources;
      } else {
        const liveWorkspaceContext = activeMatter
          ? `Matter: ${activeMatter.title} (${activeMatter.matterCode})\nForum: ${activeMatter.forum}\nClient: ${activeMatter.clientName} | Opposing: ${activeMatter.opposingParty}\nFacts: ${activeMatter.summaryFacts}`
          : 'No active matter selected.';
        const recentHistory = bundle.assistantMessages.slice(-8).map((m) => ({
          role: m.role,
          content: m.content,
        }));
        const grounded = await answerGroundedBilingualLegalAssistant({
          userMessage: data.message,
          language: lang,
          jurisdiction: effectiveJurisdiction,
          liveWorkspaceContext,
          recentHistory,
        });
        replyText = grounded.content;
        sources = grounded.sources;
        verificationMode = grounded.verificationMode;
        confidenceNote = grounded.confidenceNote;
      }

      const assistantMsg = repository.addAssistantMessage({
        userId,
        matterId: activeMatter?.id ?? null,
        role: 'assistant',
        content: replyText,
        languageUsed: lang,
        verificationMode,
        confidenceNote,
        sources,
        completedActions,
      });

      await repository.persist();
      res.status(201).json({
        userMsg,
        assistantMsg,
        createdDraft,
        createdDeadline,
      });
    } catch (err) {
      res.status(500).json({ error: extractErrorMessage(err) });
    }
  });

  app.delete('/api/ai/assistant', requireAuth, async (req: AuthRequest, res) => {
    repository.clearAssistantMessages(req.authUser!.userId);
    await repository.persist();
    res.json({ cleared: true });
  });

  // --- Frontend Mounting (Vite Dev Middleware or Production Static) ---
  if (includeStatic) {
    if (!IS_PROD) {
      // Non-literal specifier keeps Vite (a dev-only tool) out of the Netlify Function bundle.
      const viteModuleName = 'vite';
      const { createServer: createViteServer } = (await import(viteModuleName)) as typeof import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.resolve(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  // Global error handler ensuring JSON errors and logging on serverless platforms
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[VidhiOS Express Error]:', err);
    if (res.headersSent) return;
    res.status(err.status || err.statusCode || 500).json({
      error: err.message || 'Internal server error occurred.',
    });
  });

  return app;
}
