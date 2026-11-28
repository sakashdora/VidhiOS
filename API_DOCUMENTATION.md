# VidhiOS — API Documentation (`API_DOCUMENTATION.md`)

All authenticated routes accept either `Authorization: Bearer <token>` or the HTTP-only `vidhios_session` cookie (paired with `x-csrf-token` header on state-changing requests).

## Health & Authentication
- `GET /api/health` — Storage engine, Neon connectivity & latency, AI provider status, system counts, API metrics.
- `POST /api/auth/register` — Register user, auto-provision organization & FREE subscription, return `{ token, csrfToken, user }`.
- `POST /api/auth/login` — Authenticate via `scrypt` + `timingSafeEqual`, set HTTP-only session cookie, log audit event.
- `POST /api/auth/demo` — Launch isolated non-admin demo chambers session (`chambers@vidhios.in`).
- `POST /api/auth/logout` — Revoke current session `jti` and clear auth cookies.
- `GET /api/auth/me` — Fetch current user & organization subscription.

## Workspace, Matters, Clients, Tasks & Hearings
- `GET /api/workspace` — Full organization- and matter-scoped workspace bundle.
- `POST /api/matters` · `PATCH /api/matters/:id` · `DELETE /api/matters/:id` — Matter lifecycle management (cascades Neon deletes).
- `POST /api/clients` — Create client profile with optional matter-scoped portal flag.
- `POST /api/tasks` · `PATCH /api/tasks/:id` — Create and toggle/update matter tasks.
- `POST /api/hearings` — Log court hearing outcomes and adjournment notes.
- `PATCH /api/notifications/:id/read` — Mark notification read.

## Legal Research, AI Workflows & Translation
- `POST /api/ai/research` · `POST /api/ai/research/stream` (SSE) — Grounded legal research with filters (`court`, `judge`, `statute`, `caseName`, `citation`), 6-tier source hierarchy, and Precedent Conflict Detector.
- `POST /api/ai/assistant` · `DELETE /api/ai/assistant` — Bilingual (EN/HI/Hinglish) task-executing assistant.
- `POST /api/ai/workflows/run` · `POST /api/ai/workflows/:id/approve` — Multi-agent 7-agent orchestrator with human-in-the-loop approval.
- `POST /api/ai/translate` — Bilingual side-by-side legal translation across 10 Indian languages.
- `POST /api/ai/case-analysis` — Supreme Court / High Court maintainability & precedent report.

## Drafting, Judiciary Forms, Vault, Contracts & Courtroom
- `POST /api/drafts` · `PATCH /api/drafts/:id` — Save drafts with automatic version snapshots and review status.
- `POST /api/ai/draft-generate` · `POST /api/ai/draft-rewrite` — Generate full pleadings or rewrite highlighted selections.
- `POST /api/ai/judiciary-form` · `POST /api/ai/judiciary-form/stream` (SSE) — Generate any of 13 Indian Judiciary Forms.
- `POST /api/export/docx` — Export court-formatted `.docx` OOXML binary.
- `POST /api/ai/vault-process` · `PATCH /api/vault/:id` — OCR, entity/date/party/amount extraction, chronology, contradiction checks, and human corrections.
- `POST /api/ai/contract-redline` · `PATCH /api/contract-reviews/:reviewId/clauses/:clauseId` — Playbook contract review & clause accept/reject.
- `POST /api/ai/courtroom/start` · `POST /api/ai/courtroom/:sessionId/reply` — Bench / Opposing Counsel oral rehearsal.
- `POST /api/ai/meeting-brief` · `POST /api/whatsapp/command` — Audio/transcript briefs & slash commands (`/bns`, `/hearings`, `/deadlines`, `/remind`, `/brief`).

## Corporate, Intelligence, Subscriptions & Admin
- `POST /api/corporate/lookup` — Corporate CIN/company lookup (licensed MCA provider or clearly labeled sandbox mock).
- `GET /api/intelligence/graph?matterId=...` — Legal Knowledge Graph & Precedent Conflicts.
- `POST /api/intelligence/strategy` · `POST /api/intelligence/evidence` — Litigation Strategy Board & Exhibit Register.
- `POST /api/subscription/upgrade` — Organization tier upgrade (sandbox mode until payment gateway is connected).
- `GET /api/admin/overview` · `GET/POST/PUT/DELETE /api/admin/users` · `POST /api/admin/users/:id/reset-password` · `POST /api/admin/organizations/:orgId/subscription` — Admin governance & telemetry.
