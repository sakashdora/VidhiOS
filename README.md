# VidhiOS — Indian Legal Intelligence & Operations Platform

VidhiOS is a full-stack, multi-tenant legal technology platform built for Indian advocates, law firms, judicial researchers, and law students. It combines **deterministic Indian legal engines** (BNS/BNSS/BSA 2023 statutory crosswalks, Limitation Act Sec. 4 & Arbitration Sec. 34 math, 13 judiciary forms, OOXML `.docx` generation, and citation parsing) with **grounded multi-agent AI workflows** and **Neon Serverless PostgreSQL**.

## Key Capabilities
- **18 Enterprise Modules:** Overview, AI Assistant (EN/HI/Hinglish), Legal Research (6-tier source hierarchy & Precedent Conflict Detector), Matters & Cases, Case Intelligence (7-agent orchestrator, Knowledge Graph, Litigation Strategy, Evidence Intelligence), Legal Drafting (version history, PDF/DOCX export), 13 Judiciary Forms, Document Vault (OCR, unified timeline, entity extraction), Contract Intelligence, Courtroom Simulator, Court Calendar, Legal Library, Corporate Intelligence (MCA provider abstraction), Translation Studio (10 Indian languages), Meeting Assistant, Analytics, Team & Clients, Settings, plus Admin Console.
- **Deterministic Grounding:** 36 unit tests verify statutory crosswalks, limitation dates, citation spans, `.docx` export, security isolation, and zero-hallucination refusals.
- **Security & Multi-Tenancy:** `scrypt` password hashing, HTTP-only cookies + CSRF protection, token revocation, organization & matter isolation, rate limiting, and audit logging.

## Quick Start
```bash
npm install
cp .env.example .env   # Configure DATABASE_URL, SESSION_SECRET, NVIDIA_API_KEY / GEMINI_API_KEY
npm run dev            # Starts local Express + Vite workspace on http://localhost:3000
```

## Documentation
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)
- [API_DOCUMENTATION.md](API_DOCUMENTATION.md)
- [SECURITY.md](SECURITY.md)
- [TESTING.md](TESTING.md)
- [DEPLOYMENT.md](DEPLOYMENT.md)
- [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md)
- [CHANGELOG.md](CHANGELOG.md)
