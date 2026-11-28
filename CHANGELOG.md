# VidhiOS — Changelog (`CHANGELOG.md`)

## [2.0.0] — 2026-11-28
### Security & Multi-Tenancy (P0)
- Eliminated predictable `SESSION_SECRET` fallback derived from `DATABASE_URL` or hardcoded production strings.
- Removed administrator privileges from the public 1-click demo user (`chambers@vidhios.in`).
- Stopped `ensureDefaultAdminAccount()` from resetting `vidhios@admin.com` password on server restarts.
- Added HTTP-only session cookies with double-submit CSRF protection, token revocation (`POST /api/auth/logout`), and rate limiting on `/api/auth` & `/api/ai`.
- Introduced organization-level multi-tenancy (`organizations`, `organization_members`, `subscriptions`, `clients`, `tasks`, `hearings`, `notifications`, `activity_logs`, `audit_events`) and matter-level authorization.
- Fixed Neon persistence gaps (`meeting_briefs`, `whatsapp_messages` tables added; transactional `BEGIN`/`COMMIT` persistence; awaited cascade deletes; explicit error propagation).

### AI Legal Intelligence & Product Experience (P1–P3)
- Refined UI into a clean, restrained warm-alabaster & deep-teal enterprise design system (`src/components/ui/DesignSystem.tsx`, `src/index.css`).
- Expanded workspace to 18 lazy-loaded modules + Admin Console (`src/App.tsx`), shrinking main JS bundle from 527.9 kB to 297.1 kB.
- Upgraded Overview dashboard with real DB-backed case status distribution, 7-day workload, assigned tasks, notifications, and WhatsApp slash command console.
- Upgraded Legal Research with 6-tier source hierarchy, verification status badges, structured search filters, and Precedent Conflict Detector.
- Built 7-agent controlled Multi-Agent Orchestrator with human-in-the-loop approval (`src/server/agentOrchestrator.ts`).
- Upgraded Drafting Studio with version history comparison, review status, PDF print export, and template validation metadata across all 13 judiciary forms.
- Upgraded Document Vault with unified matter timeline, entity/amount/statute extraction, processing statuses, and human text corrections.
- Added Corporate Intelligence (provider abstraction + labeled sandbox mock), Translation Studio (10 Indian languages), Meeting Assistant, Court Calendar, Legal Library, Knowledge Graph, Litigation Strategy, Evidence Intelligence, Analytics, Team & Clients, and Admin Health/Audit Console.
