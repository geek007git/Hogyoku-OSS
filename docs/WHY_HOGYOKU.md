# Is Hogyoku worth your time?

A straight answer to the four questions every developer actually asks before
adopting a project. No marketing — just what Hogyoku does, how it helps, and
where its edges are.

---

## 1. What makes it different? (30 seconds)

> **Most RAG tools generate an answer with citations and stop. Hogyoku adds an
> independent verification pass that checks whether each claim is actually
> supported by the evidence — and withholds the answer when it isn't.**

That honesty is the whole point. You get answers you can trust, or a clear "the
evidence is too weak," never a confident hallucination.

It also:

- **Runs at $0** with no model key (deterministic local embeddings + extractive,
  still-cited answers) and upgrades to generated answers when you add one.
- Uses **hybrid retrieval** — semantic vectors + full-text, fused with
  reciprocal-rank fusion — in a single SQL query.
- Is **multimodal**: OCR + optional vision turn scans, charts, and tables into
  searchable evidence.
- Is **vendor-neutral**: only needs PostgreSQL + `pgvector`, a Redis-compatible
  queue, and S3-compatible storage. Same code from laptop to managed cloud.

| | Typical RAG demo | **Hogyoku** |
| --- | --- | --- |
| Citations | Sometimes | Always, mapped to real passages |
| Unsupported answers | Shown anyway | **Verified and withheld** |
| Works with no API key | Rarely | **Yes (offline mode)** |
| Retrieval | Vector-only | **Semantic + lexical + RRF** |
| Inputs | Text | **Text, PDF, scans, images** |
| Cost floor | Cloud + tokens | **$0 local** |
| Your data | Often leaves the box | **Stays private by default** |

---

## 2. Can you solve a real problem in 10 minutes?

**The problem:** "I have a folder of private PDFs/reports and I want to ask
questions across them and get answers I can trust — with sources — without
sending my data to a third party or paying for a model to try it."

**The path (Free tier, ~10 minutes, $0):**

| Time | Step |
| --- | --- |
| 0:00 | `git clone` and `cd` into the repo |
| 0:30 | `cp .env.free.example .env` |
| 1:00 | Generate a session secret and paste it into `.env`:<br>`node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| 1:30 | `docker compose up --build` (first build pulls images) |
| ~6:00 | Open `http://localhost:4173` and create an account |
| ~7:00 | Upload a PDF, scan, or image — ingestion runs in the background |
| ~9:00 | Ask a question; get a cited answer with a verification score |
| ~10:00 | Click a citation to see the exact passage it came from |

No API key required. Add a free [Google AI Studio](https://aistudio.google.com/app/apikey)
key to `.env` later for generated + verified prose instead of extractive answers.

> Prefer managed hosting or production? See [TIERS.md](TIERS.md) for the
> Standard and Pro paths — same steps, different `.env` preset.

---

## 3. Can you extend it without modifying the core?

Yes — Hogyoku is built around clear seams. Most adaptations are **config only**;
the rest are **one well-isolated file**. You rarely touch unrelated code.

| You want to… | Change this | You do **not** touch |
| --- | --- | --- |
| Swap Postgres / Redis / storage vendor | `.env` (`DATABASE_URL`, `REDIS_URL`, `S3_*`) | Any application code |
| Change models or dimensions | `.env` (`CHAT_MODEL`, `VISION_MODEL`, `EMBEDDING_MODEL`) | Routes, retrieval, UI |
| Use a non-Gemini model provider | `src/services/ai.ts` (`embedTexts`, `completeJson`, `describeImage`) | Everything else |
| Support a new file type | `src/services/extraction.ts` + the allow-list in `src/http/documents.ts` | Retrieval, answers |
| Tune retrieval (limits, RRF, HNSW) | `src/services/retrieval.ts`, the migration | The API contract |
| Change chunking strategy | `src/lib/chunking.ts` | Ingestion wiring |
| Adjust verification thresholds / prompts | `src/services/answers.ts`, `src/services/conversation.ts` | The UI |
| Add an API endpoint | A new `registerXRoutes` module + register it in `src/app.ts` | Existing routes |
| Restyle the UI | `public/` (dependency-free, no build step) | The backend |

Measure your changes objectively before you ship them:

```bash
npm run evaluate     # retrieval recall@k + MRR on a JSONL dataset
npm run guardrails   # offline RAG + security linters (zero model calls)
npm test             # hermetic unit suite
```

**Honest framing:** Hogyoku is a cohesive application, not a plugin framework.
There is no dynamic plugin registry — extension means swapping config or editing
a single, clearly-scoped module behind a stable interface. For most real needs
(new vendor, new model, new file type, tuned retrieval) that is one file.

---

## 4. Would you recommend it to a teammate?

**Reasons you would:**

- Answers are **trustworthy by construction** (cited + verified, or withheld).
- **Zero-cost, no-signup** evaluation — it runs offline on your machine.
- **No lock-in** — every dependency is swappable; nothing is proprietary.
- **Production-grade**: typed throughout, hermetic unit tests plus a live
  PostgreSQL + pgvector integration test, CI matrix, CodeQL, Dependabot,
  graceful shutdown, validated config, and security defaults (scrypt, hashed
  sessions, CSP, rate limits, per-user isolation).
- **Readable and documented** — see [../OVERVIEW.md](../OVERVIEW.md),
  [ARCHITECTURE.md](ARCHITECTURE.md), and [API.md](API.md).

**Honest caveats:**

- It needs PostgreSQL (+`pgvector`), Redis, and S3-compatible storage — the
  Free tier wraps all three in Docker, but it's not a single static binary.
- Generated-answer quality scales with the model tier you choose; the free
  offline mode is extractive, not generative.
- Adding a brand-new model backend means implementing one adapter file
  (`ai.ts`), not flipping a setting.

**Bottom line:** if your teammate needs grounded, private, verifiable answers
over their own documents — and wants to try it without spending a cent or
signing up for anything — yes, you'd recommend it.

---

## Where to go next

- [../README.md](../README.md) — overview and quick start
- [../OVERVIEW.md](../OVERVIEW.md) — the full project tour
- [TIERS.md](TIERS.md) — Free / Standard / Pro deployment
- [ARCHITECTURE.md](ARCHITECTURE.md) — diagrams
- [API.md](API.md) — HTTP API reference
- [../CONTRIBUTING.md](../CONTRIBUTING.md) — start contributing
