# VidhiOS — Testing & QA Verification Guide (`TESTING.md`)

## Test Commands
```bash
npm run lint               # TypeScript strict check (tsc --noEmit)
npm test                   # Deterministic legal engine, auth, security & AI benchmark unit tests
npm run test:integration   # End-to-end HTTP API, multi-tenant isolation & failure tests
npm run build              # Production Vite client + esbuild Node & Vercel API bundles
npm run test:e2e           # Playwright Chromium UI journey (requires built dist/)
```

## Coverage Scope
1. **Deterministic Legal Engines (`src/lib/legal/*.test.ts` — 36 tests):**
   - Statute crosswalk (`IPC`/`CrPC`/`IEA` <-> `BNS`/`BNSS`/`BSA`)
   - Limitation Act Sec. 4 Sunday roll-forward & Arbitration Act Sec. 34(3)
   - Citation parser (lossless spans, Indian & international citations)
   - 13 Judiciary templates + jurisdiction validation rules
   - OOXML `.docx` generation & filename sanitization
   - Bilingual assistant intent routing & zero-hallucination refusal on unknown sections
   - Password hashing, session token signing/revocation, demo admin isolation
2. **HTTP Integration & Multi-Tenant Security (`src/server/integration.test.ts`):**
   - Registration, login, demo non-admin enforcement, logout & token revocation
   - Cross-organization isolation (User B denied access to User A's matters, drafts, deletes)
   - Workflows + human approval, corporate mock provider labeling, knowledge graph, `.docx` export, invalid MIME rejection
3. **Browser E2E (`scripts/e2e-playwright.mjs`):**
   - Full user journey in headless Chromium from registration through matter creation, Vault indexing, Legal Research, Judiciary Forms, Drafting save, Case Tracker deadline pinning, Case Intelligence, Corporate Intelligence, Analytics, and Sign Out.
