# Hogyoku — Project Overview

A complete tour of what Hogyoku is, the ideas behind it, the technology it uses,
how it works end to end, the things that make it interesting, and what changed
in version 2.

If you only read one document about this project, read this one. For setup pick
a tier in [docs/TIERS.md](docs/TIERS.md); for the full change history see
[CHANGELOG.md](CHANGELOG.md).

---

## 1. What Hogyoku is

**Self-hosted RAG that verifies its answers.**

Hogyoku is an open-source, multimodal **RAG (Retrieval-Augmented Generation)**
workspace for private document libraries. You upload documents — PDFs, scans,
images, Markdown, CSV, JSON, plain text — and then ask questions about them. It
answers with prose that **cites the exact passages** it used, and it runs a
**separate verification pass** that checks each claim against the evidence.
If the evidence does not support the answer strongly enough, Hogyoku withholds
it instead of presenting a confident guess.

It is conversational: follow-up questions understand the thread so far, and the
whole conversation is preserved with per-answer evidence.

It runs from a **$0 laptop setup to managed production** on the same codebase.

## 2. The core ideas

These are the principles the project is built around.

- **Evidence first, never vibes.** Every factual sentence ends in a citation
  like `[1]`, and those citations map to real retrieved passages you can read.
- **Verify, then trust.** A second model pass scores whether each claim is
  actually entailed by its cited evidence. Weakly supported drafts are held
  back. This is the difference between "sounds right" and "is supported."
- **Works without a model key.** With no provider configured, Hogyoku still
  ingests, indexes, retrieves, and answers — using deterministic local
  embeddings, extractive answers, and an offline follow-up rewriter. The model
  is an upgrade, not a hard dependency.
- **No vendor lock-in.** It only needs PostgreSQL with `pgvector`, a
  Redis-compatible queue, and S3-compatible storage. Every provider is
  swappable.
- **Zero cost to start, scalable when needed.** Three tiers (Free / Standard /
  Pro) move you from local Docker to autoscaling cloud with config changes, not
  rewrites.
- **Private by default.** Per-user data isolation, scrypt password hashing,
  opaque hashed sessions, secure cookies, origin checks, rate limits, CSP, and
  upload limits.

## 3. How it works (end to end)

> Prefer diagrams? See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for system
> topology, the ask sequence, and the ingestion flow.

### Ingestion (when you upload a document)

1. The API validates the file type and size, then stores it in a private
   object bucket (S3/R2/MinIO). Nothing is processed inline.
2. A background job is queued on Redis (BullMQ) with retry and exponential
   backoff.
3. The ingestion worker downloads the file and **extracts content**:
   - PDFs: text is pulled page by page with PDF.js. Pages with little text are
     flagged as scanned/visual.
   - Images (and scanned pages): normalized with Sharp, OCR'd with Tesseract,
     and — if a vision model is configured — described for charts, tables, and
     labels.
   - Text/Markdown/CSV/JSON: read directly.
4. Content is split into **page-aware, overlapping chunks** (sentence-based,
   with a couple of sentences of overlap so meaning isn't cut at boundaries).
5. Each chunk gets an **embedding** and a PostgreSQL **full-text index**. Chunks
   are written transactionally, and the document is marked `ready`.

### Asking (when you ask a question)

1. **Conversational rewrite** (v2): if you're in an existing thread, your
   follow-up is rewritten into a standalone, reference-free search query so
   "why is *it* effective?" still retrieves the right evidence.
2. **Hybrid retrieval**: the query runs two searches in parallel inside one SQL
   statement — semantic (vector cosine distance over `pgvector`/HNSW) and
   lexical (`websearch_to_tsquery` full-text) — then fuses them with
   **Reciprocal Rank Fusion (RRF)** to get the best of both.
3. **Grounded drafting**: the model writes an answer using only the retrieved
   passages, marking each factual sentence with citations. Prior turns are
   passed as context for interpretation only — never as a citable source.
4. **Verification**: a second pass scores 0–100 and checks each claim for
   entailment and citation completeness.
5. **Gate**: if the score is high and every claim is supported, you get the
   answer. Otherwise Hogyoku tells you the evidence is too weak and shows the
   passages so you can judge for yourself.
6. The turn (question, answer, citations, verification) is stored and rendered
   in the conversation, with the evidence panel showing exactly what was used.

### The offline path (no model key)

- Embeddings: a deterministic hashing-based vector so retrieval still works.
- Answers: extractive — the strongest retrieved passages, cited.
- Follow-ups: a heuristic rewriter that detects short/referential questions and
  prepends the previous question's context.

## 4. The technology and why

| Layer | Choice | Why |
| --- | --- | --- |
| Web/API | Fastify (Node 22, TypeScript, ESM) | Fast, small, schema-validated |
| Validation | Zod | Runtime-checked env and request bodies |
| Database | PostgreSQL + `pgvector` (HNSW) + full-text | Vectors and lexical search in one store |
| Queue | BullMQ on Redis | Durable jobs with retry/backoff |
| Storage | S3-compatible (S3 / R2 / B2 / MinIO) | Private, portable object storage |
| Parsing | PDF.js, Sharp, Tesseract | Text, image normalization, OCR |
| Models | Google Gemini (chat, vision, embeddings) | Generated + verified answers |
| Front end | Dependency-free browser JS + CSS | No build step, easy to fork |
| Doc hashing | Small Rust utility (`services/docproc`) | Deterministic chunk hashing |
| Guardrails | Python, no model calls | Offline RAG/security linting in CI |
| Infra | Terraform, Ansible, Docker, Nix | Local to managed cloud, reproducible |

Notable design details:

- **One image, two roles.** The same container runs as the web service
  (`migrate` + `server`) or the worker (`worker`). OCR runs on workers so it
  never blocks HTTP traffic.
- **RRF in SQL.** Semantic and lexical ranks are computed and fused in a single
  query, keeping retrieval fast and simple.
- **Config is validated at boot.** Missing or malformed environment variables
  fail fast with a clear error rather than surfacing as runtime surprises.

## 5. The interesting bits

- **Claim-level verification gate.** Most RAG demos stop at "generate with
  citations." Hogyoku adds an independent entailment check and will refuse to
  present an unsupported draft. That honesty is the point.
- **Genuinely free, genuinely useful.** The Free tier costs $0, needs no card,
  and still produces cited, verified answers with a free model key — or runs
  fully offline.
- **Multimodal evidence.** Charts, tables, and scanned pages become searchable
  evidence via OCR plus optional vision description, not just plain text.
- **Conversational retrieval (v2).** Query rewriting means follow-ups actually
  retrieve the right context instead of searching for pronouns.
- **Offline guardrails.** A Python toolkit (`python/hogyoku_guardrails`) lints
  for leaked secrets, unsupported cited claims, weak chunk shape, unsafe answer
  behavior, and missing security controls — zero model credits, runs in CI.
- **Retrieval evaluation.** A dependency-free evaluator reports recall@k and MRR
  from JSONL so you can measure retrieval quality objectively.
- **Three tiers, one codebase.** Upgrading from laptop to cloud is a config
  change, not a migration project.

## 6. What's different in v2

Version 2 turns single-shot Q&A into a research conversation. No database
migration is required to upgrade.

- **Conversational query rewriting** (new `src/services/conversation.ts`):
  follow-ups become standalone queries; works with a model or via a
  deterministic offline fallback.
- **History-aware answers**: prior turns inform interpretation, never cited.
- **Full multi-turn thread UI**: the whole conversation renders, each turn with
  its own evidence and verification; clicking a citation refocuses the evidence
  panel on that turn's sources.
- **Thread management**: rename and delete threads
  (`PATCH`/`DELETE /api/threads/:id`).
- **Markdown export**: download a thread, with citations and scores, as `.md`.
- **Sign out** from the profile menu.
- **Deployment tiers**: Free / Standard / Pro presets and `docs/TIERS.md`.
- **Fixes**: added the missing local `.env`, `PATCH` added to CORS, `.json`
  added to the upload picker, and the previously inert profile/Share buttons now
  work.

Full detail: [CHANGELOG.md](CHANGELOG.md).

## 7. How it's different from a typical RAG app

- It **verifies and can refuse**, rather than always answering.
- It is **multimodal** (OCR + vision), not text-only.
- It is **hybrid** (semantic + lexical with RRF), not vector-only.
- It is **useful with no model key**, via deterministic local paths.
- It ships **offline quality/security guardrails** and a **retrieval evaluator**.
- It is **portable across vendors** and **priced from $0**.

## 8. Project layout

```text
.
|-- public/               Browser application (no build step)
|-- src/
|   |-- db/               PostgreSQL client and migrations
|   |-- http/             Auth, document, and thread APIs
|   |-- lib/              Storage, sessions, queue, passwords, chunking
|   `-- services/         AI, extraction, ingestion, retrieval, answers,
|                         conversation
|-- scripts/              Bash operations and Python evaluation tools
|-- python/               Offline RAG and security guardrails
|-- services/docproc/     Rust chunk-hashing utility
|-- infra/terraform/      AWS ECS, S3, ECR, IAM, logs, and secrets
|-- ansible/              VPS hardening and Compose deployment playbooks
|-- docs/                 Tier guide, DevOps, and security docs
|-- evaluations/          Retrieval benchmark datasets
|-- tests/                Node test suite
|-- .env.free.example     Tier 1 (free, local Docker)
|-- .env.standard.example Tier 2 (managed free/cheap)
|-- .env.pro.example      Tier 3 (managed production)
|-- docker-compose.yml    Complete local service topology
`-- Dockerfile            API and worker container image
```

## 9. Run it in three commands (Free tier)

```bash
cp .env.free.example .env
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"  # paste into SESSION_SECRET
docker compose up --build
```

Open `http://localhost:4173`, create an account, upload a document, and ask.

## 10. Quality and contributing

- Type checks: `npm run typecheck`
- Tests: `npm test`
- Retrieval eval: `npm run evaluate`
- Offline guardrails: `npm run guardrails`

CI runs TypeScript checks, Node tests, dependency auditing, Bash syntax checks,
Compose validation, Python retrieval evaluation, and offline Python guardrails
on every pull request. Contributions are welcome — keep the evidence-first,
verify-then-trust spirit, and run the checks above before opening a PR.

Licensed under MIT (see [LICENSE](LICENSE)).
