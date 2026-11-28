# VidhiOS — Environment Variables (`ENVIRONMENT_VARIABLES.md`)

Never commit real secrets into git or documentation. Configure these in `.env` locally or Vercel/Host Secret Manager in production.

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes (prod) | Neon Serverless PostgreSQL connection string (`postgresql://...?sslmode=require`) |
| `NEON_DATABASE_URL` | Optional alias | Alternative variable name for Neon PostgreSQL connection string |
| `SESSION_SECRET` | Yes (prod) | 32+ character random HMAC-SHA256 signing secret for sessions |
| `ADMIN_BOOTSTRAP_PASSWORD` | Recommended | Initial password when provisioning `vidhios@admin.com` (never overwrites existing password) |
| `NVIDIA_API_KEY` | Recommended | NVIDIA NIM API key for primary research, drafting, analysis & agents |
| `NVIDIA_MODEL` | Optional | Primary model override (default: `mistralai/mistral-large-4-1t-a52b`) |
| `NVIDIA_FAST_MODEL` | Optional | Low-latency model override (default: `nvidia/nemotron-3.5-lightning-30b-a3b`) |
| `GEMINI_API_KEY` | Recommended | Google Gemini API key for multimodal OCR, audio transcription & search fallback |
| `MCA_API_URL` | Optional | Licensed corporate/MCAv3 data endpoint URL |
| `MCA_API_KEY` | Optional | Licensed corporate API credential (`SUREPASS_API_KEY` / `KARZA_API_KEY` also checked) |
| `PG_ALLOW_SELF_SIGNED` | Optional | Set `true` only if local proxy requires relaxing TLS CA verification |
| `DISABLE_RATE_LIMIT` | Test only | Set `true` in automated test suites to bypass sliding-window rate limits |
| `PORT` | Optional | Server listen port (default `3000`) |
| `NODE_ENV` | Prod | Set `production` in deployed environments |
