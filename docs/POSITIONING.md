# Positioning & Messaging

The single source of truth for how Hogyoku describes itself. Every other
document should align with this one. Every claim here is grounded in the
implementation — if the code and the messaging ever disagree, fix the messaging.

---

## The one sentence

> **Self-hosted RAG that verifies its answers.**

If you only remember one thing: most retrieval tools generate an answer with
citations and stop; Hogyoku independently checks each claim against the evidence
and **withholds the answer when support is weak**.

## What Hogyoku is

A self-hostable, multimodal RAG (Retrieval-Augmented Generation) **workspace**.
You give it your documents — PDFs, scans, images, Markdown, CSV, JSON, plain
text — and it answers questions about them with cited, independently verified
answers, while keeping your data on your own infrastructure.

Grounded in the implementation, that means:

- **Ingestion:** PDF.js text extraction, Sharp + Tesseract OCR, and optional
  vision description, processed by a BullMQ worker on Redis.
- **Indexing:** page-aware overlapping chunks with embeddings and full-text
  indexes in PostgreSQL + `pgvector` (HNSW).
- **Retrieval:** hybrid semantic + lexical search fused with reciprocal-rank
  fusion (RRF) in a single SQL query.
- **Answering:** a grounded draft with `[n]` citations, followed by an
  independent verification pass that scores entailment and **withholds
  unsupported drafts**.
- **Offline-capable:** with no model key it falls back to deterministic local
  embeddings, extractive cited answers, and heuristic follow-up rewriting.
- **Private & portable:** per-user isolation, scrypt + hashed sessions, and only
  generic dependencies (PostgreSQL, a Redis-compatible queue, S3-compatible
  storage).

## What category is it?

**Hogyoku is an application** — a self-hostable, batteries-included product you
*run*, not a library you *build with*.

Justification from the codebase: it ships a complete deployable system —
authentication, sessions, a job queue, object storage, a database schema and
migrations, a browser UI, and infrastructure (Docker, Terraform, Ansible, Nix).
There is no dynamic plugin registry or public SDK surface. Extension happens
through **configuration** (swap vendors and models via environment variables)
and through **clearly-scoped module seams** (e.g. `src/services/ai.ts` for a new
model backend, `src/services/extraction.ts` for a new file type).

So we describe it as an *application* today — honestly, not a "framework."

## The problem it solves

Teams and individuals have private documents and want answers they can trust,
with sources, **without** sending their data to a third party, paying to
evaluate the idea, or accepting a confident hallucination. Hogyoku is the
self-hosted, evidence-first answer to that.

## Who it's for

- **Individuals & researchers** with a private library who want grounded,
  cited answers over their own files.
- **Small teams** needing private knowledge Q&A without a SaaS dependency.
- **AI & infrastructure engineers** who want a vendor-neutral, self-hosted RAG
  baseline they can trust, measure, and extend.
- **Researchers** studying grounded generation, verification, and hybrid
  retrieval who want a readable, runnable reference implementation.

## Why it's different (the moat)

The defining idea is **verify before trust**, implemented as a real second pass
that can withhold an answer — combined with three properties most self-hosted
RAG apps don't offer together: **offline-capable**, **vendor-neutral**, and
**private by default**, delivered as a **production-grade, readable** codebase.

Hogyoku can become known as *"the RAG that won't confidently lie to you."*

## Where it fits in the ecosystem

Accurate, non-exaggerated comparisons.

| Project | What they are | Relationship to Hogyoku |
| --- | --- | --- |
| **Open WebUI, AnythingLLM** | Self-hosted chat-over-docs apps | Same category. Overlap: self-hosted document Q&A. Difference: Hogyoku's verification gate, deterministic offline mode, and retrieval transparency. **Compete, differentiated on trust.** |
| **NotebookLM** | Hosted, proprietary research assistant | Alternative. Hogyoku is self-hosted, open, private, and vendor-neutral. **Complement/alternative for teams that can't use cloud.** |
| **LangChain, LlamaIndex, Haystack, DSPy** | Frameworks/toolkits to *build* RAG | Different category. They are building blocks; Hogyoku is the opinionated, finished result. You could rebuild Hogyoku's pipeline with them. **Complement, not compete.** |
| **Guardrails AI, Ragas** | Output validation / RAG evaluation libraries | Different category. Hogyoku ships its own offline guardrails and a retrieval evaluator, but isn't a general-purpose library. **Complement.** |
| **FastAPI, Prisma, Supabase** | Web/data infrastructure primitives | Different category. Hogyoku is built *on* primitives like these (Fastify, `pg`). **Not competing.** |

Short version: against **apps** Hogyoku competes on trust and portability;
against **frameworks and libraries** it complements them as the runnable,
opinionated reference.

## Messaging artifacts

Use these verbatim for consistency.

**Tagline**
> Evidence-first answers from your own documents — cited, verified, and self-hosted.

**GitHub description (one line)**
> Self-hostable, multimodal RAG workspace that returns cited answers and
> independently verifies every claim against the evidence — withholding
> unsupported ones. Hybrid retrieval on PostgreSQL + pgvector. Runs $0 offline
> to managed cloud. Vendor-neutral, private by default.

**30-second explanation**
> Hogyoku is a self-hosted RAG workspace. Upload your documents and ask
> questions; it answers with citations you can click through to the exact
> passage. Unlike most RAG tools, a second pass independently checks each claim
> against the evidence and withholds answers it can't support. It runs free and
> fully offline on your machine, scales to managed cloud with the same code, and
> depends only on PostgreSQL, Redis, and S3-compatible storage.

**Elevator pitch**
> If you need trustworthy answers over private documents — with sources, on your
> own infrastructure, without paying to try it — Hogyoku is the RAG workspace
> that proves its answers instead of just generating them.

**2-minute explanation**
> Retrieval-Augmented Generation usually works like this: find relevant text,
> hand it to a model, and return whatever it writes — sometimes with citations.
> The failure mode is a fluent answer that the sources don't actually support.
>
> Hogyoku is a self-hostable workspace built to close that gap. It ingests your
> documents (including scans and images, via OCR and optional vision), chunks
> and embeds them, and stores everything in PostgreSQL with `pgvector` plus
> full-text search. A question runs hybrid retrieval — semantic and lexical,
> fused with reciprocal-rank fusion — and the model drafts an answer using only
> the retrieved evidence, marking each sentence with citations. Then a second,
> independent pass scores whether each claim is entailed by its cited evidence;
> weakly supported drafts are withheld rather than presented as fact.
>
> It's private and portable by design: your data stays on your infrastructure,
> and it depends only on generic services (PostgreSQL, a Redis-compatible queue,
> S3-compatible storage) so no vendor is required. It runs at $0 fully offline
> with deterministic local embeddings and extractive answers, and upgrades to
> generated, verified answers when you add a model key — the same code from a
> laptop to managed cloud.

**Mission**
> Make trustworthy, evidence-grounded answers over your own documents something
> anyone can self-host — privately, affordably, and without lock-in.

**Vision**
> A self-hosted standard for *verifiable* document intelligence: answers that
> are always traceable to evidence and honest about their own uncertainty.

**Core principles**
> Evidence First. Verify Before Trust. Security By Default. Offline Friendly.
> Vendor Neutral. Production Ready.

**Value proposition**
> Trustworthy, cited answers over your private documents — verified, self-hosted,
> and free to start.

## Five-year direction (honest, not a roadmap promise)

Hogyoku stays an application at its core. The credible evolution, *only if the
community pulls it there*, is to extract today's clean internal seams —
extractors, retrievers, and model adapters — into reusable packages, moving from
**application → toolkit → ecosystem**. This document will not claim any
capability that does not already exist in the codebase; new capabilities must
ship before they are described.
