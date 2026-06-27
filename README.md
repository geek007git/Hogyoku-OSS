# Hogyoku

[![CI](https://github.com/geek007git/Hogyoku-OSS/actions/workflows/ci.yml/badge.svg)](https://github.com/geek007git/Hogyoku-OSS/actions/workflows/ci.yml)
[![CodeQL](https://github.com/geek007git/Hogyoku-OSS/actions/workflows/codeql.yml/badge.svg)](https://github.com/geek007git/Hogyoku-OSS/actions/workflows/codeql.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22-339933?logo=node.js&logoColor=white)](package.json)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg)](CODE_OF_CONDUCT.md)

> **Self-hosted RAG that verifies its answers.**

Hogyoku is a self-hostable, multimodal RAG workspace for private document
libraries. You give it your documents — PDFs, scans, images, Markdown, CSV,
JSON, plain text — and it returns cited answers, then **independently verifies
each claim against the evidence and withholds answers it can't support**. It
performs OCR and visual extraction, runs hybrid (semantic + lexical) retrieval,
keeps your data on your own infrastructure, and runs free and fully offline —
scaling to managed cloud with the same code.

New here? **[OVERVIEW.md](OVERVIEW.md)** explains the ideas, the tech, how it
works end to end, and what makes it different — in one read. Evaluating whether
to adopt it? **[docs/WHY_HOGYOKU.md](docs/WHY_HOGYOKU.md)** answers it straight.
For how we position the project, see
**[docs/POSITIONING.md](docs/POSITIONING.md)**.

## What's New in v2

Version 2 turns single-shot answers into a research conversation:

- **Conversational retrieval:** follow-up questions are rewritten into
  standalone search queries that resolve pronouns and references against the
  thread history, so "why is it effective?" still retrieves the right evidence.
  A deterministic offline rewriter keeps this working without a model key.
- **History-aware answers:** prior turns are passed to the grounded answer pass
  as interpretation context, never as a citable source.
- **Full multi-turn threads:** the workspace renders the entire conversation
  with per-turn evidence and verification, not just the latest answer.
- **Thread management:** rename and delete threads from the sidebar.
- **Markdown export:** export any thread, with citations, to a `.md` file.
- **Account controls:** sign out from the workspace profile menu.

## Architecture

- **Web/API:** Fastify and a dependency-free browser client
- **Doc processing:** Rust utility for deterministic chunk hashing
- **Database:** PostgreSQL with `pgvector`, HNSW, and full-text search
- **Jobs:** BullMQ on Redis with retry and backoff
- **Files:** Private S3-compatible object storage
- **Parsing:** PDF.js, Sharp, and Tesseract
- **Models:** Google Gemini chat, vision, and embeddings
- **Infrastructure:** Terraform, Ansible, Docker, and Nix
- **Offline guardrails:** Python RAG and security scanners with no model calls
- **Security:** Scrypt passwords, opaque hashed sessions, secure cookies,
  origin checks, rate limits, CSP, upload limits, and per-user data isolation

## Choose Your Tier

The same codebase runs from a $0 local setup to managed, autoscaling
production. Pick a tier, copy its preset to `.env`, and go. Moving up later is a
config change, not a rewrite — see [docs/TIERS.md](docs/TIERS.md) for the full
guide.

| | **Free** | **Standard** | **Pro** |
| --- | --- | --- | --- |
| Cost | $0 | ~$0–15/mo | usage-based |
| Runs on | Your machine (Docker) | Managed free/hobby tiers | Managed cloud |
| Services | Local PG / Redis / MinIO | Neon · Upstash · R2 | RDS · ElastiCache · S3 |
| Model | Gemini free tier or offline | Gemini flash-lite | Gemini flash / pro |
| Best for | Hobby, private, evaluation | Small teams, low traffic | Production at scale |
| Preset | `.env.free.example` | `.env.standard.example` | `.env.pro.example` |

```bash
# Free tier in three commands:
cp .env.free.example .env
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"  # paste into SESSION_SECRET
docker compose up --build
```

## Quick Start

1. Read [SETUP_REQUIRED.md](SETUP_REQUIRED.md).
2. Optionally create `.env` and set `GEMINI_API_KEY`.
3. Start the complete stack:

```powershell
docker compose up --build
```

4. Open `http://localhost:4173` and create an account.

The application works without a model key using deterministic local embeddings
and extractive answers. Configure a provider key for generated and independently
verified answers.

On Linux, macOS, WSL, or Git Bash, bootstrap development with:

```bash
./scripts/bootstrap.sh
```

## Local Development

Start infrastructure:

```powershell
docker compose up postgres redis minio minio-init
```

Copy `.env.example` to `.env`, changing hostnames to `localhost`, then run:

```powershell
cmd /c npm run db:migrate
cmd /c npm run dev
cmd /c npm run dev:worker
```

## Quality Checks

```bash
./scripts/verify.sh
```

CI runs TypeScript checks, Node tests, dependency auditing, Bash syntax checks,
Compose validation, Python retrieval evaluation, and offline Python guardrails on
every pull request.

## Retrieval Evaluation

The dependency-free Python evaluator reports recall at configurable cutoffs and
mean reciprocal rank from JSONL retrieval output:

```bash
python scripts/evaluate_retrieval.py evaluations/example.jsonl
python scripts/evaluate_retrieval.py results.jsonl --k 1 5 10 20
```

Each JSONL row contains `question`, `relevant_ids`, and `retrieved_ids`.

Additional Python guardrails live in `python/hogyoku_guardrails` and use no
external APIs or model credits:

```bash
PYTHONPATH=python python -m hogyoku_guardrails.security_scan --root .
PYTHONPATH=python python -m hogyoku_guardrails.citation_audit evaluations/answers.example.jsonl
PYTHONPATH=python python -m hogyoku_guardrails.chunk_audit evaluations/chunks.example.jsonl
PYTHONPATH=python python -m hogyoku_guardrails.rag_lint evaluations/rag_answers.example.jsonl
PYTHONPATH=python python -m hogyoku_guardrails.security_report --root .
```

## Request Lifecycle

1. The API validates and stores an uploaded file in a private object bucket.
2. A BullMQ job extracts PDF text or performs image OCR and visual description.
3. Page-aware overlapping chunks receive embeddings and full-text indexes.
4. Follow-up questions are rewritten into a standalone, reference-free query.
5. The query runs semantic and lexical retrieval with reciprocal-rank fusion.
6. The model produces citation-marked claims using retrieved evidence only.
7. A second pass checks each claim for entailment and citation completeness.
8. Unsupported drafts are withheld instead of being presented as reliable.

## Deployment

Pick a tier in [docs/TIERS.md](docs/TIERS.md) (Free, Standard, or Pro). See
[docs/DEVOPS.md](docs/DEVOPS.md) for Compose, Terraform, Ansible, Nix, and CI
details. See [docs/SECURITY.md](docs/SECURITY.md) for secret handling and
hardening notes.

Build one container image and deploy it twice:

- Web: `node dist/src/db/migrate.js && node dist/src/server.js`
- Worker: `node dist/src/worker.js`

Use managed PostgreSQL with the `vector` extension, managed Redis, and private
S3-compatible storage. Set all values from `.env.example` in the deployment
secret manager. Run at least one worker independently from the web service so
OCR cannot block HTTP traffic.

For a Compose deployment with environment validation and health checks:

```bash
./scripts/deploy.sh
```

## Documentation

- [OVERVIEW.md](OVERVIEW.md) — the ideas, tech, and how it works, in one read
- [docs/WHY_HOGYOKU.md](docs/WHY_HOGYOKU.md) — evaluating it? the 4 questions, answered
- [docs/POSITIONING.md](docs/POSITIONING.md) — identity, messaging, and where it fits
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — system and data-flow diagrams
- [docs/API.md](docs/API.md) — full HTTP API reference
- [docs/TIERS.md](docs/TIERS.md) — Free / Standard / Pro deployment tiers
- [docs/DEVOPS.md](docs/DEVOPS.md) — Compose, Terraform, Ansible, Nix, CI
- [docs/SECURITY.md](docs/SECURITY.md) — hardening and security controls
- [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) — common issues and FAQ
- [CONTRIBUTING.md](CONTRIBUTING.md) — dev setup and contribution workflow
- [CHANGELOG.md](CHANGELOG.md) — what changed between versions

Common tasks: `make help` (or use the npm scripts directly on Windows).

## Repository Layout

```text
.
|-- public/               Browser application
|-- src/
|   |-- db/               PostgreSQL client and migrations
|   |-- http/             Auth, document, and thread APIs
|   |-- lib/              Storage, sessions, queue, passwords, chunking, text
|   `-- services/         AI, extraction, ingestion, retrieval, answers, conversation
|-- scripts/              Bash operations and Python evaluation tools
|-- python/               Offline RAG and security guardrails
|-- services/docproc/     Rust chunking utility
|-- infra/terraform/      AWS ECS, S3, ECR, IAM, logs, and secrets
|-- ansible/              VPS hardening and Compose deployment playbooks
|-- docs/                 Tier guide, DevOps, and security docs
|-- evaluations/          Retrieval benchmark datasets
|-- tests/                Node test suite
|-- .env.free.example     Tier 1 (free, local Docker) preset
|-- .env.standard.example Tier 2 (managed free/cheap) preset
|-- .env.pro.example      Tier 3 (managed production) preset
|-- docker-compose.yml    Complete local service topology
`-- Dockerfile            API and worker container image
```
