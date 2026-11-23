import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type {
  AdminUserSummary,
  AssistantMessage,
  ContractReview,
  CourtroomSession,
  CourtroomTurn,
  DeadlineItem,
  DraftDocument,
  JurisdictionMode,
  Matter,
  MeetingBrief,
  RedlineClause,
  ResearchMemo,
  TrackedCase,
  UserProfile,
  VaultDocument,
  WhatsAppMessage,
  WorkspaceBundle,
} from '../types/legal';
import { hashPassword, verifyPassword } from './auth';
import { buildSeededWorkspace } from './seedData';
import {
  initNeonSchema,
  isNeonConfigured,
  loadStoreFromNeon,
  persistStoreToNeon,
} from './neonDatabase';

interface StoredUser extends UserProfile {
  passwordHash: string;
}

interface StoreState {
  users: StoredUser[];
  matters: Matter[];
  researchMemos: ResearchMemo[];
  drafts: DraftDocument[];
  vaultDocuments: VaultDocument[];
  contractReviews: ContractReview[];
  courtroomSessions: CourtroomSession[];
  trackedCases: TrackedCase[];
  deadlines: DeadlineItem[];
  meetingBriefs: MeetingBrief[];
  whatsappMessages: WhatsAppMessage[];
  assistantMessages: AssistantMessage[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'vidhios-store.json');

const EMPTY_STATE: StoreState = {
  users: [],
  matters: [],
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
};

class WorkspaceRepository {
  private state: StoreState;
  private writeQueue: Promise<void> = Promise.resolve();
  public readonly engine: 'neon' | 'supabase' | 'local_durable';

  constructor() {
    this.state = this.loadState();
    if (isNeonConfigured()) {
      this.engine = 'neon';
      this.initNeonAsync();
    } else if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      this.engine = 'supabase';
    } else {
      this.engine = 'local_durable';
    }
    this.ensureDemoAccount();
    this.ensureDefaultAdminAccount();
  }

  private async initNeonAsync(): Promise<void> {
    try {
      await initNeonSchema();
      const remoteState = await loadStoreFromNeon();
      if (remoteState && remoteState.users.length > 0) {
        this.state = remoteState;
        this.ensureDemoAccount();
        this.ensureDefaultAdminAccount();
        console.log('[Neon] Repository synchronized with remote Neon PostgreSQL.');
      } else {
        this.ensureDefaultAdminAccount();
        await persistStoreToNeon(this.state);
        console.log('[Neon] Initialized remote Neon PostgreSQL with chamber records.');
      }
    } catch (err) {
      console.error('[Neon] Background sync error:', err);
    }
  }

  private loadState(): StoreState {
    try {
      if (fs.existsSync(STORE_PATH)) {
        const raw = fs.readFileSync(STORE_PATH, 'utf8');
        const parsed = JSON.parse(raw) as Partial<StoreState>;
        return {
          users: parsed.users ?? [],
          matters: parsed.matters ?? [],
          researchMemos: parsed.researchMemos ?? [],
          drafts: parsed.drafts ?? [],
          vaultDocuments: parsed.vaultDocuments ?? [],
          contractReviews: parsed.contractReviews ?? [],
          courtroomSessions: parsed.courtroomSessions ?? [],
          trackedCases: parsed.trackedCases ?? [],
          deadlines: parsed.deadlines ?? [],
          meetingBriefs: parsed.meetingBriefs ?? [],
          whatsappMessages: parsed.whatsappMessages ?? [],
          assistantMessages: parsed.assistantMessages ?? [],
        };
      }
    } catch (err) {
      console.error('Failed to read local durable store; initializing clean state:', err);
    }
    return structuredClone(EMPTY_STATE);
  }

  private persist(): void {
    const snapshot = JSON.stringify(this.state, null, 2);
    this.writeQueue = this.writeQueue
      .then(async () => {
        await fs.promises.mkdir(DATA_DIR, { recursive: true });
        const tmpPath = `${STORE_PATH}.${crypto.randomBytes(6).toString('hex')}.tmp`;
        await fs.promises.writeFile(tmpPath, snapshot, 'utf8');
        await fs.promises.rename(tmpPath, STORE_PATH);
        if (this.engine === 'neon') {
          persistStoreToNeon(this.state).catch((e) =>
            console.error('[Neon] Auto-persist error:', e)
          );
        }
      })
      .catch((err) => {
        console.error('Failed to persist store:', err);
      });
  }

  private toPublicUser(u: StoredUser): UserProfile {
    const { passwordHash: _ignored, ...profile } = u;
    return profile;
  }

  private seedForUser(userId: string): void {
    const seeded = buildSeededWorkspace(userId);
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
  }

  private ensureDemoAccount(): StoredUser {
    const demoEmail = 'chambers@vidhios.in';
    const existing = this.state.users.find((u) => u.email === demoEmail);
    if (existing) {
      if (!existing.isAdmin) {
        existing.isAdmin = true;
        this.persist();
      }
      return existing;
    }

    const demoUser: StoredUser = {
      id: crypto.randomUUID(),
      email: demoEmail,
      fullName: 'Adv. Meera Deshmukh',
      role: 'Managing Partner',
      organization: 'Deshmukh & Associates Chambers',
      defaultJurisdiction: 'india_litigation',
      isAdmin: true,
      // Ephemeral strong server-only hash; accessed exclusively via explicit /api/auth/demo quick-start
      passwordHash: hashPassword(crypto.randomBytes(24).toString('hex')),
      createdAt: new Date().toISOString(),
    };
    this.state.users.push(demoUser);
    this.seedForUser(demoUser.id);
    this.persist();
    return demoUser;
  }

  private ensureDefaultAdminAccount(): StoredUser {
    const adminEmail = 'vidhios@admin.com';
    const existing = this.state.users.find((u) => u.email === adminEmail);
    if (existing) {
      let changed = false;
      if (!existing.isAdmin) {
        existing.isAdmin = true;
        changed = true;
      }
      if (!verifyPassword('Vidhios@2026', existing.passwordHash)) {
        existing.passwordHash = hashPassword('Vidhios@2026');
        changed = true;
      }
      if (changed) {
        this.persist();
      }
      return existing;
    }

    const adminUser: StoredUser = {
      id: crypto.randomUUID(),
      email: adminEmail,
      fullName: 'VidhiOS Administrator',
      role: 'Principal Legal Administrator',
      organization: 'VidhiOS Judiciary Chambers',
      defaultJurisdiction: 'india_litigation',
      isAdmin: true,
      passwordHash: hashPassword('Vidhios@2026'),
      createdAt: new Date().toISOString(),
    };
    this.state.users.push(adminUser);
    this.seedForUser(adminUser.id);
    this.persist();
    return adminUser;
  }

  public getDemoUser(): UserProfile {
    return this.toPublicUser(this.ensureDemoAccount());
  }

  public registerUser(input: {
    email: string;
    password: string;
    fullName: string;
    organization?: string;
    role?: string;
    defaultJurisdiction?: JurisdictionMode;
  }): UserProfile {
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
      defaultJurisdiction: input.defaultJurisdiction ?? 'india_litigation',
      passwordHash: hashPassword(input.password),
      createdAt: new Date().toISOString(),
    };
    this.state.users.push(user);
    this.seedForUser(user.id);
    this.persist();
    return this.toPublicUser(user);
  }

  public authenticateUser(email: string, password: string): UserProfile | null {
    const normalizedEmail = email.trim().toLowerCase();
    const user = this.state.users.find((u) => u.email === normalizedEmail);
    if (!user) return null;
    if (!verifyPassword(password, user.passwordHash)) return null;
    return this.toPublicUser(user);
  }

  public getUserById(userId: string): UserProfile | null {
    const user = this.state.users.find((u) => u.id === userId);
    return user ? this.toPublicUser(user) : null;
  }

  public getAllUsers(): AdminUserSummary[] {
    return this.state.users.map((u) => ({
      ...this.toPublicUser(u),
      mattersCount: this.state.matters.filter((m) => m.userId === u.id).length,
      draftsCount: this.state.drafts.filter((d) => d.userId === u.id).length,
      vaultCount: this.state.vaultDocuments.filter((v) => v.userId === u.id).length,
    }));
  }

  public adminCreateUser(input: {
    email: string;
    password: string;
    fullName: string;
    organization?: string;
    role?: string;
    defaultJurisdiction?: JurisdictionMode;
    isAdmin?: boolean;
  }): UserProfile {
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
      defaultJurisdiction: input.defaultJurisdiction ?? 'india_litigation',
      isAdmin: Boolean(input.isAdmin),
      passwordHash: hashPassword(input.password),
      createdAt: new Date().toISOString(),
    };
    this.state.users.push(user);
    this.persist();
    return this.toPublicUser(user);
  }

  public adminUpdateUser(
    userId: string,
    input: {
      fullName?: string;
      organization?: string;
      role?: string;
      defaultJurisdiction?: JurisdictionMode;
      isAdmin?: boolean;
    }
  ): UserProfile {
    const user = this.state.users.find((u) => u.id === userId);
    if (!user) {
      throw new Error('User not found.');
    }
    if (input.fullName !== undefined) user.fullName = input.fullName.trim();
    if (input.organization !== undefined) user.organization = input.organization.trim();
    if (input.role !== undefined) user.role = input.role.trim();
    if (input.defaultJurisdiction !== undefined) user.defaultJurisdiction = input.defaultJurisdiction;
    if (input.isAdmin !== undefined) user.isAdmin = Boolean(input.isAdmin);
    this.persist();
    return this.toPublicUser(user);
  }

  public adminResetPassword(userId: string, newPassword: string): void {
    const user = this.state.users.find((u) => u.id === userId);
    if (!user) {
      throw new Error('User not found.');
    }
    if (!newPassword || newPassword.length < 8) {
      throw new Error('Password must be at least 8 characters.');
    }
    user.passwordHash = hashPassword(newPassword);
    this.persist();
  }

  public adminDeleteUser(userId: string): void {
    const index = this.state.users.findIndex((u) => u.id === userId);
    if (index === -1) {
      throw new Error('User not found.');
    }
    this.state.users.splice(index, 1);
    this.state.matters = this.state.matters.filter((m) => m.userId !== userId);
    this.state.researchMemos = this.state.researchMemos.filter((r) => r.userId !== userId);
    this.state.drafts = this.state.drafts.filter((d) => d.userId !== userId);
    this.state.vaultDocuments = this.state.vaultDocuments.filter((v) => v.userId !== userId);
    this.state.contractReviews = this.state.contractReviews.filter((c) => c.userId !== userId);
    this.state.courtroomSessions = this.state.courtroomSessions.filter((s) => s.userId !== userId);
    this.state.trackedCases = this.state.trackedCases.filter((t) => t.userId !== userId);
    this.state.deadlines = this.state.deadlines.filter((d) => d.userId !== userId);
    this.state.assistantMessages = this.state.assistantMessages.filter((a) => a.userId !== userId);
    this.persist();
  }

  public getWorkspaceBundle(userId: string): WorkspaceBundle | null {
    const user = this.getUserById(userId);
    if (!user) return null;
    return {
      user,
      matters: this.state.matters
        .filter((m) => m.userId === userId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      researchMemos: this.state.researchMemos
        .filter((r) => r.userId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      drafts: this.state.drafts
        .filter((d) => d.userId === userId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      vaultDocuments: this.state.vaultDocuments
        .filter((v) => v.userId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      contractReviews: this.state.contractReviews
        .filter((c) => c.userId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      courtroomSessions: this.state.courtroomSessions
        .filter((s) => s.userId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      trackedCases: this.state.trackedCases
        .filter((tc) => tc.userId === userId)
        .sort((a, b) => a.nextHearingDate.localeCompare(b.nextHearingDate)),
      deadlines: this.state.deadlines
        .filter((dl) => dl.userId === userId)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
      meetingBriefs: this.state.meetingBriefs
        .filter((mb) => mb.userId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      whatsappMessages: this.state.whatsappMessages
        .filter((w) => w.userId === userId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      assistantMessages: this.state.assistantMessages
        .filter((a) => a.userId === userId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      storageEngine: this.engine,
    };
  }

  public getMatterForUser(userId: string, matterId: string): Matter | undefined {
    return this.state.matters.find((m) => m.id === matterId && m.userId === userId);
  }

  public createMatter(
    userId: string,
    input: Omit<Matter, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ): Matter {
    const now = new Date().toISOString();
    const matter: Matter = {
      ...input,
      id: crypto.randomUUID(),
      userId,
      createdAt: now,
      updatedAt: now,
    };
    this.state.matters.unshift(matter);
    this.persist();
    return matter;
  }

  public deleteMatter(userId: string, matterId: string): boolean {
    const exists = this.state.matters.some((m) => m.id === matterId && m.userId === userId);
    if (!exists) return false;
    this.state.matters = this.state.matters.filter((m) => !(m.id === matterId && m.userId === userId));
    this.state.researchMemos = this.state.researchMemos.filter((r) => r.matterId !== matterId);
    this.state.drafts = this.state.drafts.filter((d) => d.matterId !== matterId);
    this.state.vaultDocuments = this.state.vaultDocuments.filter((v) => v.matterId !== matterId);
    this.state.contractReviews = this.state.contractReviews.filter((c) => c.matterId !== matterId);
    this.state.courtroomSessions = this.state.courtroomSessions.filter((s) => s.matterId !== matterId);
    this.state.trackedCases = this.state.trackedCases.filter((tc) => tc.matterId !== matterId);
    this.state.deadlines = this.state.deadlines.filter((dl) => dl.matterId !== matterId);
    this.state.meetingBriefs = this.state.meetingBriefs.filter((mb) => mb.matterId !== matterId);
    this.persist();
    return true;
  }

  public addResearchMemo(memo: Omit<ResearchMemo, 'id' | 'createdAt'>): ResearchMemo {
    const created: ResearchMemo = {
      ...memo,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.state.researchMemos.unshift(created);
    this.persist();
    return created;
  }

  public createDraft(
    userId: string,
    input: { matterId: string; title: string; docType: string; content: string }
  ): DraftDocument {
    const created: DraftDocument = {
      id: crypto.randomUUID(),
      userId,
      matterId: input.matterId,
      title: input.title,
      docType: input.docType,
      content: input.content,
      version: 1,
      updatedAt: new Date().toISOString(),
    };
    this.state.drafts.unshift(created);
    this.persist();
    return created;
  }

  public updateDraft(
    userId: string,
    draftId: string,
    updates: { title?: string; content?: string }
  ): DraftDocument | null {
    const draft = this.state.drafts.find((d) => d.id === draftId && d.userId === userId);
    if (!draft) return null;
    if (updates.title !== undefined) draft.title = updates.title;
    if (updates.content !== undefined) draft.content = updates.content;
    draft.version += 1;
    draft.updatedAt = new Date().toISOString();
    this.persist();
    return draft;
  }

  public addVaultDocument(doc: Omit<VaultDocument, 'id' | 'createdAt'>): VaultDocument {
    const created: VaultDocument = {
      ...doc,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.state.vaultDocuments.unshift(created);
    this.persist();
    return created;
  }

  public addContractReview(review: Omit<ContractReview, 'id' | 'createdAt'>): ContractReview {
    const created: ContractReview = {
      ...review,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.state.contractReviews.unshift(created);
    this.persist();
    return created;
  }

  public updateRedlineClauseDecision(
    userId: string,
    reviewId: string,
    clauseId: string,
    decision: RedlineClause['decision']
  ): ContractReview | null {
    const review = this.state.contractReviews.find((c) => c.id === reviewId && c.userId === userId);
    if (!review) return null;
    const clause = review.clauses.find((cl) => cl.id === clauseId);
    if (!clause) return null;
    clause.decision = decision;
    this.persist();
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
    this.persist();
    return created;
  }

  public appendCourtroomTurns(
    userId: string,
    sessionId: string,
    newTurns: CourtroomTurn[],
    newVulnerabilities?: string[]
  ): CourtroomSession | null {
    const session = this.state.courtroomSessions.find((s) => s.id === sessionId && s.userId === userId);
    if (!session) return null;
    session.turns.push(...newTurns);
    if (newVulnerabilities && newVulnerabilities.length > 0) {
      session.vulnerabilities = Array.from(new Set([...session.vulnerabilities, ...newVulnerabilities]));
    }
    this.persist();
    return session;
  }

  public addTrackedCase(item: Omit<TrackedCase, 'id' | 'createdAt'>): TrackedCase {
    const created: TrackedCase = {
      ...item,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.state.trackedCases.push(created);
    this.persist();
    return created;
  }

  public updateTrackedCaseStatus(
    userId: string,
    caseId: string,
    status: TrackedCase['status']
  ): TrackedCase | null {
    const item = this.state.trackedCases.find((tc) => tc.id === caseId && tc.userId === userId);
    if (!item) return null;
    item.status = status;
    this.persist();
    return item;
  }

  public addDeadline(item: Omit<DeadlineItem, 'id' | 'createdAt'>): DeadlineItem {
    const created: DeadlineItem = {
      ...item,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.state.deadlines.push(created);
    this.persist();
    return created;
  }

  public toggleDeadline(userId: string, deadlineId: string): DeadlineItem | null {
    const item = this.state.deadlines.find((d) => d.id === deadlineId && d.userId === userId);
    if (!item) return null;
    item.completed = !item.completed;
    this.persist();
    return item;
  }

  public addMeetingBrief(brief: Omit<MeetingBrief, 'id' | 'createdAt'>): MeetingBrief {
    const created: MeetingBrief = {
      ...brief,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.state.meetingBriefs.unshift(created);
    this.persist();
    return created;
  }

  public addWhatsAppMessage(msg: Omit<WhatsAppMessage, 'id' | 'createdAt'>): WhatsAppMessage {
    const created: WhatsAppMessage = {
      ...msg,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.state.whatsappMessages.push(created);
    this.persist();
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
    // Keep per-user history bounded to latest 120 turns
    const userMsgs = this.state.assistantMessages.filter((m) => m.userId === msg.userId);
    if (userMsgs.length > 120) {
      const oldestId = userMsgs[0].id;
      this.state.assistantMessages = this.state.assistantMessages.filter((m) => m.id !== oldestId);
    }
    this.persist();
    return created;
  }

  public clearAssistantMessages(userId: string): void {
    this.state.assistantMessages = this.state.assistantMessages.filter(
      (m) => m.userId !== userId
    );
    this.persist();
  }
}

export const repository = new WorkspaceRepository();
