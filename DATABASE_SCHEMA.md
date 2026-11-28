# VidhiOS — Database Schema & Multi-Tenant Model (`DATABASE_SCHEMA.md`)

## Storage Strategy
- **Primary Database:** Neon Serverless PostgreSQL (`src/server/neonDatabase.ts`).
- **Auto-Provisioning & Forward Migrations:** `initNeonSchema()` runs `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` with indexes on `organization_id`, `user_id`, `matter_id`, and `created_at` without destroying existing records.
- **Transactional Integrity:** `persistStoreToNeon()` executes inside `BEGIN ... COMMIT` (`ROLLBACK` on failure) and surfaces connection/persistence errors explicitly rather than silently faking success when Neon is configured.
- **Development Fallback:** Only used when `DATABASE_URL` and `NEON_DATABASE_URL` are unconfigured (`data/vidhios-store.json`).

## Core Tables

| Table | Purpose | Key Isolation / Index Columns |
|---|---|---|
| `organizations` | Multi-tenant law firm / chamber / institution entity | `id`, `slug`, `tier` |
| `organization_members` | User-to-org role & permission mapping | `organization_id`, `user_id`, `role` |
| `users` | Account credentials (`scrypt` hash), profile, `is_admin` | `id`, `email`, `organization_id` |
| `clients` | Client profiles & portal access flag | `organization_id`, `user_id` |
| `matters` | Legal cases/matters with forum, CNR, facts, status | `id`, `user_id`, `organization_id` |
| `tasks` | Matter-linked tasks & assignments | `organization_id`, `matter_id` |
| `hearings` | Hearing history, outcomes, adjournment logs | `organization_id`, `matter_id` |
| `research_memos` | IRAC research memos, search filters, citations | `matter_id`, `user_id` |
| `drafts` | Legal drafts with `status` & JSON `versions` history | `matter_id`, `user_id` |
| `vault_documents` | Uploaded exhibits, OCR text, entities, chronology, contradictions | `matter_id`, `user_id` |
| `contract_reviews` | Playbook redlines, clause decisions, requisitions | `matter_id`, `user_id` |
| `courtroom_sessions` | Bench / Opposing Counsel argument sessions | `matter_id`, `user_id` |
| `tracked_cases` | Cause list & hearing tracker entries | `matter_id`, `user_id` |
| `deadlines` | Statutory & Limitation Act deadlines | `matter_id`, `user_id` |
| `meeting_briefs` | Consultation transcripts, summaries & action items | `matter_id`, `user_id` |
| `whatsapp_messages` | Chambers slash-command log | `user_id`, `matter_id` |
| `assistant_messages` | Bilingual assistant conversation history | `user_id`, `matter_id` |
| `notifications` | User/chambers alerts with read status | `user_id`, `read` |
| `activity_logs` | Organization activity stream | `organization_id`, `created_at` |
| `audit_events` | Security & access audit trail | `organization_id`, `created_at` |
| `subscriptions` | Plan tier (`FREE`/`PRO`/`CHAMBERS`/`ENTERPRISE`) & usage metering | `organization_id` |
| `workflow_runs` | Multi-agent execution logs & human approval status | `organization_id`, `user_id` |
| `corporate_profiles` | Corporate CIN master, directors, charges, filings | `organization_id`, `cin` |
| `evidence_items` | Exhibit numbers, witnesses & Sec. 63 BSA admissibility | `organization_id`, `matter_id` |
| `litigation_strategies` | Case theory, issues, weaknesses & cross-exam prep | `organization_id`, `matter_id` |
| `revoked_tokens` | Revoked JWT/HMAC session `jti` IDs until expiry | `jti`, `expires_at` |
