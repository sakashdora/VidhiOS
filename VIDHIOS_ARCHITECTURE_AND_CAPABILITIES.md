# VidhiOS — Complete R&D Architecture & Capabilities Dossier

> **Purpose:** Single-source technical reference detailing everything inside **VidhiOS** (`d:\NYAYAPREET`), how each subsystem is engineered, and what the platform actually executes at runtime across client, deterministic legal engines, AI services, persistence, and serverless deployment.

---

## 1. Executive Summary

**VidhiOS** is a full-stack legal operations, research, and court-drafting workspace designed for **Judges, Advocates, and Law Students**, with primary support for **Indian Litigation (BNS / BNSS / BSA 2023, Supreme Court & High Courts)** alongside **Corporate M&A** and **International Arbitration (SIAC / UNCITRAL)** modes.

Its core architectural principle is **deterministic-first grounding**: statutory crosswalks (IPC/CrPC/IEA → BNS/BNSS/BSA), limitation math (Limitation Act Sec. 4 & Arbitration Act Sec. 34), 13 court-formatted pleading templates, `.DOCX` OOXML generation, and citation parsing execute in pure TypeScript with **31 unit tests**, while generative workflows (research memos, case analysis, courtroom simulation, OCR/chronology, contract redlining, and bilingual Hindi/English assistance) are routed through server-side AI engines (**NVIDIA NIM** and **Google Gemini**) grounded by matter facts and structured precedent data.

---

## 2. Technology Stack & Deployment Topology

| Layer | Technologies & Versions (`package.json`) |
|---|---|
| **Frontend** | React `19.0.1`, TypeScript `7.0.2`, Vite `8.3.0` (`@vitejs/plugin-react`), Tailwind CSS `4.3.3` (`@tailwindcss/vite`), `lucide-react`, `motion` |
| **Backend** | Express `4.21.2`, Zod `4.6.7`, `dotenv`, Node.js ESM (`target=node20` via `esbuild 0.28.0`) |
| **Document Export** | `docx` `9.16.0` (server & client OOXML `.docx` generation) |
| **AI Engines** | NVIDIA NIM API (`nvidiaService.ts` — `mistralai/mistral-large-4-1t-a52b` & `nvidia/nemotron-3.5-lightning-30b-a3b`), Google Gemini (`@google/genai 3.6.1` via `geminiService.ts`) |
| **Database & Storage** | Neon Serverless PostgreSQL (`pg 8.23.1`, `@neondatabase/serverless 1.2.1`) with automatic schema provisioning, plus local JSON durable fallback (`data/vidhios-store.json`) |
| **Deployment Targets** | **Vercel** (`vercel.json` + pre-bundled `api/index.js` from `src/server/apiHandler.ts` + static `dist/`), **Node standalone** (`server.js` from `server.ts`), and **Netlify** (`netlify/functions/api.ts`) |

---

## 3. Repository & Codebase Map

```text
d:\NYAYAPREET\
├── api/
│   └── index.js                       # Pre-bundled Vercel Serverless API handler (built from apiHandler.ts)
├── src/
│   ├── App.tsx                        # Authenticated workspace shell, matter switcher, module router, dark mode
│   ├── main.tsx                       # React root + ErrorBoundary
│   ├── index.css                      # Tailwind v4 theme tokens & warm-alabaster/deep-teal design system
│   ├── types/
│   │   └── legal.ts                   # Shared TypeScript domain contracts (Matter, DraftDocument, etc.)
│   ├── lib/
│   │   ├── api.ts                     # Typed fetch + SSE streaming client (in-memory Bearer token)
│   │   └── legal/                     # Deterministic legal engines + 31 unit tests (*.test.ts)
│   │       ├── assistantEngine.ts     # Bilingual (EN/HI/Hinglish) intent classifier & deterministic replies
│   │       ├── citationParser.ts      # Lossless parser for Indian/international cases, statutes & BNS links
│   │       ├── docxExporter.ts        # OOXML .docx court pleading generator & filename sanitizer
│   │       ├── judiciaryTemplates.ts  # 13 Indian Judiciary Form templates (482 BNSS, 63 BSA, SLP, Writ, etc.)
│   │       ├── limitationCalculator.ts# Statutory limitation & Arbitration Sec. 34 calculator (Sec. 4 roll-forward)
│   │       ├── responseFormatter.ts   # Strips <think> tags, markdown noise & formats plain court text
│   │       ├── statuteCrosswalk.ts    # Bidirectional IPC/CrPC/IEA <-> BNS/BNSS/BSA mapping & draft scanner
│   │       ├── supremeCourtCorpus.ts  # Curated Supreme Court & High Court precedent corpus & retriever
│   │       └── whatsappParser.ts      # Slash-command (/bns, /hearings, /deadlines, /remind, /brief) parser
│   ├── components/                    # Frontend UI modules
│   │   ├── AuthGate.tsx               # Landing page, live deterministic sandbox, Sign In / Register & Demo entry
│   │   ├── OverviewModule.tsx         # Chambers command overview, matters CRUD, WhatsApp command center
│   │   ├── VidhiAssistantModule.tsx   # Bilingual (English / हिंदी / Hinglish) task-executing assistant
│   │   ├── ResearchModule.tsx         # SSE streaming legal research + CaseAnalysisPanel
│   │   ├── CaseAnalysisPanel.tsx      # Supreme Court / High Court maintainability & precedent analyzer
│   │   ├── DraftingModule.tsx         # Legal draft editor, AI draft/rewrite, BNS scanner, .DOCX export
│   │   ├── JudiciaryFormsPanel.tsx    # 13 Court Forms generator with SSE streaming & .DOCX download
│   │   ├── CourtroomModule.tsx        # Multi-turn Bench / Opposing Counsel oral argument simulator
│   │   ├── ContractRedlineModule.tsx  # Playbook-driven contract redline & due diligence matrix
│   │   ├── VaultModule.tsx            # Document OCR, chronology (List of Dates), contradiction & translation
│   │   ├── CaseTrackerModule.tsx      # Tracked hearings, cause list metadata & Limitation Act deadlines
│   │   ├── AdminPanel.tsx             # Admin user management (create, edit, password reset, delete)
│   │   └── CitationTextRenderer.tsx   # Interactive citation highlighting in research & assistant outputs
│   └── server/
│       ├── apiHandler.ts              # Vercel serverless entry point wrapping createExpressApp
│       ├── createApp.ts               # Express app factory, Zod validation, all REST & SSE endpoints
│       ├── auth.ts                    # scrypt password hashing, timingSafeEqual, HMAC-SHA256 session tokens
│       ├── repository.ts              # WorkspaceRepository (per-user isolation, Neon sync + local fallback)
│       ├── neonDatabase.ts            # Neon PostgreSQL pool, DoH fallback, schema DDL, upsert & delete ops
│       ├── nvidiaService.ts           # NVIDIA NIM chat/streaming, case analysis, judiciary forms, assistant
│       ├── geminiService.ts           # Gemini multimodal/text services (research, drafting, OCR, audio)
│       ├── realtimeLegalSearch.ts     # Live legal search / precedent grounding helper
│       └── seedData.ts                # Realistic per-user seeded matters, memos, drafts, vault & deadlines
├── server.ts                          # Standalone Node/Vite dev & production server entry
├── vercel.json                        # Vercel build, /api/* rewrites, SPA fallback & security headers
└── package.json                       # Scripts: dev, build, start, test, lint
```

---

## 4. What Each Subsystem Actually Does

### 4.1 Frontend Workspace (`src/App.tsx` & `src/components/`)
1. **Authentication & Live Sandbox (`AuthGate.tsx`)**:
   - **Above-the-fold Sign In / Register** (`POST /api/auth/login`, `POST /api/auth/register`) and **1-click Instant Demo** (`POST /api/auth/demo`).
   - **Live Deterministic Preview** usable before sign-in:
     - *BNS Audit*: Scans pasted pleadings for repealed IPC/CrPC/IEA citations and upgrades them in-place to BNS/BNSS/BSA 2023.
     - *Limitation Math*: Computes exact statutory filing dates, days remaining, Sunday roll-forwards, and Arbitration Sec. 34 outer caps.
     - *Clause Redline*: Interactive preview of counterparty vs. balanced Sec. 73 Indian Contract Act clause diff.
   - **Role Workflows**: Dedicated views for Judges, Advocates, and Law Students.
2. **9 Workspace Modules (`App.tsx`)**:
   - **Command Overview (`OverviewModule.tsx`)**: Create/delete matters across `india_litigation`, `corporate_ma`, and `global_multi`; run quick WhatsApp-style chamber commands (`/hearings`, `/deadlines`, `/bns`, `/remind`, `/brief`).
   - **VidhiOS Assistant (`VidhiAssistantModule.tsx`)**: Bilingual (`auto` / `en` / `hi` / `bilingual`) assistant that executes real workspace actions—creating court drafts, pinning deadlines to the active matter, running statute lookups, or performing case analysis—with source pills and `[Verification Required]` safeguards.
   - **Legal Research (`ResearchModule.tsx` + `CaseAnalysisPanel.tsx`)**: Real-time SSE streaming research (`POST /api/ai/research/stream`) with live stage updates, precedent grounding, and Supreme Court/High Court maintainability scoring.
   - **Drafting & Forms (`DraftingModule.tsx` + `JudiciaryFormsPanel.tsx`)**: Create, edit, AI-generate, AI-rewrite, BNS-validate, and export court-formatted `.DOCX` pleadings across 13 judiciary templates.
   - **Courtroom Simulator (`CourtroomModule.tsx`)**: Multi-turn oral argument rehearsal against `bench` or `opposing_counsel`, returning weakness flags, suggested rebuttals, and authorities.
   - **Contract Redline & DD (`ContractRedlineModule.tsx`)**: Playbook-based clause risk analysis with side-by-side redlines, accept/reject decisions (`PATCH /api/contract-reviews/:reviewId/clauses/:clauseId`), and due-diligence requisitions.
   - **Document Vault & OCR (`VaultModule.tsx`)**: Accepts PDF/image/text exhibits, extracts text, generates a chronological **List of Dates**, flags cross-document contradictions, and translates into target Indian languages.
   - **Cases & Limitation (`CaseTrackerModule.tsx`)**: Tracks court numbers, CNR, courtroom, bench, cause-list item, hearing status (`listed`, `in_session`, `adjourned`, `disposed`), and statutory deadlines with completion toggles.
   - **Admin Panel (`AdminPanel.tsx`)**: Visible to administrators (`isAdmin` / `vidhios@admin.com` / `chambers@vidhios.in`); supports listing users with matter/draft/vault counts, creating users, updating roles/jurisdictions, resetting passwords, and deleting users.

### 4.2 Deterministic Legal Engines (`src/lib/legal/`)
All engines below run without LLM calls and are covered by `npm test` (31 tests):
- **`statuteCrosswalk.ts`**: Bidirectional mapping (`STATUTE_CROSSWALK`) between IPC/CrPC/IEA and BNS/BNSS/BSA 2023; `scanDraftForLegacyCitations()` and `applyCitationReplacements()` rewrite legacy citations in drafts.
- **`limitationCalculator.ts`**: `LIMITATION_RULES` + `calculateLimitationDeadline()` implementing Indian Limitation Act Sec. 4 (rolls Sunday due dates forward to Monday) and Arbitration & Conciliation Act Sec. 34(3) (3 months + strict 30-day non-extendable grace window).
- **`judiciaryTemplates.ts`**: 13 structured court templates (`JUDICIARY_FORM_TEMPLATES`), including Sec. 63 BSA Electronic Evidence Certificate (Schedule Part A & B), Sec. 482 BNSS Anticipatory Bail, Art. 136 SLP, Art. 226 Writ Petition, Vakalatnama, Caveat, Sec. 138 NI Demand Notice, Counter/Rejoinder Affidavits, etc.
- **`docxExporter.ts`**: Builds valid OOXML `.docx` ZIP buffers (`buildCourtDocxBuffer` / `buildCourtDocxBlob`) with court Cause Title, matter code, numbered paragraphs, and sanitized filenames (`sanitizeDocxFilename`).
- **`supremeCourtCorpus.ts` & `citationParser.ts`**: Curated `SUPREME_COURT_CORPUS` (e.g., *Lalit Chaturvedi*, *Delhi Race Club*, *Arnesh Kumar*, *Sushila Aggarwal*, *Arjun Panditrao Khotkar*) and lossless `parseLegalCitations()` supporting Indian, constitutional, commercial, and international citations.
- **`assistantEngine.ts`**: `detectResponseLanguage()` (English, Devanagari Hindi, Hinglish) and `classifyAssistantIntent()` routing deterministic queries (statutes, limitation math, matter status, precedent lookup, form drafting) before falling back to grounded AI.
- **`responseFormatter.ts`**: Strips `<think>` blocks, redundant markdown fences, and formats clean plain-text court filings.
- **`whatsappParser.ts`**: Parses `/help`, `/hearings`, `/cases`, `/deadlines`, `/bns`, `/remind`, `/brief`, and freeform queries.

### 4.3 Authentication, Persistence & Security (`src/server/`)
- **Session & Password Security (`auth.ts`)**:
  - Passwords hashed with `crypto.scryptSync` + 16-byte random salt and verified with `crypto.timingSafeEqual`.
  - Stateless 7-day Bearer tokens signed with HMAC-SHA256 (`SESSION_SECRET`, falling back to a SHA-256 hash of `DATABASE_URL` when `SESSION_SECRET` is unset).
  - Client holds token strictly in JS memory (`src/lib/api.ts`), never `localStorage` or `sessionStorage`.
- **Database & Serverless Sync (`neonDatabase.ts` + `repository.ts`)**:
  - Automatically provisions 10 PostgreSQL tables (`users`, `matters`, `research_memos`, `drafts`, `vault_documents`, `contract_reviews`, `courtroom_sessions`, `tracked_cases`, `deadlines`, `assistant_messages`).
  - Uses DNS-over-HTTPS (`dns.google`) fallback in local/dev environments if UDP port 53 is blocked; native DNS in Vercel/production.
  - Every mutation route in `createApp.ts` awaits `repository.persist()` before returning the HTTP response so Vercel Serverless Lambdas never freeze before Neon writes complete.
  - Deletions (`adminDeleteUser`, `deleteMatter`) execute targeted `DELETE` queries in Neon (`deleteUserFromNeon`, `deleteMatterFromNeon`).

---

## 5. Complete API Surface (`src/server/createApp.ts`)

| Category | Method & Route | Auth | Purpose |
|---|---|---|---|
| **Health** | `GET /api/health` | Public | Storage engine, Neon connectivity & latency, AI config status |
| **Auth** | `POST /api/auth/register` | Public | Register user, seed starter matters, issue token |
| | `POST /api/auth/login` | Public | Verify email/password (`scrypt`), issue token |
| | `POST /api/auth/demo` | Public | Instant entry as `chambers@vidhios.in` |
| **Admin** | `GET /api/admin/users` | Admin | Reload from Neon & list all users with record counts |
| | `POST /api/admin/users` | Admin | Create user with optional `isAdmin` |
| | `PUT /api/admin/users/:id` | Admin | Update user profile, role, jurisdiction, or admin flag |
| | `POST /api/admin/users/:id/reset-password` | Admin | Reset user password (min 8 chars) |
| | `DELETE /api/admin/users/:id` | Admin | Delete user & cascade-delete all owned Neon records |
| **Workspace** | `GET /api/workspace` | Bearer | Fetch full user-scoped workspace bundle |
| **Matters** | `POST /api/matters` · `DELETE /api/matters/:id` | Bearer | Create or cascade-delete a matter |
| **Drafts** | `POST /api/drafts` · `PATCH /api/drafts/:id` | Bearer | Save or version-increment a legal draft |
| **Redlines** | `PATCH /api/contract-reviews/:reviewId/clauses/:clauseId` | Bearer | Accept/reject a redlined clause |
| **Docket** | `POST /api/cases` · `PATCH /api/cases/:id` | Bearer | Add tracked case or update hearing status |
| | `POST /api/deadlines` · `PATCH /api/deadlines/:id/toggle` | Bearer | Add statutory deadline or toggle completion |
| **Commands** | `POST /api/whatsapp/command` | Bearer | Execute `/hearings`, `/bns`, `/remind`, `/brief`, or AI query |
| **AI & Export** | `POST /api/ai/research` · `/api/ai/research/stream` | Bearer | Grounded legal research (JSON or SSE stream) |
| | `POST /api/ai/draft-generate` · `/api/ai/draft-rewrite` | Bearer | Generate full pleading or rewrite selected text |
| | `POST /api/ai/courtroom/start` · `/:sessionId/reply` | Bearer | Start or continue Bench/Opposing Counsel simulation |
| | `POST /api/ai/contract-redline` | Bearer | Playbook-driven contract risk & redline analysis |
| | `POST /api/ai/vault-process` | Bearer | OCR, chronology, contradiction & translation |
| | `POST /api/ai/meeting-brief` | Bearer | Audio/transcript transcription & client brief |
| | `POST /api/ai/case-analysis` | Bearer | Supreme Court / High Court maintainability analysis |
| | `POST /api/ai/judiciary-form` · `/stream` | Bearer | Generate any of 13 judiciary forms (JSON or SSE) |
| | `POST /api/export/docx` | Bearer | Export court-formatted `.docx` binary |
| | `POST /api/ai/assistant` · `DELETE /api/ai/assistant` | Bearer | Bilingual assistant turn or clear history |

---

## 6. Build & Verification Commands

```bash
npm run lint    # TypeScript typecheck (tsc --noEmit)
npm test        # 31 deterministic legal engine unit tests (tsx --test src/lib/legal/*.test.ts)
npm run build   # Vite client bundle (dist/) + esbuild server.js + esbuild api/index.js
npm run dev     # Local Express + Vite dev server (tsx server.ts)
```
