# VidhiOS — Deployment Guide (`DEPLOYMENT.md`)

## Supported Targets
1. **Vercel (Recommended Serverless + Static SPA):**
   - `vercel.json` builds `dist/` (`vite build`), `server.js`, and `api/index.js` (`src/server/apiHandler.ts`).
   - Rewrites `/api/:path*` -> `/api` and SPA routes -> `/index.html`.
   - Security headers configured at both Express and `vercel.json`.
2. **Standalone Node.js Server / Docker:**
   - Run `npm run build` then `NODE_ENV=production node server.js`.
   - Default port: `process.env.PORT || 3000`.

## Pre-Deployment Checklist
1. Set `DATABASE_URL` (or `NEON_DATABASE_URL`) to your Neon PostgreSQL connection string (`?sslmode=require`).
2. Set `SESSION_SECRET` to a random 32+ character string (`openssl rand -hex 32`).
3. Set `ADMIN_BOOTSTRAP_PASSWORD` for initial `vidhios@admin.com` provisioning (optional after first boot).
4. Set `NVIDIA_API_KEY` and/or `GEMINI_API_KEY` for live AI inference.
5. Run `npm run lint && npm test && npm run test:integration && npm run build` prior to deploying.

## Backup & Recovery
- Enable Neon Point-in-Time Recovery (PITR) branches for instant rollback.
- Original uploaded files and extracted metadata are tracked separately in `vault_documents`.
