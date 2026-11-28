import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type {
  ActivityLogItem,
  AdminUserSummary,
  AssistantMessage,
  AuditEventItem,
  ClientProfile,
  ContractReview,
  CorporateProfileRecord,
  CourtroomSession,
  CourtroomTurn,
  DeadlineItem,
  DraftDocument,
  EvidenceItemRecord,
  HearingRecord,
  JurisdictionMode,
  LitigationStrategyRecord,
  Matter,
  MatterTask,
  MeetingBrief,
  NotificationItem,
  Organization,
  OrganizationMember,
  OrganizationRole,
  RedlineClause,
  ResearchMemo,
  SubscriptionRecord,
  SubscriptionTier,
  TrackedCase,
  UserProfile,
  VaultDocument,
  WhatsAppMessage,
  WorkflowRunRecord,
  WorkspaceBundle,
} from '../types/legal';
import { hashPassword, isUserAdminRole, revokeSessionTokenId, verifyPassword } from './auth';
import { buildSeededWorkspace } from './seedData';
import {
  clearAssistantMessagesFromNeon,
  deleteMatterFromNeon,
  deleteUserFromNeon,
  initNeonSchema,
  isNeonConfigured,
  loadStoreFromNeon,
  persistStoreToNeon,
  type StoreState,
  type StoredUser,
} from './neonDatabase';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'vidhios-store.json');

export const TIER_LIMITS: Record<
  SubscriptionTier,
  { aiQueriesLimit: number; storageLimitMb: number; maxMatters: number; maxSeats: number }
> = {
  FREE: { aiQueriesLimit: 40, storageLimitMb: 100, maxMatters: 5, maxSeats: 1 },
  PRO: { aiQueriesLimit: 500, storageLimitMb: 2048, maxMatters: 100, maxSeats: 5 },
  CHAMBERS: { aiQueriesLimit: 2500, storageLimitMb: 10240, maxMatters: 500, maxSeats: 25 },
  ENTERPRISE: { aiQueriesLimit: 25000, storageLimitMb: 102400, maxMatters: 10000, maxSeats: 500 },
};

const EMPTY_STATE: StoreState = {
  organizations: [],
  organizationMembers: [],
  users: [],
  clients: [],
  matters: [],
  tasks: [],
  hearings: [],
  researchMemos: [],
  drafts: [],
  vaultDocuments: [],
  contractReviews: [],
  courtroomSessions: [],
  trackedCases: [],
  deadlines: [],
  meetingBriefs: [],
  whatsappMessages: [],
  assistantMessages: [],
  notifications: [],
  activityLogs: [],
  auditEvents: [],
  subscriptions: [],
  workflowRuns: [],
  corporateProfiles: [],
  evidenceItems: [],
  litigationStrategies: [],
  revokedTokens: [],
};

function makeSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  return `${base || 'chambers'}-${crypto.randomBytes(3).toString('hex')}`;
}

class WorkspaceRepository {
  private state: StoreState;
  private writeQueue: Promise<void> = Promise.resolve();
  public readonly engine: 'neon' | 'supabase' | 'local_durable';
  public readyPromise: Promise<void> | null = null;
  public lastPersistError: string | null = null;

  constructor() {
    this.state = this.loadState();
    if (isNeonConfigured()) {
      this.engine = 'neon';
      this.readyPromise = this.initNeonAsync();
    } else if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      this.engine = 'supabase';
      this.readyPromise = Promise.resolve();
      this.ensureDemoAccount();
      this.ensureDefaultAdminAccount();
      this.backfillTenancyAndSubscriptions();
    } else {
      this.engine = 'local_durable';
      this.readyPromise = Promise.resolve();
      this.ensureDemoAccount();
      this.ensureDefaultAdminAccount();
      this.backfillTenancyAndSubscriptions();
    }
  }

  public async ensureReady(forceReload = false): Promise<void> {
    if (this.readyPromise) {
      await this.readyPromise;
    }
    if (this.engine === 'neon' && forceReload) {
      const remote = await loadStoreFromNeon();
      if (remote && remote.users.length > 0) {
        this.state = remote;
        for (const rt of remote.revokedTokens) {
          revokeSessionTokenId(rt.jti, rt.expiresAt);
        }
        this.ensureDemoAccount();
        this.ensureDefaultAdminAccount();
        this.backfillTenancyAndSubscriptions();
      }
    }
  }

  private async initNeonAsync(): Promise<void> {
    try {
      await initNeonSchema();
      const remoteState = await loadStoreFromNeon();
      if (remoteState && remoteState.users.length > 0) {
        this.state = remoteState;
        for (const rt of remoteState.revokedTokens) {
          revokeSessionTokenId(rt.jti, rt.expiresAt);
        }
        this.ensureDemoAccount();
        this.ensureDefaultAdminAccount();
        this.backfillTenancyAndSubscriptions();
        await persistStoreToNeon(this.state);
        console.log('[Neon] Repository synchronized with remote Neon PostgreSQL.');
      } else {
        this.ensureDemoAccount();
        this.ensureDefaultAdminAccount();
        this.backfillTenancyAndSubscriptions();
        await persistStoreToNeon(this.state);
        console.log('[Neon] Initialized remote Neon PostgreSQL with chamber records.');
      }
    } catch (err) {
      this.lastPersistError = err instanceof Error ? err.message : 'Neon initialization failed';
      console.error('[Neon] Initialization error:', err);
    }
  }

  private loadState(): StoreState {
    try {
      if (fs.existsSync(STORE_PATH)) {
        const raw = fs.readFileSync(STORE_PATH, 'utf8');
        const parsed = JSON.parse(raw) as Partial<StoreState>;
        return {
          ...structuredClone(EMPTY_STATE),
          ...parsed,
        };
      }
    } catch (err) {
      console.error('Failed to read local durable store; initializing clean state:', err);
    }
    return structuredClone(EMPTY_STATE);
  }

  /**
   * Persists state durably. In Neon mode, Neon errors are NOT swallowed silently.
   */
  public async persist(): Promise<void> {
    const snapshot = JSON.stringify(this.state, null, 2);
    const task = this.writeQueue.then(async () => {
      if (this.engine === 'neon') {
        try {
          await persistStoreToNeon(this.state);
          this.lastPersistError = null;
        } catch (err) {
          this.lastPersistError = err instanceof Error ? err.message : 'Neon persistence failed';
          throw err;
        }
        return;
      }

      await fs.promises.mkdir(DATA_DIR, { recursive: true });
      const tmpPath = `${STORE_PATH}.${crypto.randomBytes(6).toString('hex')}.tmp`;
      await fs.promises.writeFile(tmpPath, snapshot, 'utf8');
      await fs.promises.rename(tmpPath, STORE_PATH);
      this.lastPersistError = null;
    });

    this.writeQueue = task.catch(() => {});
    await task;
  }

  private toPublicUser(u: StoredUser): UserProfile {
    const { passwordHash: _ignored, ...profile } = u;
    return profile;
  }

  private createOrganizationForUser(
    user: StoredUser,
    orgName: string,
    tier: SubscriptionTier = 'PRO',
    orgRole: OrganizationRole = 'owner'
  ): Organization {
    const now = new Date().toISOString();
    const org: Organization = {
      id: crypto.randomUUID(),
      name: orgName || `${user.fullName} Chambers`,
      slug: makeSlug(orgName || user.fullName),
      tier,
      createdAt: now,
    };
    this.state.organizations.push(org);
    user.organizationId = org.id;
    user.organization = org.name;
    user.orgRole = orgRole;

    this.state.organizationMembers.push({
      id: crypto.randomUUID(),
      organizationId: org.id,
      userId: user.id,
      role: orgRole,
      permissions:
        orgRole === 'client'
          ? ['matters:read', 'documents:read']
          : ['matters:all', 'drafts:all', 'research:all', 'vault:all', 'team:manage'],
      createdAt: now,
    });

    const limits = TIER_LIMITS[tier];
    this.state.subscriptions.push({
      id: crypto.randomUUID(),
      organizationId: org.id,
      tier,
      status: 'active',
      aiQueriesLimit: limits.aiQueriesLimit,
      aiQueriesUsed: 0,
      aiTokensUsed: 0,
      storageLimitMb: limits.storageLimitMb,
      storageUsedMb: 0,
      maxMatters: limits.maxMatters,
      maxSeats: limits.maxSeats,
      expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
      updatedAt: now,
    });

    return org;
  }

  private backfillTenancyAndSubscriptions(): void {
    for (const user of this.state.users) {
      if (!user.organizationId || !this.state.organizations.some((o) => o.id === user.organizationId)) {
        const existingByName = user.organization
          ? this.state.organizations.find((o) => o.name === user.organization)
          : undefined;
        if (existingByName) {
          user.organizationId = existingByName.id;
          user.orgRole = user.orgRole || 'advocate';
          if (
            !this.state.organizationMembers.some(
              (m) => m.organizationId === existingByName.id && m.userId === user.id
            )
          ) {
            this.state.organizationMembers.push({
              id: crypto.randomUUID(),
              organizationId: existingByName.id,
              userId: user.id,
              role: user.orgRole,
              permissions: ['matters:all', 'drafts:all', 'research:all', 'vault:all'],
              createdAt: new Date().toISOString(),
            });
          }
        } else {
          this.createOrganizationForUser(
            user,
            user.organization || `${user.fullName} Chambers`,
            user.email === 'chambers@vidhios.in' ? 'CHAMBERS' : 'PRO',
            'owner'
          );
        }
      }

      if (!this.state.subscriptions.some((s) => s.organizationId === user.organizationId)) {
        const limits = TIER_LIMITS.PRO;
        this.state.subscriptions.push({
          id: crypto.randomUUID(),
          organizationId: user.organizationId!,
          tier: 'PRO',
          status: 'active',
          aiQueriesLimit: limits.aiQueriesLimit,
          aiQueriesUsed: 0,
          aiTokensUsed: 0,
          storageLimitMb: limits.storageLimitMb,
          storageUsedMb: 0,
          maxMatters: limits.maxMatters,
          maxSeats: limits.maxSeats,
          expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }

    const userOrgMap = new Map(this.state.users.map((u) => [u.id, u.organizationId || '']));
    for (const m of this.state.matters) {
      if (!m.organizationId) {
        m.organizationId = userOrgMap.get(m.userId) || '';
      }
    }
    for (const r of this.state.researchMemos) {
      if (!r.organizationId) r.organizationId = userOrgMap.get(r.userId) || '';
    }
    for (const d of this.state.drafts) {
      if (!d.organizationId) d.organizationId = userOrgMap.get(d.userId) || '';
    }
    for (const v of this.state.vaultDocuments) {
      if (!v.organizationId) v.organizationId = userOrgMap.get(v.userId) || '';
      if (!v.processingStatus) v.processingStatus = 'completed';
    }
    for (const c of this.state.contractReviews) {
      if (!c.organizationId) c.organizationId = userOrgMap.get(c.userId) || '';
    }
  }

  private seedForUser(userId: string, organizationId?: string): void {
    const seeded = buildSeededWorkspace(userId);
    const orgId = organizationId || '';
    for (const m of seeded.matters) {
      m.organizationId = orgId;
      m.assignedUserIds = [userId];
    }
    for (const r of seeded.researchMemos) r.organizationId = orgId;
    for (const d of seeded.drafts) {
      d.organizationId = orgId;
      d.status = 'draft';
      d.versions = [
        {
          version: d.version,
          title: d.title,
          content: d.content,
          savedAt: d.updatedAt,
          savedBy: 'System Seed',
        },
      ];
    }
    for (const v of seeded.vaultDocuments) {
      v.organizationId = orgId;
      v.processingStatus = 'completed';
    }
    for (const c of seeded.contractReviews) c.organizationId = orgId;

    this.state.matters.push(...seeded.matters);
    this.state.researchMemos.push(...seeded.researchMemos);
    this.state.drafts.push(...seeded.drafts);
    this.state.vaultDocuments.push(...seeded.vaultDocuments);
    this.state.contractReviews.push(...seeded.contractReviews);
    this.state.courtroomSessions.push(...seeded.courtroomSessions);
    this.state.trackedCases.push(...seeded.trackedCases);
    this.state.deadlines.push(...seeded.deadlines);
    this.state.meetingBriefs.push(...seeded.meetingBriefs);
    this.state.whatsappMessages.push(...seeded.whatsappMessages);

    // Seed starter client & task for the primary matter
    if (seeded.matters[0] && orgId) {
      const m0 = seeded.matters[0];
      this.state.clients.push({
        id: crypto.randomUUID(),
        organizationId: orgId,
        userId,
        name: m0.clientName,
        email: 'vikram@apexinfratech.in',
        phone: '+91 98201 44120',
        company: 'Apex InfraTech Pvt. Ltd.',
        address: 'Nariman Point, Mumbai 400021',
        notes: 'Primary litigation client for Bombay High Court anticipatory bail & arbitration.',
        portalAccessEnabled: false,
        createdAt: new Date().toISOString(),
      });
      this.state.tasks.push({
        id: crypto.randomUUID(),
        organizationId: orgId,
        matterId: m0.id,
        userId,
        assignedToUserId: userId,
        assignedToName: 'Lead Counsel',
        title: 'Finalize Section 63 BSA Hash Certificate & Annexure Index',
        priority: 'high',
        status: 'in_progress',
        dueDate: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
        createdAt: new Date().toISOString(),
      });
      this.state.notifications.push({
        id: crypto.randomUUID(),
        organizationId: orgId,
        userId,
        title: 'Upcoming Hearing Reminder',
        message: `${m0.matterCode} (${m0.title}) has upcoming High Court listing.`,
        kind: 'hearing',
        read: false,
        linkSection: 'cases',
        createdAt: new Date().toISOString(),
      });
    }
  }

  private ensureDemoAccount(): StoredUser {
    const demoEmail = 'chambers@vidhios.in';
    const existing = this.state.users.find((u) => u.email === demoEmail);
    if (existing) {
      // Demo account MUST NOT have admin privileges
      if (existing.isAdmin) {
        existing.isAdmin = false;
      }
      if (!existing.organizationId) {
        this.createOrganizationForUser(
          existing,
          existing.organization || 'Deshmukh & Associates Chambers',
          'CHAMBERS',
          'owner'
        );
      }
      return existing;
    }

    const demoUser: StoredUser = {
      id: crypto.randomUUID(),
      email: demoEmail,
      fullName: 'Adv. Meera Deshmukh',
      role: 'Managing Partner',
      organization: 'Deshmukh & Associates Chambers',
      orgRole: 'owner',
      defaultJurisdiction: 'india_litigation',
      isAdmin: false,
      passwordHash: hashPassword(crypto.randomBytes(24).toString('hex')),
      createdAt: new Date().toISOString(),
    };
    this.createOrganizationForUser(demoUser, demoUser.organization, 'CHAMBERS', 'owner');
    this.state.users.push(demoUser);
    this.seedForUser(demoUser.id, demoUser.organizationId);
    return demoUser;
  }

  private ensureDefaultAdminAccount(): StoredUser | null {
    const adminEmail = 'vidhios@admin.com';
    const existing = this.state.users.find((u) => u.email === adminEmail);
    if (existing) {
      // Never overwrite an existing admin's password on boot
      if (!existing.isAdmin) existing.isAdmin = true;
      if (!existing.organizationId) {
        this.createOrganizationForUser(
          existing,
          existing.organization || 'VidhiOS Judiciary Chambers',
          'ENTERPRISE',
          'admin'
        );
      }
      return existing;
    }

    const bootstrapPw = (process.env.ADMIN_BOOTSTRAP_PASSWORD || '').trim();
    if (process.env.NODE_ENV === 'production' && !bootstrapPw) {
      console.warn(
        '[VidhiOS Security] ADMIN_BOOTSTRAP_PASSWORD not set; skipping automatic creation of default admin user in production.'
      );
      return null;
    }

    const initialPassword = bootstrapPw || 'Vidhios@2026';
    const adminUser: StoredUser = {
      id: crypto.randomUUID(),
      email: adminEmail,
      fullName: 'VidhiOS Administrator',
      role: 'Principal Legal Administrator',
      organization: 'VidhiOS Judiciary Chambers',
      orgRole: 'admin',
      defaultJurisdiction: 'india_litigation',
      isAdmin: true,
      passwordHash: hashPassword(initialPassword),
      createdAt: new Date().toISOString(),
    };
    this.createOrganizationForUser(adminUser, adminUser.organization, 'ENTERPRISE', 'admin');
    this.state.users.push(adminUser);
    this.seedForUser(adminUser.id, adminUser.organizationId);
    return adminUser;
  }

  public getDemoUser(): UserProfile {
    return this.toPublicUser(this.ensureDemoAccount());
  }

  public async registerUser(input: {
    email: string;
    password: string;
    fullName: string;
    organization?: string;
    role?: string;
    defaultJurisdiction?: JurisdictionMode;
  }): Promise<UserProfile> {
    await this.ensureReady();
    const normalizedEmail = input.email.trim().toLowerCase();
    if (this.state.users.some((u) => u.email === normalizedEmail)) {
      throw new Error('An account with this email already exists.');
    }

    const user: StoredUser = {
      id: crypto.randomUUID(),
      email: normalizedEmail,
      fullName: input.fullName.trim(),
      role: input.role?.trim() || 'Advocate',
      organization: input.organization?.trim() || 'Independent Chambers',
      orgRole: 'owner',
      defaultJurisdiction: input.defaultJurisdiction ?? 'india_litigation',
      isAdmin: false,
      passwordHash: hashPassword(input.password),
      createdAt: new Date().toISOString(),
    };
    this.createOrganizationForUser(user, user.organization, 'FREE', 'owner');
    this.state.users.push(user);
    this.seedForUser(user.id, user.organizationId);
    await this.persist();
    return this.toPublicUser(user);
  }

  public async authenticateUser(email: string, password: string): Promise<UserProfile | null> {
    await this.ensureReady();
    const normalizedEmail = email.trim().toLowerCase();
    let user = this.state.users.find((u) => u.email === normalizedEmail);
    if (!user && this.engine === 'neon') {
      await this.ensureReady(true);
      user = this.state.users.find((u) => u.email === normalizedEmail);
    }
    if (!user) return null;
    if (!verifyPassword(password, user.passwordHash)) return null;
    return this.toPublicUser(user);
  }

  public async revokeToken(jti: string, expiresAt: number): Promise<void> {
    revokeSessionTokenId(jti, expiresAt);
    if (!this.state.revokedTokens.some((t) => t.jti === jti)) {
      this.state.revokedTokens.push({ jti, expiresAt });
    }
    const now = Date.now();
    this.state.revokedTokens = this.state.revokedTokens.filter((t) => t.expiresAt > now);
    await this.persist();
  }

  public async getUserById(userId: string): Promise<UserProfile | null> {
    await this.ensureReady();
    let user = this.state.users.find((u) => u.id === userId);
    if (!user && this.engine === 'neon') {
      await this.ensureReady(true);
      user = this.state.users.find((u) => u.id === userId);
    }
    return user ? this.toPublicUser(user) : null;
  }

  public getAllUsers(scopeOrgId?: string): AdminUserSummary[] {
    const list = scopeOrgId
      ? this.state.users.filter((u) => u.organizationId === scopeOrgId)
      : this.state.users;
    return list.map((u) => ({
      ...this.toPublicUser(u),
      mattersCount: this.state.matters.filter((m) => m.userId === u.id).length,
      draftsCount: this.state.drafts.filter((d) => d.userId === u.id).length,
      vaultCount: this.state.vaultDocuments.filter((v) => v.userId === u.id).length,
    }));
  }

  public getAllOrganizations(): Array<Organization & { membersCount: number; subscription?: SubscriptionRecord }> {
    return this.state.organizations.map((org) => ({
      ...org,
      membersCount: this.state.organizationMembers.filter((m) => m.organizationId === org.id).length,
      subscription: this.state.subscriptions.find((s) => s.organizationId === org.id),
    }));
  }

  public async adminCreateUser(input: {
    email: string;
    password: string;
    fullName: string;
    organization?: string;
    organizationId?: string;
    role?: string;
    orgRole?: OrganizationRole;
    defaultJurisdiction?: JurisdictionMode;
    isAdmin?: boolean;
  }): Promise<UserProfile> {
    await this.ensureReady();
    const normalizedEmail = input.email.trim().toLowerCase();
    if (this.state.users.some((u) => u.email === normalizedEmail)) {
      throw new Error('An account with this email already exists.');
    }

    const orgRole = input.orgRole ?? (input.isAdmin ? 'admin' : 'advocate');
    const user: StoredUser = {
      id: crypto.randomUUID(),
      email: normalizedEmail,
      fullName: input.fullName.trim(),
      role: input.role?.trim() || 'Advocate',
      organization: input.organization?.trim() || 'Independent Chambers',
      orgRole,
      defaultJurisdiction: input.defaultJurisdiction ?? 'india_litigation',
      isAdmin: Boolean(input.isAdmin),
      passwordHash: hashPassword(input.password),
      createdAt: new Date().toISOString(),
    };

    const targetOrg = input.organizationId
      ? this.state.organizations.find((o) => o.id === input.organizationId)
      : undefined;

    if (targetOrg) {
      user.organizationId = targetOrg.id;
      user.organization = targetOrg.name;
      this.state.organizationMembers.push({
        id: crypto.randomUUID(),
        organizationId: targetOrg.id,
        userId: user.id,
        role: orgRole,
        permissions:
          orgRole === 'client'
            ? ['matters:read', 'documents:read']
            : ['matters:all', 'drafts:all', 'research:all', 'vault:all'],
        createdAt: new Date().toISOString(),
      });
    } else {
      this.createOrganizationForUser(user, user.organization, 'PRO', orgRole);
    }

    this.state.users.push(user);
    await this.persist();
    return this.toPublicUser(user);
  }

  public async adminUpdateUser(
    userId: string,
    input: {
      fullName?: string;
      organization?: string;
      role?: string;
      orgRole?: OrganizationRole;
      defaultJurisdiction?: JurisdictionMode;
      isAdmin?: boolean;
    }
  ): Promise<UserProfile> {
    await this.ensureReady();
    const user = this.state.users.find((u) => u.id === userId);
    if (!user) throw new Error('User not found.');
    if (input.fullName !== undefined) user.fullName = input.fullName.trim();
    if (input.organization !== undefined) user.organization = input.organization.trim();
    if (input.role !== undefined) user.role = input.role.trim();
    if (input.orgRole !== undefined) user.orgRole = input.orgRole;
    if (input.defaultJurisdiction !== undefined) user.defaultJurisdiction = input.defaultJurisdiction;
    if (input.isAdmin !== undefined) user.isAdmin = Boolean(input.isAdmin);
    await this.persist();
    return this.toPublicUser(user);
  }

  public async adminResetPassword(userId: string, newPassword: string): Promise<void> {
    await this.ensureReady();
    const user = this.state.users.find((u) => u.id === userId);
    if (!user) throw new Error('User not found.');
    if (!newPassword || newPassword.length < 8) {
      throw new Error('Password must be at least 8 characters.');
    }
    user.passwordHash = hashPassword(newPassword);
    await this.persist();
  }

  public async adminDeleteUser(userId: string): Promise<void> {
    await this.ensureReady();
    const index = this.state.users.findIndex((u) => u.id === userId);
    if (index === -1) throw new Error('User not found.');

    this.state.users.splice(index, 1);
    this.state.organizationMembers = this.state.organizationMembers.filter((m) => m.userId !== userId);
    this.state.matters = this.state.matters.filter((m) => m.userId !== userId);
    this.state.researchMemos = this.state.researchMemos.filter((r) => r.userId !== userId);
    this.state.drafts = this.state.drafts.filter((d) => d.userId !== userId);
    this.state.vaultDocuments = this.state.vaultDocuments.filter((v) => v.userId !== userId);
    this.state.contractReviews = this.state.contractReviews.filter((c) => c.userId !== userId);
    this.state.courtroomSessions = this.state.courtroomSessions.filter((s) => s.userId !== userId);
    this.state.trackedCases = this.state.trackedCases.filter((t) => t.userId !== userId);
    this.state.deadlines = this.state.deadlines.filter((d) => d.userId !== userId);
    this.state.meetingBriefs = this.state.meetingBriefs.filter((mb) => mb.userId !== userId);
    this.state.whatsappMessages = this.state.whatsappMessages.filter((w) => w.userId !== userId);
    this.state.assistantMessages = this.state.assistantMessages.filter((a) => a.userId !== userId);
    this.state.tasks = this.state.tasks.filter((t) => t.userId !== userId);
    this.state.hearings = this.state.hearings.filter((h) => h.userId !== userId);
    this.state.notifications = this.state.notifications.filter((n) => n.userId !== userId);
    this.state.evidenceItems = this.state.evidenceItems.filter((e) => e.userId !== userId);
    this.state.litigationStrategies = this.state.litigationStrategies.filter((l) => l.userId !== userId);

    if (this.engine === 'neon') {
      await deleteUserFromNeon(userId);
    }
    await this.persist();
  }

  public canUserAccessMatter(userId: string, matter: Matter, write = false): boolean {
    const user = this.state.users.find((u) => u.id === userId);
    if (!user) return false;
    // Strict organization isolation
    const sameOrg = Boolean(
      user.organizationId && matter.organizationId && user.organizationId === matter.organizationId
    );
    const isOwner = matter.userId === userId;
    const isAssigned = Boolean(matter.assignedUserIds?.includes(userId));
    if (!isOwner && !(sameOrg && (user.orgRole !== 'client' || isAssigned))) {
      return false;
    }
    if (write && user.orgRole === 'client') {
      return false;
    }
    return true;
  }

  public getMatterForUser(userId: string, matterId: string, write = false): Matter | undefined {
    const matter = this.state.matters.find((m) => m.id === matterId);
    if (!matter) return undefined;
    return this.canUserAccessMatter(userId, matter, write) ? matter : undefined;
  }

  public getSubscriptionForOrg(orgId: string): SubscriptionRecord | undefined {
    return this.state.subscriptions.find((s) => s.organizationId === orgId);
  }

  public checkAiQuota(userId: string): { allowed: boolean; reason?: string; subscription?: SubscriptionRecord } {
    const user = this.state.users.find((u) => u.id === userId);
    if (!user || !user.organizationId) return { allowed: true };
    const sub = this.getSubscriptionForOrg(user.organizationId);
    if (!sub) return { allowed: true };
    if (sub.status !== 'active' && sub.status !== 'trialing') {
      return { allowed: false, reason: 'Organization subscription is inactive.', subscription: sub };
    }
    if (new Date(sub.expiresAt).getTime() < Date.now()) {
      return { allowed: false, reason: 'Organization subscription has expired.', subscription: sub };
    }
    if (sub.aiQueriesUsed >= sub.aiQueriesLimit) {
      return {
        allowed: false,
        reason: `Monthly AI query limit (${sub.aiQueriesLimit}) reached for ${sub.tier} plan. Upgrade in Settings or Admin.`,
        subscription: sub,
      };
    }
    return { allowed: true, subscription: sub };
  }

  public recordAiUsage(userId: string, tokensUsed: number): void {
    const user = this.state.users.find((u) => u.id === userId);
    if (!user?.organizationId) return;
    const sub = this.getSubscriptionForOrg(user.organizationId);
    if (!sub) return;
    sub.aiQueriesUsed += 1;
    sub.aiTokensUsed += Math.max(0, Math.round(tokensUsed));
    sub.updatedAt = new Date().toISOString();
  }

  public async updateSubscriptionTier(
    orgId: string,
    tier: SubscriptionTier
  ): Promise<SubscriptionRecord> {
    await this.ensureReady();
    const org = this.state.organizations.find((o) => o.id === orgId);
    if (!org) throw new Error('Organization not found.');
    org.tier = tier;
    const limits = TIER_LIMITS[tier];
    let sub = this.getSubscriptionForOrg(orgId);
    const now = new Date().toISOString();
    if (!sub) {
      sub = {
        id: crypto.randomUUID(),
        organizationId: orgId,
        tier,
        status: 'active',
        ...limits,
        aiQueriesUsed: 0,
        aiTokensUsed: 0,
        storageUsedMb: 0,
        expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
        updatedAt: now,
      };
      this.state.subscriptions.push(sub);
    } else {
      sub.tier = tier;
      sub.aiQueriesLimit = limits.aiQueriesLimit;
      sub.storageLimitMb = limits.storageLimitMb;
      sub.maxMatters = limits.maxMatters;
      sub.maxSeats = limits.maxSeats;
      sub.updatedAt = now;
    }
    await this.persist();
    return sub;
  }

  public logActivity(input: Omit<ActivityLogItem, 'id' | 'createdAt'>): ActivityLogItem {
    const entry: ActivityLogItem = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.state.activityLogs.unshift(entry);
    if (this.state.activityLogs.length > 500) {
      this.state.activityLogs = this.state.activityLogs.slice(0, 500);
    }
    return entry;
  }

  public logAuditEvent(input: Omit<AuditEventItem, 'id' | 'createdAt'>): AuditEventItem {
    const entry: AuditEventItem = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.state.auditEvents.unshift(entry);
    if (this.state.auditEvents.length > 500) {
      this.state.auditEvents = this.state.auditEvents.slice(0, 500);
    }
    return entry;
  }

  public getAuditEvents(orgId?: string): AuditEventItem[] {
    if (!orgId) return this.state.auditEvents.slice(0, 150);
    return this.state.auditEvents.filter((e) => e.organizationId === orgId).slice(0, 150);
  }

  public addNotification(input: Omit<NotificationItem, 'id' | 'createdAt'>): NotificationItem {
    const item: NotificationItem = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.state.notifications.unshift(item);
    return item;
  }

  public markNotificationRead(userId: string, notificationId: string): NotificationItem | null {
    const item = this.state.notifications.find(
      (n) => n.id === notificationId && n.userId === userId
    );
    if (!item) return null;
    item.read = true;
    return item;
  }

  public async getWorkspaceBundle(userId: string): Promise<WorkspaceBundle | null> {
    await this.ensureReady();
    let user = this.state.users.find((u) => u.id === userId);
    if (!user && this.engine === 'neon') {
      await this.ensureReady(true);
      user = this.state.users.find((u) => u.id === userId);
    }
    if (!user) return null;

    const orgId = user.organizationId || '';
    const organization = this.state.organizations.find((o) => o.id === orgId);
    const organizationMembers = this.state.organizationMembers
      .filter((m) => m.organizationId === orgId)
      .map((m) => {
        const u = this.state.users.find((usr) => usr.id === m.userId);
        return {
          ...m,
          fullName: u?.fullName || 'Member',
          email: u?.email || '',
        };
      });

    const accessibleMatters = this.state.matters
      .filter((m) => this.canUserAccessMatter(userId, m, false))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const accessibleMatterIds = new Set(accessibleMatters.map((m) => m.id));

    return {
      user: this.toPublicUser(user),
      organization,
      organizationMembers,
      matters: accessibleMatters,
      clients: this.state.clients
        .filter((c) => c.organizationId === orgId || c.userId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      tasks: this.state.tasks
        .filter((t) => accessibleMatterIds.has(t.matterId) || t.userId === userId)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
      hearings: this.state.hearings
        .filter((h) => accessibleMatterIds.has(h.matterId) || h.userId === userId)
        .sort((a, b) => b.hearingDate.localeCompare(a.hearingDate)),
      researchMemos: this.state.researchMemos
        .filter((r) => accessibleMatterIds.has(r.matterId) || r.userId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      drafts: this.state.drafts
        .filter((d) => accessibleMatterIds.has(d.matterId) || d.userId === userId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      vaultDocuments: this.state.vaultDocuments
        .filter((v) => accessibleMatterIds.has(v.matterId) || v.userId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      contractReviews: this.state.contractReviews
        .filter((c) => accessibleMatterIds.has(c.matterId) || c.userId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      courtroomSessions: this.state.courtroomSessions
        .filter((s) => accessibleMatterIds.has(s.matterId) || s.userId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      trackedCases: this.state.trackedCases
        .filter((tc) => accessibleMatterIds.has(tc.matterId) || tc.userId === userId)
        .sort((a, b) => a.nextHearingDate.localeCompare(b.nextHearingDate)),
      deadlines: this.state.deadlines
        .filter((dl) => accessibleMatterIds.has(dl.matterId) || dl.userId === userId)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
      meetingBriefs: this.state.meetingBriefs
        .filter((mb) => accessibleMatterIds.has(mb.matterId) || mb.userId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      whatsappMessages: this.state.whatsappMessages
        .filter((w) => w.userId === userId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      assistantMessages: this.state.assistantMessages
        .filter((a) => a.userId === userId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      notifications: this.state.notifications
        .filter((n) => n.userId === userId)
        .slice(0, 40),
      activityLogs: this.state.activityLogs
        .filter((al) => al.organizationId === orgId || al.userId === userId)
        .slice(0, 40),
      subscription: this.getSubscriptionForOrg(orgId),
      workflowRuns: this.state.workflowRuns
        .filter((wr) => wr.organizationId === orgId || wr.userId === userId)
        .slice(0, 30),
      corporateProfiles: this.state.corporateProfiles
        .filter((cp) => cp.organizationId === orgId || cp.userId === userId)
        .slice(0, 30),
      evidenceItems: this.state.evidenceItems
        .filter((ev) => accessibleMatterIds.has(ev.matterId) || ev.userId === userId),
      litigationStrategies: this.state.litigationStrategies
        .filter((ls) => accessibleMatterIds.has(ls.matterId) || ls.userId === userId),
      storageEngine: this.engine,
    };
  }

  public createMatter(
    userId: string,
    input: Omit<Matter, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ): Matter {
    const user = this.state.users.find((u) => u.id === userId);
    const now = new Date().toISOString();
    const matter: Matter = {
      ...input,
      id: crypto.randomUUID(),
      userId,
      organizationId: user?.organizationId || '',
      assignedUserIds: input.assignedUserIds ?? [userId],
      createdAt: now,
      updatedAt: now,
    };
    this.state.matters.unshift(matter);
    if (user) {
      this.logActivity({
        organizationId: user.organizationId || '',
        userId,
        actorName: user.fullName,
        matterId: matter.id,
        action: 'created',
        entityType: 'matter',
        entityId: matter.id,
        summary: `Opened matter ${matter.matterCode}: ${matter.title}`,
      });
    }
    return matter;
  }

  public updateMatter(
    userId: string,
    matterId: string,
    updates: Partial<Pick<Matter, 'title' | 'status' | 'forum' | 'opposingParty' | 'summaryFacts' | 'cnrNumber' | 'caseType' | 'assignedAdvocate' | 'filingDate' | 'clientName'>>
  ): Matter | null {
    const matter = this.getMatterForUser(userId, matterId, true);
    if (!matter) return null;
    Object.assign(matter, updates, { updatedAt: new Date().toISOString() });
    return matter;
  }

  public async deleteMatter(userId: string, matterId: string): Promise<boolean> {
    const matter = this.getMatterForUser(userId, matterId, true);
    if (!matter) return false;
    this.state.matters = this.state.matters.filter((m) => m.id !== matterId);
    this.state.researchMemos = this.state.researchMemos.filter((r) => r.matterId !== matterId);
    this.state.drafts = this.state.drafts.filter((d) => d.matterId !== matterId);
    this.state.vaultDocuments = this.state.vaultDocuments.filter((v) => v.matterId !== matterId);
    this.state.contractReviews = this.state.contractReviews.filter((c) => c.matterId !== matterId);
    this.state.courtroomSessions = this.state.courtroomSessions.filter((s) => s.matterId !== matterId);
    this.state.trackedCases = this.state.trackedCases.filter((tc) => tc.matterId !== matterId);
    this.state.deadlines = this.state.deadlines.filter((dl) => dl.matterId !== matterId);
    this.state.meetingBriefs = this.state.meetingBriefs.filter((mb) => mb.matterId !== matterId);
    this.state.tasks = this.state.tasks.filter((t) => t.matterId !== matterId);
    this.state.hearings = this.state.hearings.filter((h) => h.matterId !== matterId);
    this.state.evidenceItems = this.state.evidenceItems.filter((e) => e.matterId !== matterId);
    this.state.litigationStrategies = this.state.litigationStrategies.filter((l) => l.matterId !== matterId);
    if (this.engine === 'neon') {
      await deleteMatterFromNeon(matterId);
    }
    await this.persist();
    return true;
  }

  public addClient(input: Omit<ClientProfile, 'id' | 'createdAt'>): ClientProfile {
    const created: ClientProfile = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.state.clients.unshift(created);
    return created;
  }

  public addTask(input: Omit<MatterTask, 'id' | 'createdAt'>): MatterTask {
    const created: MatterTask = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.state.tasks.unshift(created);
    return created;
  }

  public updateTaskStatus(
    userId: string,
    taskId: string,
    status: MatterTask['status']
  ): MatterTask | null {
    const task = this.state.tasks.find((t) => t.id === taskId);
    if (!task) return null;
    if (!this.getMatterForUser(userId, task.matterId, true)) return null;
    task.status = status;
    return task;
  }

  public addHearing(input: Omit<HearingRecord, 'id' | 'createdAt'>): HearingRecord {
    const created: HearingRecord = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.state.hearings.unshift(created);
    return created;
  }

  public addResearchMemo(memo: Omit<ResearchMemo, 'id' | 'createdAt'>): ResearchMemo {
    const user = this.state.users.find((u) => u.id === memo.userId);
    const created: ResearchMemo = {
      ...memo,
      organizationId: memo.organizationId || user?.organizationId || '',
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.state.researchMemos.unshift(created);
    if (user) {
      this.logActivity({
        organizationId: user.organizationId || '',
        userId: user.id,
        actorName: user.fullName,
        matterId: memo.matterId,
        action: 'researched',
        entityType: 'research_memo',
        entityId: created.id,
        summary: `Generated legal research memo: ${memo.query.slice(0, 80)}`,
      });
    }
    return created;
  }

  public createDraft(
    userId: string,
    input: { matterId: string; title: string; docType: string; content: string; status?: DraftDocument['status'] }
  ): DraftDocument {
    const user = this.state.users.find((u) => u.id === userId);
    const now = new Date().toISOString();
    const created: DraftDocument = {
      id: crypto.randomUUID(),
      userId,
      organizationId: user?.organizationId || '',
      matterId: input.matterId,
      title: input.title,
      docType: input.docType,
      content: input.content,
      status: input.status ?? 'draft',
      version: 1,
      versions: [
        {
          version: 1,
          title: input.title,
          content: input.content,
          savedAt: now,
          savedBy: user?.fullName || 'Counsel',
        },
      ],
      updatedAt: now,
    };
    this.state.drafts.unshift(created);
    if (user) {
      this.logActivity({
        organizationId: user.organizationId || '',
        userId,
        actorName: user.fullName,
        matterId: input.matterId,
        action: 'drafted',
        entityType: 'draft',
        entityId: created.id,
        summary: `Created draft "${created.title}"`,
      });
    }
    return created;
  }

  public updateDraft(
    userId: string,
    draftId: string,
    updates: { title?: string; content?: string; status?: DraftDocument['status'] }
  ): DraftDocument | null {
    const draft = this.state.drafts.find((d) => d.id === draftId);
    if (!draft || !this.getMatterForUser(userId, draft.matterId, true)) return null;
    const user = this.state.users.find((u) => u.id === userId);
    if (updates.title !== undefined) draft.title = updates.title;
    if (updates.content !== undefined) draft.content = updates.content;
    if (updates.status !== undefined) draft.status = updates.status;
    draft.version += 1;
    draft.updatedAt = new Date().toISOString();
    draft.versions = [
      {
        version: draft.version,
        title: draft.title,
        content: draft.content,
        savedAt: draft.updatedAt,
        savedBy: user?.fullName || 'Counsel',
      },
      ...(draft.versions ?? []),
    ].slice(0, 20);
    return draft;
  }

  public addVaultDocument(doc: Omit<VaultDocument, 'id' | 'createdAt'>): VaultDocument {
    const user = this.state.users.find((u) => u.id === doc.userId);
    const created: VaultDocument = {
      ...doc,
      organizationId: doc.organizationId || user?.organizationId || '',
      processingStatus: doc.processingStatus || 'completed',
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.state.vaultDocuments.unshift(created);
    if (user && doc.fileSizeBytes) {
      const sub = this.getSubscriptionForOrg(user.organizationId || '');
      if (sub) {
        sub.storageUsedMb = Number((sub.storageUsedMb + doc.fileSizeBytes / (1024 * 1024)).toFixed(2));
      }
    }
    return created;
  }

  public updateVaultDocument(
    userId: string,
    docId: string,
    updates: Partial<
      Pick<
        VaultDocument,
        | 'extractedText'
        | 'translatedText'
        | 'chronology'
        | 'contradictions'
        | 'entities'
        | 'processingStatus'
        | 'processingError'
      >
    >
  ): VaultDocument | null {
    const doc = this.state.vaultDocuments.find((d) => d.id === docId);
    if (!doc || !this.getMatterForUser(userId, doc.matterId, true)) return null;
    Object.assign(doc, updates);
    return doc;
  }

  public addContractReview(review: Omit<ContractReview, 'id' | 'createdAt'>): ContractReview {
    const user = this.state.users.find((u) => u.id === review.userId);
    const created: ContractReview = {
      ...review,
      organizationId: review.organizationId || user?.organizationId || '',
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.state.contractReviews.unshift(created);
    return created;
  }

  public updateRedlineClauseDecision(
    userId: string,
    reviewId: string,
    clauseId: string,
    decision: RedlineClause['decision']
  ): ContractReview | null {
    const review = this.state.contractReviews.find((c) => c.id === reviewId);
    if (!review || !this.getMatterForUser(userId, review.matterId, true)) return null;
    const clause = review.clauses.find((cl) => cl.id === clauseId);
    if (!clause) return null;
    clause.decision = decision;
    return review;
  }

  public createCourtroomSession(
    session: Omit<CourtroomSession, 'id' | 'createdAt'>
  ): CourtroomSession {
    const created: CourtroomSession = {
      ...session,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.state.courtroomSessions.unshift(created);
    return created;
  }

  public appendCourtroomTurns(
    userId: string,
    sessionId: string,
    newTurns: CourtroomTurn[],
    newVulnerabilities?: string[]
  ): CourtroomSession | null {
    const session = this.state.courtroomSessions.find((s) => s.id === sessionId);
    if (!session || !this.getMatterForUser(userId, session.matterId, true)) return null;
    session.turns.push(...newTurns);
    if (newVulnerabilities && newVulnerabilities.length > 0) {
      session.vulnerabilities = Array.from(new Set([...session.vulnerabilities, ...newVulnerabilities]));
    }
    return session;
  }

  public addTrackedCase(item: Omit<TrackedCase, 'id' | 'createdAt'>): TrackedCase {
    const created: TrackedCase = {
      ...item,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.state.trackedCases.push(created);
    return created;
  }

  public updateTrackedCaseStatus(
    userId: string,
    caseId: string,
    status: TrackedCase['status']
  ): TrackedCase | null {
    const item = this.state.trackedCases.find((tc) => tc.id === caseId);
    if (!item || !this.getMatterForUser(userId, item.matterId, true)) return null;
    item.status = status;
    return item;
  }

  public addDeadline(item: Omit<DeadlineItem, 'id' | 'createdAt'>): DeadlineItem {
    const created: DeadlineItem = {
      ...item,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.state.deadlines.push(created);
    return created;
  }

  public toggleDeadline(userId: string, deadlineId: string): DeadlineItem | null {
    const item = this.state.deadlines.find((d) => d.id === deadlineId);
    if (!item || !this.getMatterForUser(userId, item.matterId, true)) return null;
    item.completed = !item.completed;
    return item;
  }

  public addMeetingBrief(brief: Omit<MeetingBrief, 'id' | 'createdAt'>): MeetingBrief {
    const created: MeetingBrief = {
      ...brief,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.state.meetingBriefs.unshift(created);
    return created;
  }

  public addWhatsAppMessage(msg: Omit<WhatsAppMessage, 'id' | 'createdAt'>): WhatsAppMessage {
    const created: WhatsAppMessage = {
      ...msg,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.state.whatsappMessages.push(created);
    return created;
  }

  public addAssistantMessage(
    msg: Omit<AssistantMessage, 'id' | 'createdAt'>
  ): AssistantMessage {
    const created: AssistantMessage = {
      ...msg,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.state.assistantMessages.push(created);
    const userMsgs = this.state.assistantMessages.filter((m) => m.userId === msg.userId);
    if (userMsgs.length > 120) {
      const oldestId = userMsgs[0].id;
      this.state.assistantMessages = this.state.assistantMessages.filter((m) => m.id !== oldestId);
    }
    return created;
  }

  public async clearAssistantMessages(userId: string): Promise<void> {
    this.state.assistantMessages = this.state.assistantMessages.filter((m) => m.userId !== userId);
    if (this.engine === 'neon') {
      await clearAssistantMessagesFromNeon(userId);
    }
    await this.persist();
  }

  public addWorkflowRun(run: Omit<WorkflowRunRecord, 'id' | 'createdAt'>): WorkflowRunRecord {
    const created: WorkflowRunRecord = {
      ...run,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.state.workflowRuns.unshift(created);
    return created;
  }

  public approveWorkflowRun(userId: string, runId: string): WorkflowRunRecord | null {
    const user = this.state.users.find((u) => u.id === userId);
    const run = this.state.workflowRuns.find(
      (r) => r.id === runId && (r.userId === userId || (user?.organizationId && r.organizationId === user.organizationId))
    );
    if (!run) return null;
    run.status = 'completed';
    run.approvedByUserId = userId;
    for (const s of run.steps) {
      if (s.status === 'awaiting_approval') s.status = 'completed';
    }
    return run;
  }

  public addCorporateProfile(profile: Omit<CorporateProfileRecord, 'id' | 'createdAt'>): CorporateProfileRecord {
    const created: CorporateProfileRecord = {
      ...profile,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.state.corporateProfiles.unshift(created);
    return created;
  }

  public addEvidenceItem(item: Omit<EvidenceItemRecord, 'id' | 'createdAt'>): EvidenceItemRecord {
    const created: EvidenceItemRecord = {
      ...item,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.state.evidenceItems.unshift(created);
    return created;
  }

  public upsertLitigationStrategy(
    input: Omit<LitigationStrategyRecord, 'id' | 'updatedAt'>
  ): LitigationStrategyRecord {
    const now = new Date().toISOString();
    const existing = this.state.litigationStrategies.find((l) => l.matterId === input.matterId);
    if (existing) {
      Object.assign(existing, input, { updatedAt: now });
      return existing;
    }
    const created: LitigationStrategyRecord = {
      ...input,
      id: crypto.randomUUID(),
      updatedAt: now,
    };
    this.state.litigationStrategies.unshift(created);
    return created;
  }

  public getSystemCounts() {
    return {
      organizations: this.state.organizations.length,
      users: this.state.users.length,
      matters: this.state.matters.length,
      drafts: this.state.drafts.length,
      vaultDocuments: this.state.vaultDocuments.length,
      failedVaultJobs: this.state.vaultDocuments.filter((v) => v.processingStatus === 'failed').length,
      queuedVaultJobs: this.state.vaultDocuments.filter(
        (v) => v.processingStatus === 'queued' || v.processingStatus === 'processing'
      ).length,
      workflowRuns: this.state.workflowRuns.length,
      auditEvents: this.state.auditEvents.length,
    };
  }
}

export const repository = new WorkspaceRepository();
export { isUserAdminRole };
