import { Pool, type PoolClient } from 'pg';
import type {
  ActivityLogItem,
  AssistantMessage,
  AuditEventItem,
  ClientProfile,
  ContractReview,
  CorporateProfileRecord,
  CourtroomSession,
  DeadlineItem,
  DraftDocument,
  EvidenceItemRecord,
  HearingRecord,
  LitigationStrategyRecord,
  Matter,
  MatterTask,
  MeetingBrief,
  NotificationItem,
  Organization,
  OrganizationMember,
  ResearchMemo,
  SubscriptionRecord,
  TrackedCase,
  UserProfile,
  VaultDocument,
  WhatsAppMessage,
  WorkflowRunRecord,
} from '../types/legal';

export interface StoredUser extends UserProfile {
  passwordHash: string;
}

export interface RevokedTokenEntry {
  jti: string;
  expiresAt: number;
}

export interface StoreState {
  organizations: Organization[];
  organizationMembers: OrganizationMember[];
  users: StoredUser[];
  clients: ClientProfile[];
  matters: Matter[];
  tasks: MatterTask[];
  hearings: HearingRecord[];
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
  notifications: NotificationItem[];
  activityLogs: ActivityLogItem[];
  auditEvents: AuditEventItem[];
  subscriptions: SubscriptionRecord[];
  workflowRuns: WorkflowRunRecord[];
  corporateProfiles: CorporateProfileRecord[];
  evidenceItems: EvidenceItemRecord[];
  litigationStrategies: LitigationStrategyRecord[];
  revokedTokens: RevokedTokenEntry[];
}

let activePool: Pool | null = null;
let resolvedHostIp: string | null = null;
let lastDbError: string | null = null;
let lastDbSyncAt: string | null = null;

export function getNeonHealthSnapshot() {
  return {
    lastDbError,
    lastDbSyncAt,
  };
}

export function getNeonConnectionString(): string {
  const url = (process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || '').trim();
  if (
    !url ||
    url === 'MY_DATABASE_URL' ||
    url === 'MY_NEON_DATABASE_URL' ||
    url === 'postgresql://...'
  ) {
    return '';
  }
  return url;
}

export function isNeonConfigured(): boolean {
  return Boolean(getNeonConnectionString());
}

/**
 * Resolves Neon host IP via DNS-over-HTTPS (DoH) if local ISP/router blocks or refuses UDP port 53.
 */
async function resolveHostViaDoH(hostname: string): Promise<string | null> {
  if (resolvedHostIp) return resolvedHostIp;
  if (
    process.env.NETLIFY ||
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.NODE_ENV === 'production'
  ) {
    return null;
  }
  try {
    const res = await fetch(
      `https://dns.google/resolve?name=${encodeURIComponent(hostname)}&type=A`,
      {
        headers: { Accept: 'application/dns-json' },
        signal: AbortSignal.timeout(2000),
      }
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { Answer?: Array<{ type: number; data: string }> };
    const ip = json.Answer?.find((a) => a.type === 1)?.data;
    if (ip) {
      resolvedHostIp = ip;
      return ip;
    }
  } catch {
    // Non-fatal fallback to system DNS
  }
  return null;
}

export async function getNeonPool(): Promise<Pool | null> {
  const connectionString = getNeonConnectionString();
  if (!connectionString) return null;
  if (activePool) return activePool;

  try {
    const parsed = new URL(connectionString);
    const hostname = parsed.hostname;
    const ip = await resolveHostViaDoH(hostname);

    activePool = new Pool({
      host: ip || hostname,
      port: Number(parsed.port) || 5432,
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database: parsed.pathname.replace(/^\//, '') || 'neondb',
      ssl: {
        servername: hostname,
        rejectUnauthorized: process.env.PG_ALLOW_SELF_SIGNED === 'true' ? false : true,
      },
      max: 12,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 8000,
    });

    activePool.on('error', (err) => {
      lastDbError = err.message;
      console.error('[Neon Pool Error]:', err.message);
    });

    return activePool;
  } catch (err) {
    lastDbError = err instanceof Error ? err.message : 'Neon pool init failed';
    console.error('[Neon Pool Init Failed]:', err);
    return null;
  }
}

export async function testNeonConnection(): Promise<{
  ok: boolean;
  version?: string;
  latencyMs?: number;
  database?: string;
  error?: string;
  lastDbSyncAt?: string | null;
}> {
  const startedAt = Date.now();
  const pool = await getNeonPool();
  if (!pool) {
    return { ok: false, error: 'DATABASE_URL or NEON_DATABASE_URL is not configured.' };
  }

  let client: PoolClient | null = null;
  try {
    client = await pool.connect();
    const res = await client.query(
      'SELECT version() as version, current_database() as db, now() as current_time;'
    );
    lastDbError = null;
    return {
      ok: true,
      version: res.rows[0]?.version || 'PostgreSQL (Neon Serverless)',
      database: res.rows[0]?.db || 'neondb',
      latencyMs: Date.now() - startedAt,
      lastDbSyncAt,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to connect to Neon database.';
    lastDbError = msg;
    return {
      ok: false,
      error: msg,
      latencyMs: Date.now() - startedAt,
      lastDbSyncAt,
    };
  } finally {
    client?.release();
  }
}

let schemaInitialized = false;

/**
 * Provisions and safely migrates all VidhiOS multi-tenant PostgreSQL tables & indexes in Neon.
 */
export async function initNeonSchema(force = false): Promise<void> {
  if (schemaInitialized && !force) return;
  const pool = await getNeonPool();
  if (!pool) return;

  let client: PoolClient | null = null;
  try {
    client = await pool.connect();
    await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');

    await client.query(`
      CREATE TABLE IF NOT EXISTS organizations (
        id text PRIMARY KEY,
        name text NOT NULL,
        slug text NOT NULL UNIQUE,
        tier text NOT NULL DEFAULT 'PRO',
        created_at text NOT NULL
      );

      CREATE TABLE IF NOT EXISTS organization_members (
        id text PRIMARY KEY,
        organization_id text NOT NULL,
        user_id text NOT NULL,
        role text NOT NULL DEFAULT 'advocate',
        permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
        created_at text NOT NULL
      );

      CREATE TABLE IF NOT EXISTS users (
        id text PRIMARY KEY,
        email text NOT NULL UNIQUE,
        full_name text NOT NULL,
        role text NOT NULL DEFAULT 'Advocate',
        organization text DEFAULT '',
        organization_id text DEFAULT '',
        org_role text NOT NULL DEFAULT 'advocate',
        default_jurisdiction text NOT NULL DEFAULT 'india_litigation',
        is_admin boolean DEFAULT false,
        password_hash text NOT NULL,
        created_at text NOT NULL
      );

      CREATE TABLE IF NOT EXISTS clients (
        id text PRIMARY KEY,
        organization_id text NOT NULL,
        user_id text NOT NULL,
        name text NOT NULL,
        email text DEFAULT '',
        phone text DEFAULT '',
        company text DEFAULT '',
        address text DEFAULT '',
        pan_or_cin text DEFAULT '',
        notes text DEFAULT '',
        portal_access_enabled boolean NOT NULL DEFAULT false,
        created_at text NOT NULL
      );

      CREATE TABLE IF NOT EXISTS matters (
        id text PRIMARY KEY,
        user_id text NOT NULL,
        organization_id text DEFAULT '',
        client_id text DEFAULT '',
        assigned_user_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
        title text NOT NULL,
        matter_code text NOT NULL,
        client_name text NOT NULL,
        opposing_party text DEFAULT '',
        jurisdiction text NOT NULL DEFAULT 'india_litigation',
        forum text NOT NULL,
        case_type text DEFAULT '',
        cnr_number text DEFAULT '',
        filing_date text DEFAULT '',
        assigned_advocate text DEFAULT '',
        status text NOT NULL DEFAULT 'active',
        summary_facts text DEFAULT '',
        created_at text NOT NULL,
        updated_at text NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id text PRIMARY KEY,
        organization_id text NOT NULL,
        matter_id text NOT NULL,
        user_id text NOT NULL,
        assigned_to_user_id text DEFAULT '',
        assigned_to_name text DEFAULT '',
        title text NOT NULL,
        priority text NOT NULL DEFAULT 'medium',
        status text NOT NULL DEFAULT 'todo',
        due_date text NOT NULL,
        created_at text NOT NULL
      );

      CREATE TABLE IF NOT EXISTS hearings (
        id text PRIMARY KEY,
        organization_id text NOT NULL,
        matter_id text NOT NULL,
        tracked_case_id text DEFAULT '',
        user_id text NOT NULL,
        hearing_date text NOT NULL,
        court text NOT NULL,
        courtroom text DEFAULT '',
        bench text DEFAULT '',
        cause_list_item text DEFAULT '',
        outcome text NOT NULL DEFAULT 'scheduled',
        next_hearing_date text DEFAULT '',
        adjournment_reason text DEFAULT '',
        notes text DEFAULT '',
        created_at text NOT NULL
      );

      CREATE TABLE IF NOT EXISTS research_memos (
        id text PRIMARY KEY,
        matter_id text NOT NULL,
        user_id text NOT NULL,
        organization_id text DEFAULT '',
        query text NOT NULL,
        jurisdiction text NOT NULL,
        filters jsonb NOT NULL DEFAULT '{}'::jsonb,
        answer_markdown text NOT NULL,
        citations jsonb NOT NULL DEFAULT '[]'::jsonb,
        citation_integrity jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at text NOT NULL
      );

      CREATE TABLE IF NOT EXISTS drafts (
        id text PRIMARY KEY,
        matter_id text NOT NULL,
        user_id text NOT NULL,
        organization_id text DEFAULT '',
        title text NOT NULL,
        doc_type text NOT NULL,
        content text NOT NULL,
        status text NOT NULL DEFAULT 'draft',
        version integer NOT NULL DEFAULT 1,
        versions jsonb NOT NULL DEFAULT '[]'::jsonb,
        updated_at text NOT NULL
      );

      CREATE TABLE IF NOT EXISTS vault_documents (
        id text PRIMARY KEY,
        matter_id text NOT NULL,
        user_id text NOT NULL,
        organization_id text DEFAULT '',
        file_name text NOT NULL,
        mime_type text NOT NULL,
        file_size_bytes integer DEFAULT 0,
        doc_category text NOT NULL DEFAULT 'Annexure',
        processing_status text NOT NULL DEFAULT 'completed',
        processing_error text DEFAULT '',
        extracted_text text DEFAULT '',
        translated_text text DEFAULT '',
        target_language text DEFAULT '',
        entities jsonb NOT NULL DEFAULT '{}'::jsonb,
        chronology jsonb NOT NULL DEFAULT '[]'::jsonb,
        contradictions jsonb NOT NULL DEFAULT '[]'::jsonb,
        created_at text NOT NULL
      );

      CREATE TABLE IF NOT EXISTS contract_reviews (
        id text PRIMARY KEY,
        matter_id text NOT NULL,
        user_id text NOT NULL,
        organization_id text DEFAULT '',
        title text NOT NULL,
        playbook text NOT NULL,
        source_text text NOT NULL,
        summary text DEFAULT '',
        clauses jsonb NOT NULL DEFAULT '[]'::jsonb,
        requisitions jsonb NOT NULL DEFAULT '[]'::jsonb,
        obligations jsonb NOT NULL DEFAULT '[]'::jsonb,
        renewal_date text DEFAULT '',
        termination_notice_date text DEFAULT '',
        created_at text NOT NULL
      );

      CREATE TABLE IF NOT EXISTS courtroom_sessions (
        id text PRIMARY KEY,
        matter_id text NOT NULL,
        user_id text NOT NULL,
        mode text NOT NULL,
        forum_context text NOT NULL,
        brief_excerpt text NOT NULL,
        turns jsonb NOT NULL DEFAULT '[]'::jsonb,
        vulnerabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
        created_at text NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tracked_cases (
        id text PRIMARY KEY,
        matter_id text NOT NULL,
        user_id text NOT NULL,
        case_number text NOT NULL,
        court text NOT NULL,
        courtroom text DEFAULT '',
        bench text DEFAULT '',
        cause_list_item text DEFAULT '',
        next_hearing_date text NOT NULL,
        stage text NOT NULL,
        notes text DEFAULT '',
        cnr_number text DEFAULT '',
        status text NOT NULL DEFAULT 'listed',
        created_at text NOT NULL,
        updated_at text NOT NULL
      );

      CREATE TABLE IF NOT EXISTS deadlines (
        id text PRIMARY KEY,
        matter_id text NOT NULL,
        user_id text NOT NULL,
        title text NOT NULL,
        statute_article text DEFAULT '',
        trigger_date text NOT NULL,
        due_date text NOT NULL,
        grace_date text,
        completed boolean NOT NULL DEFAULT false,
        notes text DEFAULT '',
        created_at text NOT NULL
      );

      CREATE TABLE IF NOT EXISTS meeting_briefs (
        id text PRIMARY KEY,
        matter_id text NOT NULL,
        user_id text NOT NULL,
        title text NOT NULL,
        duration_label text NOT NULL DEFAULT '05:00',
        transcript text NOT NULL,
        summary text NOT NULL,
        key_facts jsonb NOT NULL DEFAULT '[]'::jsonb,
        action_items jsonb NOT NULL DEFAULT '[]'::jsonb,
        statutory_issues jsonb NOT NULL DEFAULT '[]'::jsonb,
        created_at text NOT NULL
      );

      CREATE TABLE IF NOT EXISTS whatsapp_messages (
        id text PRIMARY KEY,
        matter_id text,
        user_id text NOT NULL,
        sender text NOT NULL,
        body text NOT NULL,
        command_tag text DEFAULT '',
        created_at text NOT NULL
      );

      CREATE TABLE IF NOT EXISTS assistant_messages (
        id text PRIMARY KEY,
        user_id text NOT NULL,
        matter_id text,
        role text NOT NULL,
        content text NOT NULL,
        language_used text NOT NULL DEFAULT 'en',
        verification_mode text NOT NULL DEFAULT 'deterministic_verified',
        confidence_note text DEFAULT '',
        sources jsonb NOT NULL DEFAULT '[]'::jsonb,
        completed_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
        created_at text NOT NULL
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id text PRIMARY KEY,
        organization_id text NOT NULL,
        user_id text NOT NULL,
        title text NOT NULL,
        message text NOT NULL,
        kind text NOT NULL DEFAULT 'system',
        read boolean NOT NULL DEFAULT false,
        link_section text DEFAULT 'overview',
        created_at text NOT NULL
      );

      CREATE TABLE IF NOT EXISTS activity_logs (
        id text PRIMARY KEY,
        organization_id text NOT NULL,
        user_id text NOT NULL,
        actor_name text NOT NULL,
        matter_id text DEFAULT '',
        action text NOT NULL,
        entity_type text NOT NULL,
        entity_id text DEFAULT '',
        summary text NOT NULL,
        created_at text NOT NULL
      );

      CREATE TABLE IF NOT EXISTS audit_events (
        id text PRIMARY KEY,
        organization_id text NOT NULL,
        user_id text NOT NULL,
        actor_email text NOT NULL,
        event_type text NOT NULL,
        resource_type text NOT NULL,
        resource_id text DEFAULT '',
        ip_address text DEFAULT '',
        status text NOT NULL DEFAULT 'success',
        details text DEFAULT '',
        created_at text NOT NULL
      );

      CREATE TABLE IF NOT EXISTS subscriptions (
        id text PRIMARY KEY,
        organization_id text NOT NULL UNIQUE,
        tier text NOT NULL DEFAULT 'PRO',
        status text NOT NULL DEFAULT 'active',
        ai_queries_limit integer NOT NULL DEFAULT 500,
        ai_queries_used integer NOT NULL DEFAULT 0,
        ai_tokens_used integer NOT NULL DEFAULT 0,
        storage_limit_mb integer NOT NULL DEFAULT 2048,
        storage_used_mb numeric NOT NULL DEFAULT 0,
        max_matters integer NOT NULL DEFAULT 100,
        max_seats integer NOT NULL DEFAULT 10,
        expires_at text NOT NULL,
        updated_at text NOT NULL
      );

      CREATE TABLE IF NOT EXISTS workflow_runs (
        id text PRIMARY KEY,
        organization_id text NOT NULL,
        user_id text NOT NULL,
        matter_id text,
        workflow_type text NOT NULL,
        goal text NOT NULL,
        status text NOT NULL,
        requires_human_approval boolean NOT NULL DEFAULT true,
        approved_by_user_id text DEFAULT '',
        total_tokens integer NOT NULL DEFAULT 0,
        total_latency_ms integer NOT NULL DEFAULT 0,
        steps jsonb NOT NULL DEFAULT '[]'::jsonb,
        final_output text DEFAULT '',
        created_at text NOT NULL
      );

      CREATE TABLE IF NOT EXISTS corporate_profiles (
        id text PRIMARY KEY,
        organization_id text NOT NULL,
        user_id text NOT NULL,
        matter_id text DEFAULT '',
        cin text NOT NULL,
        company_name text NOT NULL,
        roc text DEFAULT '',
        status text DEFAULT '',
        incorporation_date text DEFAULT '',
        authorized_capital text DEFAULT '',
        paid_up_capital text DEFAULT '',
        registered_address text DEFAULT '',
        directors jsonb NOT NULL DEFAULT '[]'::jsonb,
        charges jsonb NOT NULL DEFAULT '[]'::jsonb,
        filings jsonb NOT NULL DEFAULT '[]'::jsonb,
        ai_dd_summary text DEFAULT '',
        red_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
        source_provider text NOT NULL,
        source_date text NOT NULL,
        is_mock_data boolean NOT NULL DEFAULT false,
        created_at text NOT NULL
      );

      CREATE TABLE IF NOT EXISTS evidence_items (
        id text PRIMARY KEY,
        organization_id text NOT NULL,
        matter_id text NOT NULL,
        user_id text NOT NULL,
        exhibit_number text NOT NULL,
        title text NOT NULL,
        source_document_id text DEFAULT '',
        witness_name text DEFAULT '',
        admissibility_status text NOT NULL DEFAULT 'requires_certificate',
        notes text DEFAULT '',
        created_at text NOT NULL
      );

      CREATE TABLE IF NOT EXISTS litigation_strategies (
        id text PRIMARY KEY,
        organization_id text NOT NULL,
        matter_id text NOT NULL,
        user_id text NOT NULL,
        case_theory text DEFAULT '',
        legal_issues jsonb NOT NULL DEFAULT '[]'::jsonb,
        supporting_facts jsonb NOT NULL DEFAULT '[]'::jsonb,
        adverse_facts jsonb NOT NULL DEFAULT '[]'::jsonb,
        supporting_precedents jsonb NOT NULL DEFAULT '[]'::jsonb,
        weaknesses jsonb NOT NULL DEFAULT '[]'::jsonb,
        evidence_requirements jsonb NOT NULL DEFAULT '[]'::jsonb,
        cross_exam_questions jsonb NOT NULL DEFAULT '[]'::jsonb,
        ai_generated_disclaimer text NOT NULL DEFAULT 'AI-generated strategic analysis — review independently before court reliance.',
        updated_at text NOT NULL
      );

      CREATE TABLE IF NOT EXISTS revoked_tokens (
        jti text PRIMARY KEY,
        expires_at bigint NOT NULL
      );
    `);

    // Safe forward migrations for pre-existing tables
    const migrations = [
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_id text DEFAULT '';`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS org_role text NOT NULL DEFAULT 'advocate';`,
      `ALTER TABLE matters ADD COLUMN IF NOT EXISTS organization_id text DEFAULT '';`,
      `ALTER TABLE matters ADD COLUMN IF NOT EXISTS client_id text DEFAULT '';`,
      `ALTER TABLE matters ADD COLUMN IF NOT EXISTS assigned_user_ids jsonb NOT NULL DEFAULT '[]'::jsonb;`,
      `ALTER TABLE matters ADD COLUMN IF NOT EXISTS case_type text DEFAULT '';`,
      `ALTER TABLE matters ADD COLUMN IF NOT EXISTS cnr_number text DEFAULT '';`,
      `ALTER TABLE matters ADD COLUMN IF NOT EXISTS filing_date text DEFAULT '';`,
      `ALTER TABLE matters ADD COLUMN IF NOT EXISTS assigned_advocate text DEFAULT '';`,
      `ALTER TABLE research_memos ADD COLUMN IF NOT EXISTS organization_id text DEFAULT '';`,
      `ALTER TABLE research_memos ADD COLUMN IF NOT EXISTS filters jsonb NOT NULL DEFAULT '{}'::jsonb;`,
      `ALTER TABLE drafts ADD COLUMN IF NOT EXISTS organization_id text DEFAULT '';`,
      `ALTER TABLE drafts ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft';`,
      `ALTER TABLE drafts ADD COLUMN IF NOT EXISTS versions jsonb NOT NULL DEFAULT '[]'::jsonb;`,
      `ALTER TABLE vault_documents ADD COLUMN IF NOT EXISTS organization_id text DEFAULT '';`,
      `ALTER TABLE vault_documents ADD COLUMN IF NOT EXISTS file_size_bytes integer DEFAULT 0;`,
      `ALTER TABLE vault_documents ADD COLUMN IF NOT EXISTS processing_status text NOT NULL DEFAULT 'completed';`,
      `ALTER TABLE vault_documents ADD COLUMN IF NOT EXISTS processing_error text DEFAULT '';`,
      `ALTER TABLE vault_documents ADD COLUMN IF NOT EXISTS entities jsonb NOT NULL DEFAULT '{}'::jsonb;`,
      `ALTER TABLE contract_reviews ADD COLUMN IF NOT EXISTS organization_id text DEFAULT '';`,
      `ALTER TABLE contract_reviews ADD COLUMN IF NOT EXISTS obligations jsonb NOT NULL DEFAULT '[]'::jsonb;`,
      `ALTER TABLE contract_reviews ADD COLUMN IF NOT EXISTS renewal_date text DEFAULT '';`,
      `ALTER TABLE contract_reviews ADD COLUMN IF NOT EXISTS termination_notice_date text DEFAULT '';`,
      `CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id);`,
      `CREATE INDEX IF NOT EXISTS idx_matters_user ON matters(user_id);`,
      `CREATE INDEX IF NOT EXISTS idx_matters_org ON matters(organization_id);`,
      `CREATE INDEX IF NOT EXISTS idx_drafts_matter ON drafts(matter_id);`,
      `CREATE INDEX IF NOT EXISTS idx_vault_matter ON vault_documents(matter_id);`,
      `CREATE INDEX IF NOT EXISTS idx_memos_matter ON research_memos(matter_id);`,
      `CREATE INDEX IF NOT EXISTS idx_cases_matter ON tracked_cases(matter_id);`,
      `CREATE INDEX IF NOT EXISTS idx_deadlines_matter ON deadlines(matter_id);`,
      `CREATE INDEX IF NOT EXISTS idx_tasks_org_matter ON tasks(organization_id, matter_id);`,
      `CREATE INDEX IF NOT EXISTS idx_audit_org ON audit_events(organization_id, created_at);`,
      `CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, read);`,
    ];
    for (const sql of migrations) {
      await client.query(sql);
    }

    lastDbError = null;
    schemaInitialized = true;
    console.log('[Neon PostgreSQL] Schema & migrations verified in neondb.');
  } catch (err) {
    lastDbError = err instanceof Error ? err.message : 'Schema initialization failed';
    console.error('[Neon PostgreSQL] Schema verification error:', err);
    throw err;
  } finally {
    client?.release();
  }
}

export async function loadStoreFromNeon(): Promise<StoreState | null> {
  const pool = await getNeonPool();
  if (!pool) return null;

  try {
    const [
      organizations,
      orgMembers,
      users,
      clients,
      matters,
      tasks,
      hearings,
      researchMemos,
      drafts,
      vaultDocs,
      contractReviews,
      courtroomSessions,
      trackedCases,
      deadlines,
      meetingBriefs,
      whatsappMsgs,
      assistantMsgs,
      notifications,
      activityLogs,
      auditEvents,
      subscriptions,
      workflowRuns,
      corporateProfiles,
      evidenceItems,
      litigationStrategies,
      revokedTokens,
    ] = await Promise.all([
      pool.query('SELECT * FROM organizations;'),
      pool.query('SELECT * FROM organization_members;'),
      pool.query('SELECT * FROM users;'),
      pool.query('SELECT * FROM clients;'),
      pool.query('SELECT * FROM matters;'),
      pool.query('SELECT * FROM tasks;'),
      pool.query('SELECT * FROM hearings;'),
      pool.query('SELECT * FROM research_memos;'),
      pool.query('SELECT * FROM drafts;'),
      pool.query('SELECT * FROM vault_documents;'),
      pool.query('SELECT * FROM contract_reviews;'),
      pool.query('SELECT * FROM courtroom_sessions;'),
      pool.query('SELECT * FROM tracked_cases;'),
      pool.query('SELECT * FROM deadlines;'),
      pool.query('SELECT * FROM meeting_briefs;'),
      pool.query('SELECT * FROM whatsapp_messages ORDER BY created_at ASC;'),
      pool.query('SELECT * FROM assistant_messages ORDER BY created_at ASC;'),
      pool.query('SELECT * FROM notifications ORDER BY created_at DESC;'),
      pool.query('SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 500;'),
      pool.query('SELECT * FROM audit_events ORDER BY created_at DESC LIMIT 500;'),
      pool.query('SELECT * FROM subscriptions;'),
      pool.query('SELECT * FROM workflow_runs ORDER BY created_at DESC LIMIT 250;'),
      pool.query('SELECT * FROM corporate_profiles ORDER BY created_at DESC;'),
      pool.query('SELECT * FROM evidence_items;'),
      pool.query('SELECT * FROM litigation_strategies;'),
      pool.query('SELECT * FROM revoked_tokens WHERE expires_at > $1;', [Date.now()]),
    ]);

    if (users.rows.length === 0 && matters.rows.length === 0) {
      return null;
    }

    lastDbError = null;
    return {
      organizations: organizations.rows.map((o: any) => ({
        id: o.id,
        name: o.name,
        slug: o.slug,
        tier: o.tier || 'PRO',
        createdAt: o.created_at,
      })),
      organizationMembers: orgMembers.rows.map((m: any) => ({
        id: m.id,
        organizationId: m.organization_id,
        userId: m.user_id,
        role: m.role,
        permissions: Array.isArray(m.permissions) ? m.permissions : [],
        createdAt: m.created_at,
      })),
      users: users.rows.map((u: any) => ({
        id: u.id,
        email: u.email,
        fullName: u.full_name,
        role: u.role,
        organization: u.organization || '',
        organizationId: u.organization_id || '',
        orgRole: u.org_role || 'advocate',
        defaultJurisdiction: u.default_jurisdiction,
        isAdmin: Boolean(u.is_admin),
        passwordHash: u.password_hash,
        createdAt: u.created_at,
      })),
      clients: clients.rows.map((c: any) => ({
        id: c.id,
        organizationId: c.organization_id,
        userId: c.user_id,
        name: c.name,
        email: c.email || '',
        phone: c.phone || '',
        company: c.company || '',
        address: c.address || '',
        panOrCin: c.pan_or_cin || '',
        notes: c.notes || '',
        portalAccessEnabled: Boolean(c.portal_access_enabled),
        createdAt: c.created_at,
      })),
      matters: matters.rows.map((m: any) => ({
        id: m.id,
        userId: m.user_id,
        organizationId: m.organization_id || '',
        clientId: m.client_id || '',
        assignedUserIds: Array.isArray(m.assigned_user_ids) ? m.assigned_user_ids : [],
        title: m.title,
        matterCode: m.matter_code,
        clientName: m.client_name,
        opposingParty: m.opposing_party || '',
        jurisdiction: m.jurisdiction,
        forum: m.forum,
        caseType: m.case_type || '',
        cnrNumber: m.cnr_number || '',
        filingDate: m.filing_date || '',
        assignedAdvocate: m.assigned_advocate || '',
        status: m.status,
        summaryFacts: m.summary_facts || '',
        createdAt: m.created_at,
        updatedAt: m.updated_at,
      })),
      tasks: tasks.rows.map((t: any) => ({
        id: t.id,
        organizationId: t.organization_id,
        matterId: t.matter_id,
        userId: t.user_id,
        assignedToUserId: t.assigned_to_user_id || undefined,
        assignedToName: t.assigned_to_name || undefined,
        title: t.title,
        priority: t.priority,
        status: t.status,
        dueDate: t.due_date,
        createdAt: t.created_at,
      })),
      hearings: hearings.rows.map((h: any) => ({
        id: h.id,
        organizationId: h.organization_id,
        matterId: h.matter_id,
        trackedCaseId: h.tracked_case_id || undefined,
        userId: h.user_id,
        hearingDate: h.hearing_date,
        court: h.court,
        courtroom: h.courtroom || '',
        bench: h.bench || '',
        causeListItem: h.cause_list_item || '',
        outcome: h.outcome,
        nextHearingDate: h.next_hearing_date || undefined,
        adjournmentReason: h.adjournment_reason || undefined,
        notes: h.notes || '',
        createdAt: h.created_at,
      })),
      researchMemos: researchMemos.rows.map((r: any) => ({
        id: r.id,
        matterId: r.matter_id,
        userId: r.user_id,
        organizationId: r.organization_id || '',
        query: r.query,
        jurisdiction: r.jurisdiction,
        filters: r.filters || undefined,
        answerMarkdown: r.answer_markdown,
        citations: r.citations,
        citationIntegrity: r.citation_integrity,
        createdAt: r.created_at,
      })),
      drafts: drafts.rows.map((d: any) => ({
        id: d.id,
        matterId: d.matter_id,
        userId: d.user_id,
        organizationId: d.organization_id || '',
        title: d.title,
        docType: d.doc_type,
        content: d.content,
        status: d.status || 'draft',
        version: d.version,
        versions: Array.isArray(d.versions) ? d.versions : [],
        updatedAt: d.updated_at,
      })),
      vaultDocuments: vaultDocs.rows.map((v: any) => ({
        id: v.id,
        matterId: v.matter_id,
        userId: v.user_id,
        organizationId: v.organization_id || '',
        fileName: v.file_name,
        mimeType: v.mime_type,
        fileSizeBytes: Number(v.file_size_bytes || 0),
        docCategory: v.doc_category,
        processingStatus: v.processing_status || 'completed',
        processingError: v.processing_error || undefined,
        extractedText: v.extracted_text,
        translatedText: v.translated_text,
        targetLanguage: v.target_language,
        entities: v.entities && Object.keys(v.entities).length > 0 ? v.entities : undefined,
        chronology: v.chronology,
        contradictions: v.contradictions,
        createdAt: v.created_at,
      })),
      contractReviews: contractReviews.rows.map((c: any) => ({
        id: c.id,
        matterId: c.matter_id,
        userId: c.user_id,
        organizationId: c.organization_id || '',
        title: c.title,
        playbook: c.playbook,
        sourceText: c.source_text,
        summary: c.summary,
        clauses: c.clauses,
        requisitions: c.requisitions,
        obligations: Array.isArray(c.obligations) ? c.obligations : [],
        renewalDate: c.renewal_date || undefined,
        terminationNoticeDate: c.termination_notice_date || undefined,
        createdAt: c.created_at,
      })),
      courtroomSessions: courtroomSessions.rows.map((s: any) => ({
        id: s.id,
        matterId: s.matter_id,
        userId: s.user_id,
        mode: s.mode,
        forumContext: s.forum_context,
        briefExcerpt: s.brief_excerpt,
        turns: s.turns,
        vulnerabilities: s.vulnerabilities,
        createdAt: s.created_at,
      })),
      trackedCases: trackedCases.rows.map((t: any) => ({
        id: t.id,
        matterId: t.matter_id,
        userId: t.user_id,
        caseNumber: t.case_number,
        court: t.court,
        courtroom: t.courtroom,
        bench: t.bench,
        causeListItem: t.cause_list_item,
        nextHearingDate: t.next_hearing_date,
        stage: t.stage,
        notes: t.notes,
        cnrNumber: t.cnr_number,
        status: t.status,
        createdAt: t.created_at,
      })),
      deadlines: deadlines.rows.map((dl: any) => ({
        id: dl.id,
        matterId: dl.matter_id,
        userId: dl.user_id,
        title: dl.title,
        statuteArticle: dl.statute_article || '',
        triggerDate: dl.trigger_date || new Date().toISOString().slice(0, 10),
        dueDate: dl.due_date,
        graceDate: dl.grace_date || undefined,
        completed: Boolean(dl.completed),
        notes: dl.notes || '',
        createdAt: dl.created_at || new Date().toISOString(),
      })),
      meetingBriefs: meetingBriefs.rows.map((mb: any) => ({
        id: mb.id,
        matterId: mb.matter_id,
        userId: mb.user_id,
        title: mb.title,
        durationLabel: mb.duration_label,
        transcript: mb.transcript,
        summary: mb.summary,
        keyFacts: mb.key_facts || [],
        actionItems: mb.action_items || [],
        statutoryIssues: mb.statutory_issues || [],
        createdAt: mb.created_at,
      })),
      whatsappMessages: whatsappMsgs.rows.map((w: any) => ({
        id: w.id,
        matterId: w.matter_id,
        userId: w.user_id,
        sender: w.sender,
        body: w.body,
        commandTag: w.command_tag || '',
        createdAt: w.created_at,
      })),
      assistantMessages: assistantMsgs.rows.map((a: any) => ({
        id: a.id,
        userId: a.user_id,
        matterId: a.matter_id,
        role: a.role,
        content: a.content,
        languageUsed: a.language_used,
        verificationMode: a.verification_mode,
        confidenceNote: a.confidence_note,
        sources: a.sources,
        completedActions: a.completed_actions,
        createdAt: a.created_at,
      })),
      notifications: notifications.rows.map((n: any) => ({
        id: n.id,
        organizationId: n.organization_id,
        userId: n.user_id,
        title: n.title,
        message: n.message,
        kind: n.kind,
        read: Boolean(n.read),
        linkSection: n.link_section || 'overview',
        createdAt: n.created_at,
      })),
      activityLogs: activityLogs.rows.map((al: any) => ({
        id: al.id,
        organizationId: al.organization_id,
        userId: al.user_id,
        actorName: al.actor_name,
        matterId: al.matter_id || undefined,
        action: al.action,
        entityType: al.entity_type,
        entityId: al.entity_id || undefined,
        summary: al.summary,
        createdAt: al.created_at,
      })),
      auditEvents: auditEvents.rows.map((ae: any) => ({
        id: ae.id,
        organizationId: ae.organization_id,
        userId: ae.user_id,
        actorEmail: ae.actor_email,
        eventType: ae.event_type,
        resourceType: ae.resource_type,
        resourceId: ae.resource_id || undefined,
        ipAddress: ae.ip_address || undefined,
        status: ae.status,
        details: ae.details,
        createdAt: ae.created_at,
      })),
      subscriptions: subscriptions.rows.map((sub: any) => ({
        id: sub.id,
        organizationId: sub.organization_id,
        tier: sub.tier,
        status: sub.status,
        aiQueriesLimit: Number(sub.ai_queries_limit),
        aiQueriesUsed: Number(sub.ai_queries_used),
        aiTokensUsed: Number(sub.ai_tokens_used),
        storageLimitMb: Number(sub.storage_limit_mb),
        storageUsedMb: Number(sub.storage_used_mb),
        maxMatters: Number(sub.max_matters),
        maxSeats: Number(sub.max_seats),
        expiresAt: sub.expires_at,
        updatedAt: sub.updated_at,
      })),
      workflowRuns: workflowRuns.rows.map((wr: any) => ({
        id: wr.id,
        organizationId: wr.organization_id,
        userId: wr.user_id,
        matterId: wr.matter_id,
        workflowType: wr.workflow_type,
        goal: wr.goal,
        status: wr.status,
        requiresHumanApproval: Boolean(wr.requires_human_approval),
        approvedByUserId: wr.approved_by_user_id || undefined,
        totalTokens: Number(wr.total_tokens || 0),
        totalLatencyMs: Number(wr.total_latency_ms || 0),
        steps: wr.steps || [],
        finalOutput: wr.final_output || '',
        createdAt: wr.created_at,
      })),
      corporateProfiles: corporateProfiles.rows.map((cp: any) => ({
        id: cp.id,
        organizationId: cp.organization_id,
        userId: cp.user_id,
        matterId: cp.matter_id || undefined,
        cin: cp.cin,
        companyName: cp.company_name,
        roc: cp.roc || '',
        status: cp.status || '',
        incorporationDate: cp.incorporation_date || '',
        authorizedCapital: cp.authorized_capital || '',
        paidUpCapital: cp.paid_up_capital || '',
        registeredAddress: cp.registered_address || '',
        directors: cp.directors || [],
        charges: cp.charges || [],
        filings: cp.filings || [],
        aiDueDiligenceSummary: cp.ai_dd_summary || '',
        redFlags: cp.red_flags || [],
        sourceProvider: cp.source_provider,
        sourceDate: cp.source_date,
        isMockData: Boolean(cp.is_mock_data),
        createdAt: cp.created_at,
      })),
      evidenceItems: evidenceItems.rows.map((ev: any) => ({
        id: ev.id,
        organizationId: ev.organization_id,
        matterId: ev.matter_id,
        userId: ev.user_id,
        exhibitNumber: ev.exhibit_number,
        title: ev.title,
        sourceDocumentId: ev.source_document_id || undefined,
        witnessName: ev.witness_name || undefined,
        admissibilityStatus: ev.admissibility_status,
        notes: ev.notes || '',
        createdAt: ev.created_at,
      })),
      litigationStrategies: litigationStrategies.rows.map((ls: any) => ({
        id: ls.id,
        organizationId: ls.organization_id,
        matterId: ls.matter_id,
        userId: ls.user_id,
        caseTheory: ls.case_theory || '',
        legalIssues: ls.legal_issues || [],
        supportingFacts: ls.supporting_facts || [],
        adverseFacts: ls.adverse_facts || [],
        supportingPrecedents: ls.supporting_precedents || [],
        weaknesses: ls.weaknesses || [],
        evidenceRequirements: ls.evidence_requirements || [],
        crossExamQuestions: ls.cross_exam_questions || [],
        aiGeneratedDisclaimer: ls.ai_generated_disclaimer,
        updatedAt: ls.updated_at,
      })),
      revokedTokens: revokedTokens.rows.map((rt: any) => ({
        jti: rt.jti,
        expiresAt: Number(rt.expires_at),
      })),
    };
  } catch (err) {
    lastDbError = err instanceof Error ? err.message : 'Failed to load store from Neon';
    console.error('[Neon PostgreSQL] Failed to load store from Neon database:', err);
    throw err;
  }
}

/**
 * Transactionally persists the repository state to Neon PostgreSQL.
 * Propagates errors instead of silently faking persistence.
 */
export async function persistStoreToNeon(state: StoreState): Promise<void> {
  const pool = await getNeonPool();
  if (!pool) return;

  let client: PoolClient | null = null;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    for (const o of state.organizations) {
      await client.query(
        `INSERT INTO organizations (id, name, slug, tier, created_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, tier = EXCLUDED.tier;`,
        [o.id, o.name, o.slug, o.tier, o.createdAt]
      );
    }

    for (const om of state.organizationMembers) {
      await client.query(
        `INSERT INTO organization_members (id, organization_id, user_id, role, permissions, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, permissions = EXCLUDED.permissions;`,
        [om.id, om.organizationId, om.userId, om.role, JSON.stringify(om.permissions), om.createdAt]
      );
    }

    for (const u of state.users) {
      await client.query(
        `INSERT INTO users (id, email, full_name, role, organization, organization_id, org_role, default_jurisdiction, is_admin, password_hash, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (email) DO UPDATE SET
           full_name = EXCLUDED.full_name,
           role = EXCLUDED.role,
           organization = EXCLUDED.organization,
           organization_id = EXCLUDED.organization_id,
           org_role = EXCLUDED.org_role,
           default_jurisdiction = EXCLUDED.default_jurisdiction,
           is_admin = EXCLUDED.is_admin,
           password_hash = EXCLUDED.password_hash;`,
        [
          u.id,
          u.email,
          u.fullName,
          u.role,
          u.organization,
          u.organizationId || '',
          u.orgRole || 'advocate',
          u.defaultJurisdiction,
          Boolean(u.isAdmin),
          u.passwordHash,
          u.createdAt,
        ]
      );
    }

    for (const c of state.clients) {
      await client.query(
        `INSERT INTO clients (id, organization_id, user_id, name, email, phone, company, address, pan_or_cin, notes, portal_access_enabled, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name, email = EXCLUDED.email, phone = EXCLUDED.phone,
           company = EXCLUDED.company, address = EXCLUDED.address, notes = EXCLUDED.notes,
           portal_access_enabled = EXCLUDED.portal_access_enabled;`,
        [
          c.id,
          c.organizationId,
          c.userId,
          c.name,
          c.email,
          c.phone,
          c.company,
          c.address,
          c.panOrCin || '',
          c.notes,
          Boolean(c.portalAccessEnabled),
          c.createdAt,
        ]
      );
    }

    for (const m of state.matters) {
      await client.query(
        `INSERT INTO matters (id, user_id, organization_id, client_id, assigned_user_ids, title, matter_code, client_name, opposing_party, jurisdiction, forum, case_type, cnr_number, filing_date, assigned_advocate, status, summary_facts, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
         ON CONFLICT (id) DO UPDATE SET
           organization_id = EXCLUDED.organization_id,
           client_id = EXCLUDED.client_id,
           assigned_user_ids = EXCLUDED.assigned_user_ids,
           title = EXCLUDED.title,
           opposing_party = EXCLUDED.opposing_party,
           forum = EXCLUDED.forum,
           case_type = EXCLUDED.case_type,
           cnr_number = EXCLUDED.cnr_number,
           assigned_advocate = EXCLUDED.assigned_advocate,
           status = EXCLUDED.status,
           summary_facts = EXCLUDED.summary_facts,
           updated_at = EXCLUDED.updated_at;`,
        [
          m.id,
          m.userId,
          m.organizationId || '',
          m.clientId || '',
          JSON.stringify(m.assignedUserIds || []),
          m.title,
          m.matterCode,
          m.clientName,
          m.opposingParty,
          m.jurisdiction,
          m.forum,
          m.caseType || '',
          m.cnrNumber || '',
          m.filingDate || '',
          m.assignedAdvocate || '',
          m.status,
          m.summaryFacts,
          m.createdAt,
          m.updatedAt,
        ]
      );
    }

    for (const t of state.tasks) {
      await client.query(
        `INSERT INTO tasks (id, organization_id, matter_id, user_id, assigned_to_user_id, assigned_to_name, title, priority, status, due_date, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, priority = EXCLUDED.priority, assigned_to_user_id = EXCLUDED.assigned_to_user_id, assigned_to_name = EXCLUDED.assigned_to_name;`,
        [
          t.id,
          t.organizationId,
          t.matterId,
          t.userId,
          t.assignedToUserId || '',
          t.assignedToName || '',
          t.title,
          t.priority,
          t.status,
          t.dueDate,
          t.createdAt,
        ]
      );
    }

    for (const h of state.hearings) {
      await client.query(
        `INSERT INTO hearings (id, organization_id, matter_id, tracked_case_id, user_id, hearing_date, court, courtroom, bench, cause_list_item, outcome, next_hearing_date, adjournment_reason, notes, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         ON CONFLICT (id) DO UPDATE SET outcome = EXCLUDED.outcome, next_hearing_date = EXCLUDED.next_hearing_date, adjournment_reason = EXCLUDED.adjournment_reason, notes = EXCLUDED.notes;`,
        [
          h.id,
          h.organizationId,
          h.matterId,
          h.trackedCaseId || '',
          h.userId,
          h.hearingDate,
          h.court,
          h.courtroom,
          h.bench,
          h.causeListItem,
          h.outcome,
          h.nextHearingDate || '',
          h.adjournmentReason || '',
          h.notes,
          h.createdAt,
        ]
      );
    }

    for (const d of state.drafts) {
      await client.query(
        `INSERT INTO drafts (id, matter_id, user_id, organization_id, title, doc_type, content, status, version, versions, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (id) DO UPDATE SET
           title = EXCLUDED.title,
           content = EXCLUDED.content,
           status = EXCLUDED.status,
           version = EXCLUDED.version,
           versions = EXCLUDED.versions,
           updated_at = EXCLUDED.updated_at;`,
        [
          d.id,
          d.matterId,
          d.userId,
          d.organizationId || '',
          d.title,
          d.docType,
          d.content,
          d.status || 'draft',
          d.version,
          JSON.stringify(d.versions || []),
          d.updatedAt,
        ]
      );
    }

    for (const r of state.researchMemos) {
      await client.query(
        `INSERT INTO research_memos (id, matter_id, user_id, organization_id, query, jurisdiction, filters, answer_markdown, citations, citation_integrity, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (id) DO NOTHING;`,
        [
          r.id,
          r.matterId,
          r.userId,
          r.organizationId || '',
          r.query,
          r.jurisdiction,
          JSON.stringify(r.filters || {}),
          r.answerMarkdown,
          JSON.stringify(r.citations),
          JSON.stringify(r.citationIntegrity),
          r.createdAt,
        ]
      );
    }

    for (const v of state.vaultDocuments) {
      await client.query(
        `INSERT INTO vault_documents (id, matter_id, user_id, organization_id, file_name, mime_type, file_size_bytes, doc_category, processing_status, processing_error, extracted_text, translated_text, target_language, entities, chronology, contradictions, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         ON CONFLICT (id) DO UPDATE SET
           processing_status = EXCLUDED.processing_status,
           processing_error = EXCLUDED.processing_error,
           extracted_text = EXCLUDED.extracted_text,
           translated_text = EXCLUDED.translated_text,
           entities = EXCLUDED.entities,
           chronology = EXCLUDED.chronology,
           contradictions = EXCLUDED.contradictions;`,
        [
          v.id,
          v.matterId,
          v.userId,
          v.organizationId || '',
          v.fileName,
          v.mimeType,
          v.fileSizeBytes || 0,
          v.docCategory,
          v.processingStatus || 'completed',
          v.processingError || '',
          v.extractedText,
          v.translatedText || '',
          v.targetLanguage || '',
          JSON.stringify(v.entities || {}),
          JSON.stringify(v.chronology),
          JSON.stringify(v.contradictions),
          v.createdAt,
        ]
      );
    }

    for (const dl of state.deadlines) {
      await client.query(
        `INSERT INTO deadlines (id, matter_id, user_id, title, statute_article, trigger_date, due_date, grace_date, completed, notes, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (id) DO UPDATE SET completed = EXCLUDED.completed, notes = EXCLUDED.notes;`,
        [
          dl.id,
          dl.matterId,
          dl.userId,
          dl.title,
          dl.statuteArticle || '',
          dl.triggerDate,
          dl.dueDate,
          dl.graceDate || null,
          dl.completed,
          dl.notes || '',
          dl.createdAt,
        ]
      );
    }

    for (const cr of state.contractReviews) {
      await client.query(
        `INSERT INTO contract_reviews (id, matter_id, user_id, organization_id, title, playbook, source_text, summary, clauses, requisitions, obligations, renewal_date, termination_notice_date, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         ON CONFLICT (id) DO UPDATE SET clauses = EXCLUDED.clauses, summary = EXCLUDED.summary;`,
        [
          cr.id,
          cr.matterId,
          cr.userId,
          cr.organizationId || '',
          cr.title,
          cr.playbook,
          cr.sourceText,
          cr.summary,
          JSON.stringify(cr.clauses),
          JSON.stringify(cr.requisitions),
          JSON.stringify(cr.obligations || []),
          cr.renewalDate || '',
          cr.terminationNoticeDate || '',
          cr.createdAt,
        ]
      );
    }

    for (const cs of state.courtroomSessions) {
      await client.query(
        `INSERT INTO courtroom_sessions (id, matter_id, user_id, mode, forum_context, brief_excerpt, turns, vulnerabilities, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (id) DO UPDATE SET turns = EXCLUDED.turns, vulnerabilities = EXCLUDED.vulnerabilities;`,
        [
          cs.id,
          cs.matterId,
          cs.userId,
          cs.mode,
          cs.forumContext,
          cs.briefExcerpt,
          JSON.stringify(cs.turns),
          JSON.stringify(cs.vulnerabilities),
          cs.createdAt,
        ]
      );
    }

    for (const tc of state.trackedCases) {
      await client.query(
        `INSERT INTO tracked_cases (id, matter_id, user_id, case_number, court, courtroom, bench, cause_list_item, next_hearing_date, stage, notes, cnr_number, status, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         ON CONFLICT (id) DO UPDATE SET
           status = EXCLUDED.status,
           next_hearing_date = EXCLUDED.next_hearing_date,
           stage = EXCLUDED.stage,
           notes = EXCLUDED.notes,
           updated_at = EXCLUDED.updated_at;`,
        [
          tc.id,
          tc.matterId,
          tc.userId,
          tc.caseNumber,
          tc.court,
          tc.courtroom || '',
          tc.bench || '',
          tc.causeListItem || '',
          tc.nextHearingDate,
          tc.stage,
          tc.notes || '',
          tc.cnrNumber || '',
          tc.status,
          tc.createdAt,
          tc.createdAt,
        ]
      );
    }

    for (const mb of state.meetingBriefs) {
      await client.query(
        `INSERT INTO meeting_briefs (id, matter_id, user_id, title, duration_label, transcript, summary, key_facts, action_items, statutory_issues, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (id) DO NOTHING;`,
        [
          mb.id,
          mb.matterId,
          mb.userId,
          mb.title,
          mb.durationLabel,
          mb.transcript,
          mb.summary,
          JSON.stringify(mb.keyFacts),
          JSON.stringify(mb.actionItems),
          JSON.stringify(mb.statutoryIssues),
          mb.createdAt,
        ]
      );
    }

    for (const wm of state.whatsappMessages.slice(-200)) {
      await client.query(
        `INSERT INTO whatsapp_messages (id, matter_id, user_id, sender, body, command_tag, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (id) DO NOTHING;`,
        [wm.id, wm.matterId, wm.userId, wm.sender, wm.body, wm.commandTag, wm.createdAt]
      );
    }

    for (const am of state.assistantMessages.slice(-300)) {
      await client.query(
        `INSERT INTO assistant_messages (id, user_id, matter_id, role, content, language_used, verification_mode, confidence_note, sources, completed_actions, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (id) DO NOTHING;`,
        [
          am.id,
          am.userId,
          am.matterId,
          am.role,
          am.content,
          am.languageUsed,
          am.verificationMode,
          am.confidenceNote || '',
          JSON.stringify(am.sources),
          JSON.stringify(am.completedActions),
          am.createdAt,
        ]
      );
    }

    for (const n of state.notifications.slice(0, 200)) {
      await client.query(
        `INSERT INTO notifications (id, organization_id, user_id, title, message, kind, read, link_section, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (id) DO UPDATE SET read = EXCLUDED.read;`,
        [
          n.id,
          n.organizationId,
          n.userId,
          n.title,
          n.message,
          n.kind,
          Boolean(n.read),
          n.linkSection || 'overview',
          n.createdAt,
        ]
      );
    }

    for (const al of state.activityLogs.slice(0, 250)) {
      await client.query(
        `INSERT INTO activity_logs (id, organization_id, user_id, actor_name, matter_id, action, entity_type, entity_id, summary, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (id) DO NOTHING;`,
        [
          al.id,
          al.organizationId,
          al.userId,
          al.actorName,
          al.matterId || '',
          al.action,
          al.entityType,
          al.entityId || '',
          al.summary,
          al.createdAt,
        ]
      );
    }

    for (const ae of state.auditEvents.slice(0, 250)) {
      await client.query(
        `INSERT INTO audit_events (id, organization_id, user_id, actor_email, event_type, resource_type, resource_id, ip_address, status, details, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (id) DO NOTHING;`,
        [
          ae.id,
          ae.organizationId,
          ae.userId,
          ae.actorEmail,
          ae.eventType,
          ae.resourceType,
          ae.resourceId || '',
          ae.ipAddress || '',
          ae.status,
          ae.details,
          ae.createdAt,
        ]
      );
    }

    for (const sub of state.subscriptions) {
      await client.query(
        `INSERT INTO subscriptions (id, organization_id, tier, status, ai_queries_limit, ai_queries_used, ai_tokens_used, storage_limit_mb, storage_used_mb, max_matters, max_seats, expires_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (organization_id) DO UPDATE SET
           tier = EXCLUDED.tier,
           status = EXCLUDED.status,
           ai_queries_limit = EXCLUDED.ai_queries_limit,
           ai_queries_used = EXCLUDED.ai_queries_used,
           ai_tokens_used = EXCLUDED.ai_tokens_used,
           storage_limit_mb = EXCLUDED.storage_limit_mb,
           storage_used_mb = EXCLUDED.storage_used_mb,
           max_matters = EXCLUDED.max_matters,
           max_seats = EXCLUDED.max_seats,
           expires_at = EXCLUDED.expires_at,
           updated_at = EXCLUDED.updated_at;`,
        [
          sub.id,
          sub.organizationId,
          sub.tier,
          sub.status,
          sub.aiQueriesLimit,
          sub.aiQueriesUsed,
          sub.aiTokensUsed,
          sub.storageLimitMb,
          sub.storageUsedMb,
          sub.maxMatters,
          sub.maxSeats,
          sub.expiresAt,
          sub.updatedAt,
        ]
      );
    }

    for (const wr of state.workflowRuns.slice(0, 120)) {
      await client.query(
        `INSERT INTO workflow_runs (id, organization_id, user_id, matter_id, workflow_type, goal, status, requires_human_approval, approved_by_user_id, total_tokens, total_latency_ms, steps, final_output, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         ON CONFLICT (id) DO UPDATE SET
           status = EXCLUDED.status,
           approved_by_user_id = EXCLUDED.approved_by_user_id,
           steps = EXCLUDED.steps,
           final_output = EXCLUDED.final_output;`,
        [
          wr.id,
          wr.organizationId,
          wr.userId,
          wr.matterId,
          wr.workflowType,
          wr.goal,
          wr.status,
          Boolean(wr.requiresHumanApproval),
          wr.approvedByUserId || '',
          wr.totalTokens,
          wr.totalLatencyMs,
          JSON.stringify(wr.steps),
          wr.finalOutput,
          wr.createdAt,
        ]
      );
    }

    for (const cp of state.corporateProfiles) {
      await client.query(
        `INSERT INTO corporate_profiles (id, organization_id, user_id, matter_id, cin, company_name, roc, status, incorporation_date, authorized_capital, paid_up_capital, registered_address, directors, charges, filings, ai_dd_summary, red_flags, source_provider, source_date, is_mock_data, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
         ON CONFLICT (id) DO NOTHING;`,
        [
          cp.id,
          cp.organizationId,
          cp.userId,
          cp.matterId || '',
          cp.cin,
          cp.companyName,
          cp.roc,
          cp.status,
          cp.incorporationDate,
          cp.authorizedCapital,
          cp.paidUpCapital,
          cp.registeredAddress,
          JSON.stringify(cp.directors),
          JSON.stringify(cp.charges),
          JSON.stringify(cp.filings),
          cp.aiDueDiligenceSummary,
          JSON.stringify(cp.redFlags),
          cp.sourceProvider,
          cp.sourceDate,
          Boolean(cp.isMockData),
          cp.createdAt,
        ]
      );
    }

    for (const ev of state.evidenceItems) {
      await client.query(
        `INSERT INTO evidence_items (id, organization_id, matter_id, user_id, exhibit_number, title, source_document_id, witness_name, admissibility_status, notes, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (id) DO UPDATE SET admissibility_status = EXCLUDED.admissibility_status, notes = EXCLUDED.notes;`,
        [
          ev.id,
          ev.organizationId,
          ev.matterId,
          ev.userId,
          ev.exhibitNumber,
          ev.title,
          ev.sourceDocumentId || '',
          ev.witnessName || '',
          ev.admissibilityStatus,
          ev.notes,
          ev.createdAt,
        ]
      );
    }

    for (const ls of state.litigationStrategies) {
      await client.query(
        `INSERT INTO litigation_strategies (id, organization_id, matter_id, user_id, case_theory, legal_issues, supporting_facts, adverse_facts, supporting_precedents, weaknesses, evidence_requirements, cross_exam_questions, ai_generated_disclaimer, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         ON CONFLICT (id) DO UPDATE SET
           case_theory = EXCLUDED.case_theory,
           legal_issues = EXCLUDED.legal_issues,
           supporting_facts = EXCLUDED.supporting_facts,
           adverse_facts = EXCLUDED.adverse_facts,
           supporting_precedents = EXCLUDED.supporting_precedents,
           weaknesses = EXCLUDED.weaknesses,
           evidence_requirements = EXCLUDED.evidence_requirements,
           cross_exam_questions = EXCLUDED.cross_exam_questions,
           updated_at = EXCLUDED.updated_at;`,
        [
          ls.id,
          ls.organizationId,
          ls.matterId,
          ls.userId,
          ls.caseTheory,
          JSON.stringify(ls.legalIssues),
          JSON.stringify(ls.supportingFacts),
          JSON.stringify(ls.adverseFacts),
          JSON.stringify(ls.supportingPrecedents),
          JSON.stringify(ls.weaknesses),
          JSON.stringify(ls.evidenceRequirements),
          JSON.stringify(ls.crossExamQuestions),
          ls.aiGeneratedDisclaimer,
          ls.updatedAt,
        ]
      );
    }

    for (const rt of state.revokedTokens) {
      await client.query(
        `INSERT INTO revoked_tokens (jti, expires_at) VALUES ($1, $2) ON CONFLICT (jti) DO NOTHING;`,
        [rt.jti, rt.expiresAt]
      );
    }

    await client.query('COMMIT');
    lastDbError = null;
    lastDbSyncAt = new Date().toISOString();
  } catch (err) {
    await client?.query('ROLLBACK').catch(() => { });
    lastDbError = err instanceof Error ? err.message : 'Failed to persist store snapshot to Neon';
    console.error('[Neon PostgreSQL] Failed to sync store snapshot:', err);
    throw err;
  } finally {
    client?.release();
  }
}

export async function deleteUserFromNeon(userId: string): Promise<void> {
  const pool = await getNeonPool();
  if (!pool) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM assistant_messages WHERE user_id = $1;', [userId]);
    await client.query('DELETE FROM whatsapp_messages WHERE user_id = $1;', [userId]);
    await client.query('DELETE FROM meeting_briefs WHERE user_id = $1;', [userId]);
    await client.query('DELETE FROM notifications WHERE user_id = $1;', [userId]);
    await client.query('DELETE FROM tasks WHERE user_id = $1;', [userId]);
    await client.query('DELETE FROM hearings WHERE user_id = $1;', [userId]);
    await client.query('DELETE FROM deadlines WHERE user_id = $1;', [userId]);
    await client.query('DELETE FROM tracked_cases WHERE user_id = $1;', [userId]);
    await client.query('DELETE FROM courtroom_sessions WHERE user_id = $1;', [userId]);
    await client.query('DELETE FROM contract_reviews WHERE user_id = $1;', [userId]);
    await client.query('DELETE FROM vault_documents WHERE user_id = $1;', [userId]);
    await client.query('DELETE FROM research_memos WHERE user_id = $1;', [userId]);
    await client.query('DELETE FROM drafts WHERE user_id = $1;', [userId]);
    await client.query('DELETE FROM evidence_items WHERE user_id = $1;', [userId]);
    await client.query('DELETE FROM litigation_strategies WHERE user_id = $1;', [userId]);
    await client.query('DELETE FROM matters WHERE user_id = $1;', [userId]);
    await client.query('DELETE FROM clients WHERE user_id = $1;', [userId]);
    await client.query('DELETE FROM organization_members WHERE user_id = $1;', [userId]);
    await client.query('DELETE FROM users WHERE id = $1;', [userId]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => { });
    lastDbError = err instanceof Error ? err.message : 'Failed to delete user from Neon';
    throw err;
  } finally {
    client.release();
  }
}

export async function deleteMatterFromNeon(matterId: string): Promise<void> {
  const pool = await getNeonPool();
  if (!pool) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM tasks WHERE matter_id = $1;', [matterId]);
    await client.query('DELETE FROM hearings WHERE matter_id = $1;', [matterId]);
    await client.query('DELETE FROM deadlines WHERE matter_id = $1;', [matterId]);
    await client.query('DELETE FROM tracked_cases WHERE matter_id = $1;', [matterId]);
    await client.query('DELETE FROM courtroom_sessions WHERE matter_id = $1;', [matterId]);
    await client.query('DELETE FROM contract_reviews WHERE matter_id = $1;', [matterId]);
    await client.query('DELETE FROM vault_documents WHERE matter_id = $1;', [matterId]);
    await client.query('DELETE FROM research_memos WHERE matter_id = $1;', [matterId]);
    await client.query('DELETE FROM drafts WHERE matter_id = $1;', [matterId]);
    await client.query('DELETE FROM meeting_briefs WHERE matter_id = $1;', [matterId]);
    await client.query('DELETE FROM evidence_items WHERE matter_id = $1;', [matterId]);
    await client.query('DELETE FROM litigation_strategies WHERE matter_id = $1;', [matterId]);
    await client.query('DELETE FROM matters WHERE id = $1;', [matterId]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => { });
    lastDbError = err instanceof Error ? err.message : 'Failed to delete matter from Neon';
    throw err;
  } finally {
    client.release();
  }
}

export async function clearAssistantMessagesFromNeon(userId: string): Promise<void> {
  const pool = await getNeonPool();
  if (!pool) return;
  await pool.query('DELETE FROM assistant_messages WHERE user_id = $1;', [userId]);
}
