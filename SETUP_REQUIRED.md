# Values You Need To Provide

Copy `.env.example` to `.env` and fill the values there. Do not send secrets in
chat and do not commit `.env`.

A local `.env` has already been created with Docker development defaults. Add
your Gemini key there. Replace the cloud database, Redis, and storage values only
after rotating the credentials that were exposed in review comments.

## Pick a Tier First

Hogyoku ships three ready-to-use presets so you only fill in what your budget
needs. Full guide: [docs/TIERS.md](docs/TIERS.md).

| Tier | Cost | Copy this preset |
| --- | --- | --- |
| Free (local Docker) | $0 | `cp .env.free.example .env` |
| Standard (managed free/cheap) | ~$0–15/mo | `cp .env.standard.example .env` |
| Pro (managed production) | usage-based | `cp .env.pro.example .env` |

Then fill the remaining placeholders for your chosen tier. The tables below
describe each variable.

## Required For Local Docker

Nothing is required for infrastructure. `docker compose up --build` starts local
PostgreSQL, Redis, MinIO, the API, and the ingestion worker with development
credentials.

For real generated answers, add:

```env
GEMINI_API_KEY=your-google-ai-studio-key
```

Create the key in [Google AI Studio](https://aistudio.google.com/app/apikey).

Without this key, uploads, OCR, indexing, retrieval, citations, authentication,
and persistence still work. Answers use an extractive fallback instead of a
generative model.

## Required For Production

| Variable | What to provide |
| --- | --- |
| `APP_ORIGIN` | Public HTTPS URL, such as `https://app.example.com` |
| `DATABASE_URL` | PostgreSQL connection URL with the `vector` extension |
| `REDIS_URL` | TLS Redis URL used by BullMQ |
| `S3_ENDPOINT` | S3 or S3-compatible HTTPS endpoint |
| `S3_REGION` | Storage region |
| `S3_BUCKET` | Private document bucket |
| `S3_ACCESS_KEY` | Storage access key with access to that bucket only |
| `S3_SECRET_KEY` | Matching storage secret |
| `S3_FORCE_PATH_STYLE` | `false` for AWS S3; often `true` for MinIO/R2 |
| `SESSION_SECRET` | At least 32 random characters; use 64+ |
| `GEMINI_API_KEY` | Google AI Studio Gemini API key |

Generate a session secret locally with:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

## Optional Model Overrides

- `CHAT_MODEL`: grounded answer and verification model
- `VISION_MODEL`: figure, screenshot, and scanned-page understanding model
- `EMBEDDING_MODEL`: retrieval embedding model

The database migration currently creates `vector(1536)`. If you choose an
embedding model with another dimension, update both `EMBEDDING_DIMENSIONS` and
the vector dimension in `src/db/migrations/001_initial.sql` before the first
migration.

## Recommended Hosted Services

These are interchangeable; Hogyoku is not tied to one vendor:

- PostgreSQL/pgvector: Neon, Supabase, RDS, Crunchy Bridge
- Redis: Upstash, Redis Cloud, ElastiCache
- Object storage: AWS S3, Cloudflare R2, Backblaze B2
- Web and worker containers: Render, Railway, Fly.io, AWS ECS, Google Cloud Run

Create separate deployments from the same image:

- Web command: `node dist/src/db/migrate.js && node dist/src/server.js`
- Worker command: `node dist/src/worker.js`

For infrastructure paths, read:

- `docs/DEVOPS.md`
- `docs/SECURITY.md`
- `infra/terraform/terraform.tfvars.example`
- `ansible/inventory.example.ini`
