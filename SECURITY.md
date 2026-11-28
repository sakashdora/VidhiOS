# VidhiOS — Security & Privacy Architecture (`SECURITY.md`)

## Implemented Security Controls
1. **Password Security (`src/server/auth.ts`):**
   - Passwords hashed with `crypto.scryptSync` + per-user 16-byte random salt and verified with `crypto.timingSafeEqual`.
2. **Session Management & Secret Hygiene:**
   - Removed predictable fallback `SESSION_SECRET` derived from `DATABASE_URL` or hardcoded production secrets. Uses `process.env.SESSION_SECRET` (>= 16 chars) or an ephemeral CSPRNG secret (`crypto.randomBytes(32)`) with a production warning.
   - Supports HTTP-only `SameSite=Lax` cookie (`vidhios_session`) with double-submit CSRF protection (`vidhios_csrf` + `x-csrf-token`) alongside in-memory `Authorization: Bearer` tokens.
   - Active token revocation via `POST /api/auth/logout` backed by `revoked_tokens` table in Neon.
3. **Privilege Separation & Demo Isolation:**
   - The public 1-click demo account (`chambers@vidhios.in`) is strictly non-admin (`isAdmin: false`) and explicitly denied access to all `/api/admin/*` endpoints.
   - `ensureDefaultAdminAccount()` no longer resets an existing admin's password on server boot.
4. **Multi-Tenant & Matter-Level Isolation:**
   - `repository.canUserAccessMatter()` enforces organization isolation (`organizationId`) and role checks (`client` role is read-only on assigned matters).
   - Cross-user and cross-organization access attempts are verified via automated integration tests (`src/server/integration.test.ts`).
5. **Transport, Headers, Rate Limiting & Uploads:**
   - Security headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, and `Strict-Transport-Security` in production.
   - Sliding-window rate limiters on `/api/auth` (30 req/min) and `/api/ai` (60 req/min).
   - Strict MIME allowlists and payload caps (12 MB documents, 14–15 MB audio).
   - PostgreSQL SSL certificate verification enabled by default (`PG_ALLOW_SELF_SIGNED=true` only for explicit local override).

## Operational Recommendations & Pending Hardening
- Configure a strong random `SESSION_SECRET` (32+ chars) and `ADMIN_BOOTSTRAP_PASSWORD` in Vercel/production secrets before launch.
- Integrate external antivirus/malware scanning (e.g., ClamAV / cloud object scanner) and encrypted object storage (S3/R2/GCS) for high-volume binary exhibit archiving beyond PostgreSQL text/metadata storage.
- Rotate API keys (`NVIDIA_API_KEY`, `GEMINI_API_KEY`, `DATABASE_URL`) periodically and enable Neon point-in-time recovery (PITR) backups.
