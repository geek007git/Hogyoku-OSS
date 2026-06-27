# Deployment Tiers

Hogyoku is built to run the same code from a $0 laptop setup all the way to
managed, autoscaling production. Pick the tier that matches your budget and
quality needs. You can move up a tier later without code changes — only
environment variables and infrastructure change.

Every tier produces cited, claim-verified answers. The difference is where the
services run, how much they cost, and how strong the language model is.

## At a glance

| | **Tier 1 — Free** | **Tier 2 — Standard** | **Tier 3 — Pro** |
| --- | --- | --- | --- |
| **Cost** | $0 | ~$0–15/mo | usage-based |
| **Runs on** | Your machine (Docker) | Managed free/hobby tiers | Managed cloud (AWS/GCP) |
| **Postgres** | Local `pgvector` | Neon / Supabase (free) | RDS / Crunchy / Aurora |
| **Redis** | Local | Upstash / Redis Cloud (free) | ElastiCache / Redis Cloud |
| **Storage** | Local MinIO | Cloudflare R2 / B2 | AWS S3 (encrypted) |
| **Hosting** | Localhost | Render / Railway / Fly.io | ECS / Cloud Run |
| **Model** | Gemini free tier *or* offline | Gemini flash-lite (cheap) | Gemini flash / pro |
| **Answers** | Generated or extractive | Generated + verified | Generated + verified |
| **Scaling** | One machine | One small instance | Autoscaling + workers |
| **Best for** | Trying it, hobby, private use | Small teams, low traffic | Real production, scale |
| **Preset** | `.env.free.example` | `.env.standard.example` | `.env.pro.example` |

> All providers are interchangeable. Hogyoku is not tied to any single vendor —
> it only needs PostgreSQL with `pgvector`, a Redis-compatible queue, and an
> S3-compatible bucket.

---

## Tier 1 — Free ($0)

Everything runs locally in Docker. No cloud account and no credit card. This is
the fastest way to evaluate Hogyoku and a genuinely capable private setup for a
single researcher.

### Cost

| Service | Cost |
| --- | --- |
| PostgreSQL + pgvector (container) | $0 |
| Redis (container) | $0 |
| MinIO object storage (container) | $0 |
| Web + worker (containers) | $0 |
| Gemini (optional free-tier key) | $0 |
| **Total** | **$0** |

### Setup

```bash
cp .env.free.example .env
# Generate a session secret and paste it into .env:
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
docker compose up --build
```

Open `http://localhost:4173` and create an account.

### Models

- Add a free key from [Google AI Studio](https://aistudio.google.com/app/apikey)
  to `GEMINI_API_KEY` for generated, claim-verified answers. The free tier is
  rate-limited but costs nothing.
- Leave the key blank to run fully offline: deterministic local embeddings,
  extractive answers, and the offline follow-up query rewriter.

### Trade-offs

- The free model tier has request/minute and request/day limits.
- Offline mode returns the strongest retrieved passages rather than generated
  prose, and uses lower-quality local embeddings.
- A laptop is not highly available — fine for personal use, not for a team.

---

## Tier 2 — Standard (~$0–15/month)

Move the data off your laptop onto managed free and hobby tiers so the app stays
up and is reachable on the internet, while keeping spend near zero.

### Cost

| Service | Typical cost |
| --- | --- |
| Neon / Supabase Postgres | Free tier |
| Upstash / Redis Cloud | Free tier |
| Cloudflare R2 / Backblaze B2 | Free egress / pennies |
| Render / Railway / Fly.io | Free–hobby (~$0–10) |
| Gemini flash-lite (pay-as-you-go) | Cents per thousand calls |
| **Total** | **~$0–15/mo** |

### Setup

1. Create a Postgres database (Neon/Supabase) and enable the `vector`
   extension. Copy the connection string.
2. Create a Redis instance (Upstash/Redis Cloud) and copy the TLS URL.
3. Create a private bucket (R2/B2) and an access key scoped to it.
4. `cp .env.standard.example .env` and fill in the values, or paste them into
   your hosting platform's secret manager.
5. Deploy two services from the one container image:
   - **Web:** `node dist/src/db/migrate.js && node dist/src/server.js`
   - **Worker:** `node dist/src/worker.js`

### Models

- `gemini-2.5-flash-lite` for chat, vision, and verification keeps cost minimal.
- Embeddings use `gemini-embedding-001` at 1536 dimensions.

### Trade-offs

- Free database/Redis tiers have storage and connection caps; watch usage.
- A single small web instance handles modest traffic; bursts may queue.
- Cold starts are possible on free hosting tiers.

---

## Tier 3 — Pro (usage-based)

Full managed production: autoscaling web service, one or more dedicated
ingestion workers, encrypted storage, and the strongest models. Provision with
the Terraform in `infra/terraform` (see [DEVOPS.md](DEVOPS.md)).

### Cost

Usage-based and dependent on traffic, document volume, and model choice. Driven
by managed Postgres/Redis instance sizes, S3 storage, container compute, and
Gemini calls (`flash`/`pro` cost more than `flash-lite`).

### Setup

1. Provision infrastructure:
   ```bash
   cd infra/terraform
   cp terraform.tfvars.example terraform.tfvars
   terraform init
   terraform plan
   terraform apply
   ```
2. Store secrets in AWS Secrets Manager (Terraform creates the entries).
3. Use `.env.pro.example` as the reference for required values.
4. Run the web and worker as separate services from the same image, with at
   least one worker independent of the web service so OCR never blocks HTTP.

### Models

- `gemini-2.5-flash` for vision and chat gives stronger grounded answers and
  verification.
- Optionally use a larger chat model for the verification pass.
- Advanced: a higher-dimension embedding model improves recall. If you change
  `EMBEDDING_DIMENSIONS`, you **must** update the `vector(1536)` column in
  `src/db/migrations/001_initial.sql` to match before the first migration.

### Trade-offs

- Highest quality and availability, but you pay for managed services and model
  usage.
- Requires cloud operations knowledge (IAM, networking, secrets, scaling).

---

## Choosing and upgrading

- Start on **Free** to evaluate and for private single-user use.
- Move to **Standard** when you need an always-on, internet-reachable instance
  for a small team without meaningful spend.
- Move to **Pro** when answer quality, throughput, and availability justify
  managed infrastructure.

Upgrading is a configuration change, not a rewrite: point the same image at
managed `DATABASE_URL`, `REDIS_URL`, and S3 values, run the migration, and
deploy. Your schema and data model are identical across all three tiers.
