# Contributing to Hogyoku

Thanks for your interest in improving Hogyoku. This guide covers how to set up a
dev environment, the checks we run, and how to propose changes.

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## Ways to contribute

- Report bugs and request features via GitHub Issues (templates provided).
- Improve docs — clarity fixes are genuinely valuable.
- Fix bugs or implement features. For anything non-trivial, open an issue first
  so we can agree on the approach.
- Improve retrieval quality, add evaluation datasets, or strengthen guardrails.

## Project principles

Keep changes aligned with the project's spirit (see [OVERVIEW.md](OVERVIEW.md)):

- **Evidence first, verify then trust.** Answers must stay grounded in retrieved
  evidence and pass the verification gate.
- **Works without a model key.** Don't make a Gemini key a hard dependency for
  core flows; preserve the deterministic/offline paths.
- **No vendor lock-in.** Depend only on PostgreSQL + `pgvector`, a
  Redis-compatible queue, and S3-compatible storage.
- **Private by default.** Preserve per-user data isolation and the existing
  security controls.

## Development setup

Prerequisites: Node 22+, Docker, and (optional) Python 3.12 for the guardrails.

```bash
# 1. Install dependencies
npm install

# 2. Configure environment (free/local tier)
cp .env.free.example .env
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"  # paste into SESSION_SECRET

# 3. Start infrastructure (Postgres + pgvector, Redis, MinIO)
docker compose up postgres redis minio minio-init

# 4. Migrate and run (separate terminals)
npm run db:migrate
npm run dev
npm run dev:worker
```

Open `http://localhost:4173`. A Nix dev shell is also available: `nix develop`.

## Checks to run before a PR

These mirror CI. Please make sure they pass locally.

```bash
npm run typecheck      # TypeScript, strict mode
npm test               # Node test runner
npm run build          # Compile to dist/
npm run evaluate       # Retrieval recall@k + MRR
npm run guardrails     # Offline RAG + security linters (no model calls)
```

If you touched infra, the relevant CI jobs also run `terraform fmt/validate`,
`ansible --syntax-check`, `cargo fmt --check && cargo test`, `docker compose
config`, and `nix flake show`.

### Integration tests (optional locally)

`npm test` runs the hermetic unit suite (no services required). Integration
tests exercise the real PostgreSQL + pgvector retrieval SQL and live in
`tests/integration/`. They are skipped unless `RUN_DB_TESTS=1` and a pgvector
database is reachable. CI runs them automatically against a service container.
To run them locally:

```bash
docker compose up -d postgres
RUN_DB_TESTS=1 \
DATABASE_URL=postgres://hogyoku:hogyoku@localhost:5432/hogyoku \
REDIS_URL=redis://localhost:6379 S3_ENDPOINT=http://localhost:9000 \
S3_BUCKET=hogyoku S3_ACCESS_KEY=minio S3_SECRET_KEY=miniosecret \
SESSION_SECRET=test-session-secret-at-least-32-characters \
npm run test:integration
```

## Coding style

- **TypeScript**, ESM, strict mode. Match the existing style (no semicolon
  surprises, small focused functions, explicit types at boundaries).
- **No new runtime dependencies** without discussion — the front end is
  intentionally dependency-free and the backend stays lean.
- Validate all external input with **Zod**.
- Keep secrets out of code and logs. Never commit `.env` or real credentials.
- Add or update **tests** for behavior changes. Pure logic (e.g. chunking,
  query rewriting) should be unit-tested without requiring a database.

## Commit and PR guidelines

- Use clear, present-tense commit messages (e.g. "add thread rename route").
- Keep PRs focused; smaller is easier to review.
- Fill out the PR template: what changed, why, how you tested, and any
  follow-ups or risks.
- Update docs (`README.md`, `OVERVIEW.md`, `CHANGELOG.md`, `docs/`) when behavior
  or setup changes.
- Reference the issue your PR addresses.

## Reporting security issues

Please do not open public issues for vulnerabilities. See the
[Security Policy](.github/SECURITY.md) for private reporting.

## License

By contributing, you agree that your contributions are licensed under the
project's [MIT License](LICENSE).
