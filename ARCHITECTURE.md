# VidhiOS — System Architecture (`ARCHITECTURE.md`)

## 1. Overview
**VidhiOS** is a multi-tenant Indian Legal Intelligence & Operations Platform built for advocates, law firms, judicial researchers, and law students. It pairs **deterministic-first legal engines** (zero-LLM statutory crosswalks, Limitation Act math, OOXML `.docx` generation, citation parsing, and 13 judiciary templates) with **grounded AI workflows** (NVIDIA NIM and Google Gemini) and **Neon Serverless PostgreSQL** persistence.

## 2. Technology Stack
- **Frontend:** React 19, TypeScript, Vite 8, Tailwind CSS 4, Lucide Icons, route-level `React.lazy` code splitting.
- **Backend:** Node.js (ESM), Express 4, Zod validation, `tsx` dev runtime, `esbuild` production/serverless bundles.
- **Database:** Neon Serverless PostgreSQL (`pg`) with automatic schema migrations, transactional snapshots, and local JSON fallback only when `DATABASE_URL`/`NEON_DATABASE_URL` is unconfigured.
- **AI Providers:** NVIDIA NIM (`mistralai/mistral-large-4-1t-a52b`, `nvidia/nemotron-3.5-lightning-30b-a3b`) and Google Gemini (`@google/genai`).
- **Deployment:** Vercel (`vercel.json` + `api/index.js` + `dist/`) and standalone Node (`server.js`).

## 3. Core Architectural Layers
1. **Deterministic Legal Engines (`src/lib/legal/`):**
   - `statuteCrosswalk.ts`: Bidirectional IPC/CrPC/IEA <-> BNS/BNSS/BSA 2023 mappings & draft scanner.
   - `limitationCalculator.ts`: Limitation Act Sec. 4 Sunday roll-forward & Arbitration Act Sec. 34(3) 3-month + 30-day window.
   - `judiciaryTemplates.ts`: 13 court-ready templates with jurisdiction, required fields, version, and validation rules.
   - `docxExporter.ts`: OOXML `.docx` ZIP builder with court Cause Title & filename sanitization.
   - `citationParser.ts` & `supremeCourtCorpus.ts`: Lossless citation detection and curated SC/HC ratios.
   - `assistantEngine.ts`, `responseFormatter.ts`, `whatsappParser.ts`.
2. **Multi-Tenant Repository & Auth (`src/server/auth.ts`, `repository.ts`, `neonDatabase.ts`):**
   - Organization isolation (`organizations`, `organization_members`), matter-level authorization (`canUserAccessMatter`), token revocation (`revoked_tokens`), HTTP-only cookies + CSRF double-submit + Bearer tokens.
3. **AI & Legal Intelligence Services (`src/server/`):**
   - `realtimeLegalSearch.ts`: 6-tier source hierarchy & Precedent Conflict Detector.
   - `agentOrchestrator.ts`: Controlled 7-agent pipeline with max-step loop guard, token tracking, and human-in-the-loop approval.
   - `corporateService.ts`: Licensed MCA/Corporate API provider abstraction with clearly labeled sandbox mock mode.
   - `intelligenceService.ts`: Legal Knowledge Graph, Litigation Strategy Board, and 10-language Legal Translation Studio.
4. **Workspace UI (`src/App.tsx`, `src/components/`):**
   - 18 lazy-loaded enterprise modules + Admin Console built with consistent warm-alabaster & deep-teal design tokens (`src/index.css`, `src/components/ui/DesignSystem.tsx`).
