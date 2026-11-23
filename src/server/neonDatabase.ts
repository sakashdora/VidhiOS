import { Pool, type PoolClient, type QueryResult } from 'pg';
import type {
  AssistantMessage,
  ContractReview,
  CourtroomSession,
  DeadlineItem,
  DraftDocument,
  Matter,
  ResearchMemo,
  TrackedCase,
  UserProfile,
  VaultDocument,
} from '../types/legal';

export interface StoredUser extends UserProfile {
  passwordHash: string;
}

export interface StoreState {
  users: StoredUser[];
  matters: Matter[];
  researchMemos: ResearchMemo[];
  drafts: DraftDocument[];
  vaultDocuments: VaultDocument[];
  contractReviews: ContractReview[];
  courtroomSessions: CourtroomSession[];
  trackedCases: TrackedCase[];
  deadlines: DeadlineItem[];
  meetingBriefs: any[];
  whatsappMessages: any[];
  assistantMessages: AssistantMessage[];
}

let activePool: Pool | null = null;
let resolvedHostIp: string | null = null;

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
  // Cloud serverless runtimes (Netlify, Vercel, AWS Lambda) resolve AWS hostnames natively without UDP port 53 refusal
  if (process.env.NETLIFY || process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NODE_ENV === 'production') {
    return null;
  }
  try {
    const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(hostname)}&type=A`, {
      headers: { Accept: 'application/dns-json' },
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { Answer?: Array<{ type: number; data: string }> };
    const ip = json.Answer?.find((a) => a.type === 1)?.data;
    if (ip) {
      resolvedHostIp = ip;
      return ip;
    }
  } catch {
    // Non-fatal fallback
  }
  return null;
}

/**
 * Creates or reuses a singleton pg.Pool configured for Neon Serverless PostgreSQL with SSL.
 */
export async function getNeonPool(): Promise<Pool | null> {
  const connectionString = getNeonConnectionString();
  if (!connectionString) return null;
  if (activePool) return activePool;

  try {
    const parsed = new URL(connectionString);
    const hostname = parsed.hostname;

    // Check if DoH fallback resolution is needed for dynamic AWS Neon pools
    const ip = await resolveHostViaDoH(hostname);

    activePool = new Pool({
      host: ip || hostname,
      port: Number(parsed.port) || 5432,
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database: parsed.pathname.replace(/^\//, '') || 'neondb',
      ssl: {
        servername: hostname,
        rejectUnauthorized: false,
      },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 8000,
    });

    activePool.on('error', (err) => {
      console.error('[Neon Pool Error]:', err.message);
    });

    return activePool;
  } catch (err) {
    console.error('[Neon Pool Init Failed]:', err);
    return null;
  }
}

/**
 * Tests direct connectivity and latency to the Neon Serverless PostgreSQL instance.
 */
export async function testNeonConnection(): Promise<{
  ok: boolean;
  version?: string;
  latencyMs?: number;
  database?: string;
  error?: string;
}> {
  const startedAt = Date.now();
  const pool = await getNeonPool();
  if (!pool) {
    return { ok: false, error: 'DATABASE_URL or NEON_DATABASE_URL is not configured.' };
  }

  let client: PoolClient | null = null;
  try {
    client = await pool.connect();
    const res = await client.query('SELECT version() as version, current_database() as db, now() as current_time;');
    return {
      ok: true,
      version: res.rows[0]?.version || 'PostgreSQL (Neon Serverless)',
      database: res.rows[0]?.db || 'neondb',
      latencyMs: Date.now() - startedAt,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to connect to Neon database.',
      latencyMs: Date.now() - startedAt,
    };
  } finally {
    client?.release();
  }
}

let schemaInitialized = false;

/**
 * Automatically provisions all required VidhiOS tables in Neon PostgreSQL.
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
      CREATE TABLE IF NOT EXISTS users (
        id text PRIMARY KEY,
        email text NOT NULL UNIQUE,
        full_name text NOT NULL,
        role text NOT NULL DEFAULT 'Advocate',
        organization text DEFAULT '',
        default_jurisdiction text NOT NULL DEFAULT 'india_litigation',
        is_admin boolean DEFAULT false,
        password_hash text NOT NULL,
        created_at text NOT NULL
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS matters (
        id text PRIMARY KEY,
        user_id text NOT NULL,
        title text NOT NULL,
        matter_code text NOT NULL,
        client_name text NOT NULL,
        opposing_party text DEFAULT '',
        jurisdiction text NOT NULL DEFAULT 'india_litigation',
        forum text NOT NULL,
        status text NOT NULL DEFAULT 'active',
        summary_facts text DEFAULT '',
        created_at text NOT NULL,
        updated_at text NOT NULL
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS research_memos (
        id text PRIMARY KEY,
        matter_id text NOT NULL,
        user_id text NOT NULL,
        query text NOT NULL,
        jurisdiction text NOT NULL,
        answer_markdown text NOT NULL,
        citations jsonb NOT NULL DEFAULT '[]'::jsonb,
        citation_integrity jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at text NOT NULL
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS drafts (
        id text PRIMARY KEY,
        matter_id text NOT NULL,
        user_id text NOT NULL,
        title text NOT NULL,
        doc_type text NOT NULL,
        content text NOT NULL,
        version integer NOT NULL DEFAULT 1,
        updated_at text NOT NULL
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS vault_documents (
        id text PRIMARY KEY,
        matter_id text NOT NULL,
        user_id text NOT NULL,
        file_name text NOT NULL,
        mime_type text NOT NULL,
        doc_category text NOT NULL DEFAULT 'Annexure',
        extracted_text text DEFAULT '',
        translated_text text DEFAULT '',
        target_language text DEFAULT '',
        chronology jsonb NOT NULL DEFAULT '[]'::jsonb,
        contradictions jsonb NOT NULL DEFAULT '[]'::jsonb,
        created_at text NOT NULL
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS contract_reviews (
        id text PRIMARY KEY,
        matter_id text NOT NULL,
        user_id text NOT NULL,
        title text NOT NULL,
        playbook text NOT NULL,
        source_text text NOT NULL,
        summary text DEFAULT '',
        clauses jsonb NOT NULL DEFAULT '[]'::jsonb,
        requisitions jsonb NOT NULL DEFAULT '[]'::jsonb,
        created_at text NOT NULL
      );
    `);

    await client.query(`
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
    `);

    await client.query(`
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
    `);

    await client.query(`
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
    `);

    await client.query(`
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
    `);

    console.log('[Neon PostgreSQL] Schema successfully verified & provisioned in neondb.');
    schemaInitialized = true;
  } catch (err) {
    console.error('[Neon PostgreSQL] Schema verification error:', err);
  } finally {
    client?.release();
  }
}

/**
 * Loads the complete store state from Neon PostgreSQL if available.
 */
export async function loadStoreFromNeon(): Promise<StoreState | null> {
  const pool = await getNeonPool();
  if (!pool) return null;

  try {
    const [
      users,
      matters,
      researchMemos,
      drafts,
      vaultDocs,
      contractReviews,
      courtroomSessions,
      trackedCases,
      deadlines,
      assistantMsgs,
    ] = await Promise.all([
      pool.query('SELECT * FROM users;'),
      pool.query('SELECT * FROM matters;'),
      pool.query('SELECT * FROM research_memos;'),
      pool.query('SELECT * FROM drafts;'),
      pool.query('SELECT * FROM vault_documents;'),
      pool.query('SELECT * FROM contract_reviews;'),
      pool.query('SELECT * FROM courtroom_sessions;'),
      pool.query('SELECT * FROM tracked_cases;'),
      pool.query('SELECT * FROM deadlines;'),
      pool.query('SELECT * FROM assistant_messages ORDER BY created_at ASC;'),
    ]);

    // If Neon database is completely blank, return null so local state can seed it
    if (users.rows.length === 0 && matters.rows.length === 0) {
      return null;
    }

    return {
      users: users.rows.map((u: any) => ({
        id: u.id,
        email: u.email,
        fullName: u.full_name,
        role: u.role,
        organization: u.organization || '',
        defaultJurisdiction: u.default_jurisdiction,
        isAdmin: Boolean(u.is_admin),
        passwordHash: u.password_hash,
        createdAt: u.created_at,
      })),
      matters: matters.rows.map((m: any) => ({
        id: m.id,
        userId: m.user_id,
        title: m.title,
        matterCode: m.matter_code,
        clientName: m.client_name,
        opposingParty: m.opposing_party || '',
        jurisdiction: m.jurisdiction,
        forum: m.forum,
        status: m.status,
        summaryFacts: m.summary_facts || '',
        createdAt: m.created_at,
        updatedAt: m.updated_at,
      })),
      researchMemos: researchMemos.rows.map((r: any) => ({
        id: r.id,
        matterId: r.matter_id,
        userId: r.user_id,
        query: r.query,
        jurisdiction: r.jurisdiction,
        answerMarkdown: r.answer_markdown,
        citations: r.citations,
        citationIntegrity: r.citation_integrity,
        createdAt: r.created_at,
      })),
      drafts: drafts.rows.map((d: any) => ({
        id: d.id,
        matterId: d.matter_id,
        userId: d.user_id,
        title: d.title,
        docType: d.doc_type,
        content: d.content,
        version: d.version,
        updatedAt: d.updated_at,
      })),
      vaultDocuments: vaultDocs.rows.map((v: any) => ({
        id: v.id,
        matterId: v.matter_id,
        userId: v.user_id,
        fileName: v.file_name,
        mimeType: v.mime_type,
        docCategory: v.doc_category,
        extractedText: v.extracted_text,
        translatedText: v.translated_text,
        targetLanguage: v.target_language,
        chronology: v.chronology,
        contradictions: v.contradictions,
        createdAt: v.created_at,
      })),
      contractReviews: contractReviews.rows.map((c: any) => ({
        id: c.id,
        matterId: c.matter_id,
        userId: c.user_id,
        title: c.title,
        playbook: c.playbook,
        sourceText: c.source_text,
        summary: c.summary,
        clauses: c.clauses,
        requisitions: c.requisitions,
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
        updatedAt: t.updated_at,
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
      meetingBriefs: [],
      whatsappMessages: [],
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
    };
  } catch (err) {
    console.error('[Neon PostgreSQL] Failed to load store from Neon database:', err);
    return null;
  }
}

/**
 * Persists the in-memory state directly to Neon PostgreSQL.
 */
export async function persistStoreToNeon(state: StoreState): Promise<void> {
  const pool = await getNeonPool();
  if (!pool) return;

  let client: PoolClient | null = null;
  try {
    client = await pool.connect();

    // 1. Users upsert
    for (const u of state.users) {
      await client.query(
        `INSERT INTO users (id, email, full_name, role, organization, default_jurisdiction, is_admin, password_hash, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (email) DO UPDATE SET
           full_name = EXCLUDED.full_name,
           role = EXCLUDED.role,
           organization = EXCLUDED.organization,
           default_jurisdiction = EXCLUDED.default_jurisdiction,
           is_admin = EXCLUDED.is_admin,
           password_hash = EXCLUDED.password_hash;`,
        [u.id, u.email, u.fullName, u.role, u.organization, u.defaultJurisdiction, Boolean(u.isAdmin), u.passwordHash, u.createdAt]
      );
    }

    // 2. Matters upsert
    for (const m of state.matters) {
      await client.query(
        `INSERT INTO matters (id, user_id, title, matter_code, client_name, opposing_party, jurisdiction, forum, status, summary_facts, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (id) DO UPDATE SET
           title = EXCLUDED.title,
           opposing_party = EXCLUDED.opposing_party,
           status = EXCLUDED.status,
           summary_facts = EXCLUDED.summary_facts,
           updated_at = EXCLUDED.updated_at;`,
        [m.id, m.userId, m.title, m.matterCode, m.clientName, m.opposingParty, m.jurisdiction, m.forum, m.status, m.summaryFacts, m.createdAt, m.updatedAt]
      );
    }

    // 3. Drafts upsert
    for (const d of state.drafts) {
      await client.query(
        `INSERT INTO drafts (id, matter_id, user_id, title, doc_type, content, version, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET
           title = EXCLUDED.title,
           content = EXCLUDED.content,
           version = EXCLUDED.version,
           updated_at = EXCLUDED.updated_at;`,
        [d.id, d.matterId, d.userId, d.title, d.docType, d.content, d.version, d.updatedAt]
      );
    }

    // 4. Research memos upsert
    for (const r of state.researchMemos) {
      await client.query(
        `INSERT INTO research_memos (id, matter_id, user_id, query, jurisdiction, answer_markdown, citations, citation_integrity, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO NOTHING;`,
        [r.id, r.matterId, r.userId, r.query, r.jurisdiction, r.answerMarkdown, JSON.stringify(r.citations), JSON.stringify(r.citationIntegrity), r.createdAt]
      );
    }

    // 5. Vault documents upsert
    for (const v of state.vaultDocuments) {
      await client.query(
        `INSERT INTO vault_documents (id, matter_id, user_id, file_name, mime_type, doc_category, extracted_text, translated_text, target_language, chronology, contradictions, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (id) DO NOTHING;`,
        [v.id, v.matterId, v.userId, v.fileName, v.mimeType, v.docCategory, v.extractedText, v.translatedText || '', v.targetLanguage || '', JSON.stringify(v.chronology), JSON.stringify(v.contradictions), v.createdAt]
      );
    }

    // 6. Deadlines upsert
    for (const dl of state.deadlines) {
      await client.query(
        `INSERT INTO deadlines (id, matter_id, user_id, title, statute_article, trigger_date, due_date, grace_date, completed, notes, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO UPDATE SET
           completed = EXCLUDED.completed,
           notes = EXCLUDED.notes;`,
        [dl.id, dl.matterId, dl.userId, dl.title, dl.statuteArticle || '', dl.triggerDate, dl.dueDate, dl.graceDate || null, dl.completed, dl.notes || '', dl.createdAt]
      );
    }
  } catch (err) {
    console.error('[Neon PostgreSQL] Failed to sync store snapshot:', err);
  } finally {
    client?.release();
  }
}
