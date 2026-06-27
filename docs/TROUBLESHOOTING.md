# Troubleshooting & FAQ

Common setup and runtime questions, with fixes grounded in how Hogyoku actually
behaves. If your issue isn't here, see [SUPPORT.md](../.github/SUPPORT.md).

## Setup

### "Invalid environment configuration" on startup

A required variable is missing or malformed. The message lists each offending
variable. Copy a preset and fill it in:

```bash
cp .env.free.example .env
```

`SESSION_SECRET` must be at least 32 characters. Generate one with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### `docker compose up` fails to connect / "daemon is not running"

Start Docker (Docker Desktop or the Docker daemon) and retry. Verify with
`docker info`.

### Port already in use

The stack uses `4173` (web), `5432` (Postgres), `6379` (Redis), and `9000`/`9001`
(MinIO). Stop whatever is bound to those ports, or change the host-side port
mappings in `docker-compose.yml` (and `PORT` / `APP_ORIGIN` for the web port).

### `type "vector" does not exist` during migration

PostgreSQL is missing the `pgvector` extension. Use a Postgres image/instance
that ships it (the bundled Compose uses `pgvector/pgvector:pg16`), or enable the
extension on your managed database. The migration runs
`CREATE EXTENSION IF NOT EXISTS vector;`, which requires sufficient privileges.

## Running

### A document is stuck on "queued" or "processing"

Ingestion runs in a separate worker process. Make sure it's running:

```bash
npm run dev:worker      # local dev
# or, in Compose, the `worker` service must be up
```

The worker needs Redis and the same database and storage configuration as the
web service. Check the worker logs for extraction or embedding errors.

### Answers say a provider is not configured / look "extractive"

This is expected with no `GEMINI_API_KEY`. Hogyoku runs fully offline using
deterministic local embeddings and extractive, still-cited answers. Add a key
(see [TIERS.md](TIERS.md)) for generated and independently verified answers.

### "Evidence too weak" / the answer was withheld

This is by design. When the verification pass can't confirm every claim against
the cited evidence, Hogyoku withholds the draft and shows the evidence instead.
Try broadening the selected sources or rephrasing the question.

### `403 Invalid request origin`

State-changing requests must send an `Origin` header matching `APP_ORIGIN`. Set
`APP_ORIGIN` to the exact URL you load in the browser (scheme, host, and port).

### I changed `EMBEDDING_DIMENSIONS` and retrieval broke

The database column is `vector(1536)`. If you choose an embedding model with a
different dimension, update the dimension in
`src/db/migrations/001_initial.sql` to match **before the first migration**.
Keep both values in sync.

## FAQ

- **Do I need an API key?** No. Hogyoku works offline; a key only upgrades
  answer quality. See [WHY_HOGYOKU.md](WHY_HOGYOKU.md).
- **Is my data sent anywhere?** Only to your configured model provider, and only
  if you set a key. Storage, database, and queue are yours.
- **Can I use a non-Gemini model?** Yes — implement the adapter in
  `src/services/ai.ts`. See the extension table in [WHY_HOGYOKU.md](WHY_HOGYOKU.md).
- **How do I check health?** `GET /api/health` returns status and a database
  check.
- **Where do I report a vulnerability?** Privately — see
  [.github/SECURITY.md](../.github/SECURITY.md), not a public issue.
