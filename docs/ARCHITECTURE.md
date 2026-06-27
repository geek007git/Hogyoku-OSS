# Architecture

Diagrams for how Hogyoku is wired and how data flows. These render on GitHub
(Mermaid). For the narrative version, see [../OVERVIEW.md](../OVERVIEW.md).

## System topology

```mermaid
flowchart LR
  user([Browser client])

  subgraph app[Hogyoku application image]
    web[Web / API · Fastify]
    worker[Ingestion worker · BullMQ]
  end

  pg[(PostgreSQL + pgvector)]
  redis[(Redis · queue)]
  s3[(S3-compatible storage)]
  gem{{Gemini · optional}}

  user -->|HTTPS| web
  web -->|sessions, docs, chunks, threads| pg
  web -->|enqueue ingest job| redis
  web -->|put/get objects| s3
  web -.->|embed · chat · verify| gem

  redis -->|deliver job| worker
  worker -->|download original| s3
  worker -->|extract · chunk · embed| gem
  worker -->|write chunks + embeddings| pg
```

The web service and the worker run from the **same container image** with
different start commands. OCR and embedding happen on the worker so they never
block HTTP traffic. Gemini is optional — without it, deterministic local paths
are used.

## Ask pipeline (v2, conversational)

```mermaid
sequenceDiagram
  autonumber
  participant U as User
  participant API as Web/API
  participant DB as PostgreSQL
  participant M as Model (or offline)

  U->>API: POST /api/ask (question, threadId?, documentIds?)
  API->>DB: load recent thread history
  API->>M: rewrite follow-up into a standalone query
  M-->>API: standalone search query
  API->>DB: hybrid retrieval (vector + full-text) with RRF
  DB-->>API: top evidence chunks
  API->>M: draft grounded answer with [n] citations
  M-->>API: answer + claims
  API->>M: verify each claim against evidence (score 0-100)
  M-->>API: verification result
  alt supported and score high
    API-->>U: answer + citations + verification
  else weak support
    API-->>U: withheld notice + evidence to inspect
  end
  API->>DB: store assistant message (citations, verification)
```

## Ingestion pipeline

```mermaid
flowchart TD
  up[Upload file] --> val{Valid type and size?}
  val -- no --> rej[Reject 4xx]
  val -- yes --> store[Store original in bucket]
  store --> q[Enqueue BullMQ job]
  q --> dl[Worker downloads file]
  dl --> kind{File kind}
  kind -- PDF --> pdf[PDF.js text per page]
  kind -- image/scan --> ocr[Sharp normalize + Tesseract OCR + optional vision]
  kind -- text/md/csv/json --> txt[Read directly]
  pdf --> chunk[Page-aware overlapping chunks]
  ocr --> chunk
  txt --> chunk
  chunk --> emb[Embed each chunk]
  emb --> write[(Transactional write: chunks + embeddings + FTS index)]
  write --> ready[Mark document ready]
```

## Retrieval detail

A single SQL statement computes two rankings and fuses them with Reciprocal
Rank Fusion:

- **Semantic rank** — `embedding <=> query` cosine distance over a `pgvector`
  HNSW index.
- **Lexical rank** — `ts_rank_cd` over a generated `tsvector` using
  `websearch_to_tsquery`.
- **Fusion** — `1/(60 + semantic_rank) + 1/(60 + lexical_rank)` (lexical term
  only counts when there is a lexical match), ordered by the combined score and
  scoped to the requesting user's `ready` documents.

This gives precise keyword matches *and* semantic recall without a separate
search service.
