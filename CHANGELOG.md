# Changelog

All notable changes to Hogyoku are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

_No unreleased changes yet._

## [2.0.0] — 2026-06-27 · Conversational Research

Version 2 turns Hogyoku from a single-shot question/answer tool into a
multi-turn research conversation. No database migration is required to upgrade
from v1 — all changes build on the existing schema.

### Added

- **Conversational query rewriting** (`src/services/conversation.ts`, new).
  Follow-up questions are rewritten into standalone, reference-free search
  queries before retrieval, so pronouns and references ("why is *it*
  effective?") resolve against the thread history.
  - Uses the configured model when a `GEMINI_API_KEY` is present.
  - Falls back to a deterministic heuristic (detects short or referential
    follow-ups and prepends the prior question's context) when no provider is
    configured, so it works fully offline.
- **History-aware answers.** Prior turns are passed to the grounded answer pass
  as interpretation context only — never as a citable source.
- **Full multi-turn thread UI.** The workspace now renders the entire
  conversation. Each turn shows its own question, grounded answer, verification
  card, and evidence. Clicking a citation in any turn refocuses the evidence
  panel on that turn's sources.
- **Thread management.** Rename and delete threads from the sidebar
  (`PATCH /api/threads/:id` and `DELETE /api/threads/:id`).
- **Markdown export.** The toolbar "Export" button downloads the active thread,
  including citations and verification scores, as a `.md` file.
- **Sign out.** A profile menu in the sidebar calls the existing
  `POST /api/auth/logout` endpoint and resets client state.
- **Tests.** New `tests/conversation.test.ts` covers the offline query-rewrite
  and transcript helpers (7 new cases; suite is now 14 tests).
- **Deployment tiers.** Three ready-to-use presets — `.env.free.example`
  (local Docker, $0), `.env.standard.example` (managed free/cheap tiers), and
  `.env.pro.example` (managed production) — plus a full tier guide at
  `docs/TIERS.md`. README and `SETUP_REQUIRED.md` lead with tier selection.
- **Open-source package.** `OVERVIEW.md` (project tour), `docs/ARCHITECTURE.md`
  (Mermaid system/sequence/ingestion diagrams), `CONTRIBUTING.md`,
  `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1), `.github/SECURITY.md`
  (private vulnerability reporting), issue and pull-request templates, and an
  `.editorconfig`.
- **Guardrail generalization.** The offline secret scanner now exempts all
  `.env.*.example` documentation presets (it previously exempted only the
  canonical `.env.example`), faithful to the original intent.
- **Developer experience & hardening.** Full HTTP API reference
  (`docs/API.md`), a `Makefile` of common tasks, a CodeQL security-analysis
  workflow, and Dependabot for npm/pip/cargo/docker/terraform/actions. A new
  `src/lib/text.ts` extracts the extractive-summary helper for hermetic unit
  testing (suite is now 20 tests).
- **Database integration tests.** `tests/integration/` exercises the real
  PostgreSQL + pgvector hybrid-retrieval SQL (semantic + lexical + RRF), user
  isolation, and the offline cited-answer path. Gated on `RUN_DB_TESTS=1`; a new
  CI `integration` job runs them against a `pgvector/pgvector` service
  container. The default `npm test` stays hermetic (`tests/*.test.ts`); use
  `npm run test:integration` for the database tests.
- **Release engineering.** A tag-driven release workflow
  (`.github/workflows/release.yml`), `.github/CODEOWNERS`, and `.nvmrc` (Node 22)
  for consistent contributor tooling and automated GitHub releases.
- **Public-release readiness.** `CITATION.cff` (GitHub "Cite this repository"),
  `docs/TROUBLESHOOTING.md` (setup/runtime FAQ), `.github/SUPPORT.md`, README
  badges (CodeQL, Node, PRs welcome, Contributor Covenant), and a Keep a
  Changelog–formatted, dated changelog.

### Changed

- `answerWithEvidence(question, evidence)` now accepts an optional third
  argument: `history: ConversationTurn[]`.
- `POST /api/ask` now loads recent thread history, rewrites the query, and
  returns `searchQuery` and `rewritten` alongside the answer message.
- **Config validation** now reports missing/invalid environment variables as a
  clear, grouped message and exits non-zero, instead of throwing a raw
  `ZodError` stack at boot.
- **Graceful shutdown** now closes the BullMQ queue and PostgreSQL pool in
  addition to the HTTP server, with a re-entry guard and a 10s force-exit
  safety net (SIGTERM/SIGINT friendly for ECS/Cloud Run).
- The default `npm test` is now hermetic (`tests/*.test.ts`); database
  integration tests run via `npm run test:integration`.
- CORS allowed methods now include `PATCH` (required for thread rename
  preflight).
- The browser file picker `accept` list now includes `.json`, matching the
  file types the server already accepts.
- Front end rebuilt around a `#conversation` container with per-turn rendering
  and event delegation, replacing the single static answer card.
- `package.json` version bumped to `2.0.0`; description updated to
  "Conversational multimodal RAG workspace with cited, verified answers."
- README gained a "What's New in v2" section and an updated request lifecycle.

### Fixed

- Added the missing local `.env` (previously referenced by `SETUP_REQUIRED.md`
  but absent), with a freshly generated `SESSION_SECRET`, so `npm run dev`
  starts without a config validation error.
- The profile button and "Share" button were inert in v1; both now have working
  behavior (sign out and Markdown export respectively).

### Compatibility

- No schema migration needed. v1 threads and messages render correctly in the
  v2 conversation view.
- Existing API routes are unchanged except for the added `searchQuery` /
  `rewritten` fields in the `POST /api/ask` response and the new thread
  `PATCH`/`DELETE` routes.
- Works with or without a model provider key, exactly as in v1.

---

## [1.0.0] — Initial Release

- Multimodal RAG over PDFs, scans, images, Markdown, CSV, JSON, and plain text.
- OCR and visual extraction (PDF.js, Sharp, Tesseract); Gemini chat, vision, and
  embedding models with deterministic local fallbacks.
- Hybrid semantic + lexical retrieval with reciprocal-rank fusion over
  PostgreSQL + `pgvector` (HNSW) and full-text search.
- Cited answers with a separate claim-verification pass; unsupported drafts are
  withheld.
- BullMQ ingestion worker on Redis; private S3-compatible object storage.
- Scrypt passwords, opaque hashed sessions, secure cookies, origin checks, rate
  limits, CSP, upload limits, and per-user data isolation.
- Single-answer web client, offline Python RAG/security guardrails, and
  Terraform/Ansible/Docker/Nix infrastructure.
