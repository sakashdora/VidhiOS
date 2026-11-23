# VidhiOS — Next-Generation AI Legal Intelligence Workspace

A direct, workspace-first AI legal operating system designed to surpass NyayAssist across **Indian Litigation**, **Corporate M&A / Commercial Due Diligence**, and **Global Multi-Jurisdiction Practice**, uniting citation-grounded legal research, statute-validated drafting, adversarial courtroom simulation, contract redlining, multimodal document intelligence, live case tracking, and mobile-style command workflows inside one matter-centric platform.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> Please review the confirmed choices and the hosting/database alignment note below before clicking **Proceed**.

- **Confirmed — Workspace-First Structure**: Launches directly into the authenticated legal workspace with zero marketing pages.
- **Confirmed — Multi-Domain Legal Coverage**: Unified support for all three practice modes—**Indian Litigation (SC/HC/District/BNS)**, **Corporate & M&A Due Diligence**, and **Global Multi-Jurisdiction (US/UK/EU/SIAC)**—switchable globally and per matter.
- **Confirmed — Full Next-Gen Capability Suite**: Includes IPC→BNS/CrPC→BNSS/IEA→BSA Statute Crosswalk & Draft Validator, Adversarial Courtroom Simulator (Bench & Opposing Counsel), Contract Redline & Playbook Risk Matrix, Multimodal OCR + Auto-Chronology + Contradiction Detector + Bilingual Translation, Case Tracker + Cause Lists + Limitation Act Calculator, and WhatsApp Command Center Simulator + AI Meeting Assistant.
- **Database, Accounts & Deployment Strategy (Key Alignment)**:
  - You requested **full accounts with Supabase, Vercel, and Cloudflare**. Because external Supabase, Vercel, and Cloudflare accounts cannot be provisioned directly from inside this sandbox, **recommended default** is to provision a live hosted **Cloud SQL for PostgreSQL** database (managed via **Drizzle ORM**) paired with **Google Sign-In Authentication** right here so the live app immediately persists real user accounts, matters, drafts, redlines, and tracked cases in PostgreSQL.
  - Simultaneously, we will structure standard PostgreSQL schemas, clean serverless-ready REST boundaries, and deployment configuration templates (`vercel.json` + Cloudflare-compatible edge security/cache headers) so the repository can be deployed directly to **Vercel + Cloudflare** and pointed to **Supabase PostgreSQL** with minimal environment setup whenever you export.
  - Upon clicking **Proceed**, the platform will present the one-click PostgreSQL setup confirmation card before database creation begins.

---

## 1. Overview & Core Concept

- **What It Does**: VidhiOS replaces fragmented legal research portals, Word editors, PDF OCR utilities, spreadsheets, and court trackers with a single **Matter-Centric AI Workspace**. Every research memo, uploaded annexure, meeting transcript, statutory check, redlined contract, and hearing deadline lives inside a persistent Matter so every AI action operates with full case context.
- **Target Audience / Personas**:
  - **Litigating Advocates & Chambers (India & Common Law)**: Drafting petitions/plaints/bail applications, converting legacy IPC/CrPC/IEA references to BNS/BNSS/BSA, preparing Lists of Dates, rehearsing oral arguments against an AI Bench, and monitoring hearing cause lists & Limitation Act deadlines.
  - **Corporate Counsel & M&A Teams**: Reviewing vendor/client contracts against structured commercial playbooks, generating clause-level redlines and issue matrices, and running bulk document due diligence requisitions.
  - **Cross-Border Arbitration & Multi-Jurisdiction Teams**: Conducting comparative statutory analysis across India, UK, US, EU, and SIAC/ICC frameworks and translating multilingual filings without losing legal terminology.
- **Key Value Over NyayAssist**:
  1. **Active Verification, Not Just Generation**: Live web-grounded citations with clickable sources plus deterministic statutory checks (IPC→BNS crosswalk & Limitation Act deadline math).
  2. **Adversarial Stress-Testing**: Practice oral arguments and expose brief vulnerabilities before stepping into court.
  3. **Clause-Level Actionability**: Interactive side-by-side contract redlining with one-click accept/reject and cross-document contradiction detection across uploaded evidence.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Authentication & Instant Workspace Entry**:
   - Unauthenticated visitors see a focused, single-panel sign-in screen with Google Sign-In.
   - Upon sign-in, the user lands directly on the **Matter Command Workspace** with an active starter matter (or prompt to create their first matter), immediately displaying upcoming hearings, limitation alerts, and quick-launch launchers for all 8 workspace modules.
2. **Matter Context Switching**:
   - Selecting any Matter from the persistent left sidebar updates the active **Jurisdiction Mode** (Indian Litigation / Corporate M&A / Global Multi-Jurisdiction) and scopes Research, Drafting, Courtroom Simulator, Redlining, Vault, Case Tracker, and WhatsApp Commands to that matter's facts and uploaded documents.
3. **End-to-End Litigation & Drafting Loop**:
   - Upload a scanned FIR, court order, or notice in **Document Vault** → run **OCR + Auto-Chronology** → review extracted *List of Dates* and flagged *Contradictions* → click **"Send to Drafting Studio"** → generate a petition/reply → run **"Validate BNS/BNSS/BSA Citations"** to replace repealed IPC/CrPC sections inline → click **"Stress-Test in Courtroom Simulator"** to rehearse Bench and Opposing Counsel questions.
4. **End-to-End Corporate Redline & Due Diligence Loop**:
   - Upload or paste an MSA/SHA/NDA into **Contract Redline & DD** → pick a Playbook (Indian Commercial & Arbitration Act, M&A Buyer-Side, or UK/US Cross-Border) → inspect the **Risk Matrix** sorted by severity → review interactive redline diffs clause by clause → Accept/Reject proposed rewrites → export clean revised draft and DD Requisition Report.
5. **Courtroom Readiness & On-the-Go Ops**:
   - Add cases to **Case Tracker** → view **Daily Cause List & Live Board** → compute statutory filing deadlines with the **Limitation Act Calculator** → add deadline to the Matter Calendar → issue natural-language or slash commands in the **WhatsApp Command Center** (e.g., `/next hearings`, `/bns 420`, `/remind`) or record/upload a client call in **Meeting Assistant** for automated transcription and fact extraction.

### Visual Identity & Theme

- **Aesthetic Direction**: Refined **Editorial-Grade Legal SaaS** — authoritative, calm, high-density without clutter. Built for long reading and drafting sessions rather than flashy marketing gimmicks.
- **Dual-Theme Color Palette (60-30-10 Discipline)**:
  - *Light Mode (Default for legal reading)*:
    - 60% Neutral Canvas: Crisp alabaster paper (`#F8FAFC` / `--background`)
    - 30% Structural Surfaces: Pure white panels (`#FFFFFF` / `--surface`) separated by crisp `1px` slate hairlines (`#E2E8F0` / `--border`) and deep ink text (`#0F172A` / `--foreground`, muted `#475569`)
    - 10% Accent Budget: Judicial Cobalt (`#1D4ED8` / `--primary`) reserved strictly for active navigation, primary CTA buttons, and focused controls, with muted Slate/Indigo hover fills
  - *Dark Mode (Toggleable via Tailwind v4 `@custom-variant dark`)*:
    - 60% Deep Slate Canvas (`#0B1120`), 30% Elevated Slate Panels (`#111827`, hairline `#1E293B`), optically compensated crisp light typography (`#F1F5F9` with subtle `+0.01em` tracking)
  - *Semantic State Colors (Always Paired with Explicit Text Labels)*:
    - Verified / Safe / Accepted: Forest Green (`#15803D`)
    - Caution / Approaching Limitation / Medium Risk: Warm Amber (`#B45309`)
    - Repealed Statute / Overdue / High Risk: Crimson (`#B91C1C`)
- **Typography & Hierarchy (2+1 Font Rule)**:
  - *Display & Navigation*: **Plus Jakarta Sans** (SemiBold 600–700, `text-wrap: balance` on headings)
  - *Dense Legal Body & Tables*: **DM Sans** (Regular 400–500, 14px–15px UI / 15px–16px legal document prose at `1.65` line-height and `65ch–75ch` measure)
  - *Citations, Case Numbers, Limitation Counters & Clauses*: **JetBrains Mono** with `font-variant-numeric: tabular-nums` for perfect vertical alignment across cause lists, risk matrices, and date chronologies.
- **Component Styling & Spatial Discipline**:
  - **Workspace Shell**: `256px` fixed left sidebar (brand wordmark, active matter switcher, grouped module navigation, theme toggle, user profile) + single-row top bar (`Matter / Active Module` breadcrumb on the left, Jurisdiction Mode selector & 1 primary action button on the right, all `whitespace-nowrap shrink-0`).
  - **Single-Elevation Flat Geometry**: Hairline borders (`1px`) and generous padding (`>= 16px`, outer padding `>=` inner gap). Zero nested cards-within-cards, zero thick left accent stripes (`border-l-4`), zero decorative pulsing status dots, and zero static pill-badge clutter (metadata rendered as quiet inline text separated by `·`).
  - **Complete Data States**: Every module includes populated realistic legal states, guided empty states with a single clear CTA, skeleton loading states matching row geometry, and inline error recovery banners.

### Interactive Feedback & Motion

- Fast `150ms–200ms` transitions (`cubic-bezier(0.16, 1, 0.3, 1)`) using compositor-only `opacity` and `transform`.
- Streaming/progressive feedback for long AI operations (research grounding, drafting, redline generation, audio transcription) with explicit stage indicators (e.g., *Searching authorities → Verifying citations → Formatting memo*).
- Non-blocking toast confirmations for saves, redline acceptances, WhatsApp command executions, and exports (never `window.alert`).

---

## 3. Key Product Decisions & Trade-Offs

1. **Deterministic Engines Paired with Generative AI for High-Stakes Legal Math**
   - *Chosen Approach*: Build pure, unit-tested TypeScript logic engines for (a) the **IPC/CrPC/IEA ↔ BNS/BNSS/BSA Statute Crosswalk & Draft Citation Scanner** (comprehensive curated mapping table + regex parser, augmented by AI for nuanced textual/punishment comparisons) and (b) the **Indian Limitation Act & Filing Deadline Calculator** (exact statutory day/month/year rules + condonation windows).
   - *Why*: Courts sanction lawyers for hallucinated section numbers or missed limitation dates. Making statutory mapping and limitation math deterministic guarantees 100% reproducible accuracy while letting Gemini handle complex reasoning and drafting.
   - *Alternatives Considered*: Pure LLM prompting for section numbers and date math (rejected due to subtle off-by-one and outdated-section hallucinations).

2. **Server-Side Gemini Pipeline with Live Google Search Grounding (`gemini-4-hydrogen` + `gemini-3.5-transcribe`)**
   - *Chosen Approach*: Route every AI workflow through Express backend endpoints using `gemini-4-hydrogen` (with `googleSearch` tool enabled for Legal Research and Citation Verification, structured JSON schemas for Redlining/Chronology/Risk Extraction, and multimodal inline parts for PDF/image OCR) plus `gemini-3.5-transcribe` for Meeting Assistant audio transcription.
   - *Why*: Delivers real web-grounded case URLs, structured parseable UI outputs (risk matrices, redline diffs, chronologies), and fast response latency without requiring paid-tier-only models or exposing keys to the client.
   - *Alternatives Considered*: Unstructured plain-text chat responses (rejected because lawyers need structured tables, clickable diffs, and exportable artifacts).

3. **PostgreSQL + Drizzle ORM Persistence with Portable Deployment Structure**
   - *Chosen Approach*: Persist all user accounts, matters, research memos, drafts, document OCR/chronologies, contract redlines, tracked cases, calendar deadlines, WhatsApp logs, and meeting briefs in hosted PostgreSQL via Drizzle ORM, authenticated by verified user ID tokens. Include portable `vercel.json` and Cloudflare security/cache header templates for downstream deployment.
   - *Why*: Satisfies full relational persistence (foreign keys tying every artifact to a Matter and User) right now in the live app while remaining natively compatible with Supabase PostgreSQL, Vercel, and Cloudflare.
   - *Alternatives Considered*: Browser `localStorage` only (rejected because the user explicitly requested full multi-session accounts and PostgreSQL persistence).

4. **Workspace-Synced WhatsApp Command Center Simulator**
   - *Chosen Approach*: Build an interactive, realistic WhatsApp-style command interface inside the workspace that executes real database queries and mutations (checking upcoming hearings, running `/bns` lookups, logging client reminders, fetching matter briefs, and drafting quick replies) rather than a static mockup.
   - *Why*: External WhatsApp Business Cloud API webhooks require live Meta Business verification and a dedicated phone number, whereas a live workspace-backed Command Center delivers the full on-the-go advocate workflow immediately and exposes clean webhook-ready service handlers for future Meta API connection.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### System Architecture & Component Hierarchy

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                     BROWSER CLIENT (React 19 + Tailwind v4)                  │
│  ┌──────────────────────┐  ┌──────────────────────────────────────────────┐  │
│  │  Auth & Matter Shell │  │        8 Integrated Legal Modules            │  │
│  │  • Google Sign-In    │  │  1. Command Dashboard & Matter Switcher      │  │
│  │  • Sidebar (256px)   │  │  2. Grounded Legal Research & Citations      │  │
│  │  • Breadcrumb Header │  │  3. AI Drafting Studio + BNS Validator       │  │
│  │  • Jurisdiction Mode │  │  4. Courtroom Simulator (Bench / Opposing)   │  │
│  │  • Light/Dark Theme  │  │  5. Contract Redline & Due Diligence Matrix  │  │
│  └──────────┬───────────┘  │  6. Document Vault (OCR/Chronology/Translate)│  │
│             │              │  7. Case Tracker, Cause Lists & Limitation   │  │
│             │              │  8. WhatsApp Command Center & Meeting AI     │  │
│             └──────────────┴──────────────────────┬───────────────────────┘  │
└───────────────────────────────────────────────────┼──────────────────────────┘
                                                    │ HTTPS + Bearer ID Token
┌───────────────────────────────────────────────────▼──────────────────────────┐
│                     EXPRESS API SERVER (Node + TypeScript)                   │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌────────────────────┐  │
│  │  Auth Middleware     │  │ Deterministic Engines│  │  Gemini AI Router  │  │
│  │  • Verify ID Token   │  │ • IPC↔BNS Crosswalk  │  │ • Research (Search)│  │
│  │  • Upsert User Row   │  │ • Draft Repeal Scan  │  │ • Drafting & Edit  │  │
│  │  • Owner Scoping     │  │ • Limitation Math    │  │ • Redline / DD JSON│  │
│  └──────────┬───────────┘  │ • Conflict & Export  │  │ • Courtroom Sim    │  │
│             │              └──────────────────────┘  │ • Multimodal OCR   │  │
│             │                                        │ • Audio Transcribe │  │
│             │                                        └─────────┬──────────┘  │
└─────────────┼──────────────────────────────────────────────────┼─────────────┘
              │ Parameterized Drizzle ORM Queries                │ Server-Side SDK
┌─────────────▼────────────────────────┐   ┌─────────────────────▼─────────────┐
│   HOSTED POSTGRESQL (Cloud SQL)      │   │   GOOGLE GEMINI API               │
│   • users, matters, documents        │   │   • gemini-4-hydrogen (+ Search)  │
│   • drafts, research_memos           │   │   • gemini-3.5-transcribe         │
│   • contract_reviews, tracked_cases  │   └───────────────────────────────────┘
│   • deadlines, whatsapp_logs         │
│   • meeting_transcripts              │   [Portable Vercel + Cloudflare Config]
└──────────────────────────────────────┘
```

### Data Model & State

- **Users**: Authenticated account profile keyed by unique auth UID, email, display name, default jurisdiction, and role.
- **Matters**: Core organizational anchor (`id`, `userId`, `title`, `clientName`, `jurisdiction` [`india_litigation` | `corporate_ma` | `global_multi`], `forum`, `status`, `summaryFacts`, `updatedAt`).
- **Research Memos**: Linked to `matterId`; stores query, jurisdiction filter, synthesized legal memo, verified web grounding URLs, and citation audit flags.
- **Drafts**: Linked to `matterId`; stores document type (Petition, Plaint, Bail Application, Legal Notice, MSA, SHA, Arbitration Brief), rich editable text content, version number, and saved statutory validation findings.
- **Vault Documents**: Linked to `matterId`; stores file metadata, extracted OCR text, translated bilingual text, extracted **Chronology of Dates** JSON array, and **Cross-Document Contradiction** flags.
- **Contract Reviews**: Linked to `matterId`; stores contract title, playbook profile, original text, structured clause-level risk items (severity, issue, original clause, proposed redline, rationale, accept/reject state), and overall DD requisition checklist.
- **Courtroom Sessions**: Linked to `matterId`; stores simulation mode (`bench` | `opposing_counsel`), source brief/draft excerpt, turn-by-turn transcript, vulnerability notes, and suggested rebuttals.
- **Tracked Cases & Deadlines**: Linked to `matterId`; stores case/CNR/docket number, court/tribunal, bench, next hearing date, cause list item number, stage, Limitation Act calculations, and reminder tasks.
- **Meeting Briefs & WhatsApp Command Logs**: Linked to `matterId`; stores audio transcription text, structured meeting summaries/action items, and synced WhatsApp command history.

### Interactive Component & State Mapping

- **Matter Switcher & Jurisdiction Toggle**: Selecting a matter hydrates all active module views via authenticated `GET /api/matters/:id/bundle` requests with optimistic UI transitions and inline loading skeletons.
- **Drafting Studio + Statute Validator**: Editing text updates local editor state with debounced autosave (`PATCH /api/drafts/:id`). Selecting a text range opens an inline AI Rewrite popover (`POST /api/ai/draft-edit`). Clicking **"Scan BNS/BNSS/BSA"** runs the deterministic scanner immediately (zero network latency), highlights every legacy IPC/CrPC/IEA citation with its mapped replacement, and lets the user apply individual or bulk replacements in one click.
- **Contract Redline Matrix**: Submitting contract text or an uploaded PDF calls `POST /api/ai/contract-redline` → persists the structured review in PostgreSQL → renders filterable clauses (`All / High / Medium / Low / Pending / Accepted`). Clicking **Accept** or **Reject** on a clause persists state (`PATCH /api/contract-reviews/:id/clauses/:clauseId`) and dynamically regenerates the clean exportable contract preview.
- **Document Vault (OCR / Chronology / Translation)**: Uploading a PDF/image converts to base64 with client/server MIME and size checks → `POST /api/ai/document-process` runs multimodal OCR, extracts sorted List-of-Dates rows, detects contradictions against other documents in the same matter, or translates into the chosen Indian/global language → saves directly to the Vault table.
- **Case Tracker & Limitation Engine**: Adding/editing tracked cases writes to PostgreSQL (`POST /api/cases`, `PATCH /api/cases/:id`). Selecting an Act/Article and trigger date in the Limitation Calculator immediately computes exact statutory deadlines, grace/condonation windows, and remaining days via the pure TypeScript engine, with a one-click **"Pin Deadline to Matter"** button.
- **WhatsApp Command Center & Meeting Assistant**: Submitting a command parses slash intents (`/hearings`, `/bns <sec>`, `/remind <text>`, `/brief`) or natural-language queries against live Matter data in PostgreSQL and appends formatted command responses. Recording or uploading audio posts to `POST /api/ai/meeting-transcribe`, transcribes via `gemini-3.5-transcribe`, extracts structured legal facts & action items via `gemini-4-hydrogen`, and allows one-click attachment to the active Matter.

### Security & Privacy Safeguards

- **Server-Only Secrets**: All Gemini API keys and PostgreSQL credentials reside exclusively in server-side environment variables and are never exposed to the browser bundle.
- **Authenticated, Owner-Scoped Data Access**: Every API endpoint validates the caller's Firebase ID token via server-side verification and scopes every parameterized Drizzle SQL query strictly to the authenticated user's records.
- **Input Validation & Safe Rendering**: File/audio uploads enforce strict MIME type and payload size caps on the server, dynamic citation URLs are restricted to safe `http:`/`https:` schemes, and all legal drafts, transcripts, and AI outputs render through safe React text bindings without raw HTML injection.
