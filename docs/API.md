# HTTP API Reference

Hogyoku exposes a small JSON + multipart REST API under `/api`. All responses
are JSON unless noted. Errors use `{ "error": string }` (validation errors add a
`details` array).

## Conventions

- **Auth:** session-cookie based (`hogyoku_session`, httpOnly). Authenticate via
  `/api/auth/*`; the cookie is sent automatically by the browser.
- **CSRF/origin:** state-changing requests (`POST`/`PUT`/`PATCH`/`DELETE`) must
  send an `Origin` header matching `APP_ORIGIN`, or they are rejected with `403`.
- **Rate limit:** 120 requests/minute per user (or per IP when anonymous).
- **Isolation:** every resource is scoped to the authenticated user.
- **Body limit:** uploads are capped at `MAX_UPLOAD_MB` (default 40 MB).

## Health

### `GET /api/health`

Liveness + database check. No auth required.

```json
{ "status": "ok", "timestamp": "2026-06-26T12:00:00.000Z" }
```

## Authentication

### `POST /api/auth/register`

```json
{ "email": "you@example.com", "password": "min-10-chars", "displayName": "Optional" }
```

- `201 { "ok": true }` and sets the session cookie.
- `409` if an account already exists for the email.

### `POST /api/auth/login`

```json
{ "email": "you@example.com", "password": "min-10-chars" }
```

- `200 { "ok": true }` and sets the session cookie.
- `401` on invalid credentials (same message for unknown email or bad password).

### `POST /api/auth/logout`

Clears the session. `200 { "ok": true }`.

### `GET /api/auth/me`

- `200 { "user": { "id", "email", "displayName" } }`
- `401` if not authenticated.

## Documents

### `GET /api/documents`

Lists the user's documents with chunk counts.

```json
{
  "documents": [
    {
      "id": "uuid",
      "filename": "paper.pdf",
      "title": "paper",
      "mimeType": "application/pdf",
      "byteSize": 123456,
      "pageCount": 12,
      "status": "ready",
      "errorMessage": null,
      "createdAt": "2026-06-26T12:00:00.000Z",
      "chunkCount": 48
    }
  ]
}
```

`status` is one of `queued`, `processing`, `ready`, `failed`.

### `POST /api/documents`

`multipart/form-data` with a single `file` field. Accepted types: PDF, PNG,
JPEG, WebP, plain text, Markdown, CSV, JSON.

- `202 { "document": { ...; "status": "queued" } }` — ingestion is queued.
- `400` empty/missing file, `415` unsupported type.

The document is processed asynchronously by the worker; poll `GET /api/documents`
for status changes.

### `DELETE /api/documents/:documentId`

- `204` on success (cascades to chunks).
- `404` if not found or not owned by the user.

## Threads and questions

### `GET /api/threads`

```json
{ "threads": [ { "id", "title", "createdAt", "updatedAt", "messageCount" } ] }
```

### `GET /api/threads/:threadId`

```json
{
  "thread": { "id": "uuid", "title": "..." },
  "messages": [
    { "id", "role": "user", "content": "...", "createdAt": "..." },
    {
      "id", "role": "assistant", "content": "...",
      "citations": [ /* Citation[] */ ],
      "verification": { "supported": true, "score": 92, "claims": [ /* ... */ ] },
      "createdAt": "..."
    }
  ]
}
```

- `404` if the thread is not found or not owned by the user.

### `POST /api/ask`

Ask a question. Optionally continue a thread and/or scope to specific documents.

```json
{ "question": "How does reranking help?", "threadId": "uuid?", "documentIds": ["uuid"]? }
```

Response:

```json
{
  "threadId": "uuid",
  "searchQuery": "standalone query used for retrieval",
  "rewritten": true,
  "message": {
    "id": "uuid",
    "content": "Answer text with [1] citations.",
    "citations": [
      {
        "evidenceId": "uuid", "index": 1, "documentId": "uuid",
        "documentTitle": "paper", "filename": "paper.pdf",
        "pageNumber": 3, "kind": "text", "snippet": "...", "score": 0.031
      }
    ],
    "verification": {
      "supported": true,
      "score": 92,
      "claims": [
        { "text": "...", "supported": true, "citationIndexes": [1], "reason": "..." }
      ]
    },
    "modelMode": "provider",
    "createdAt": "..."
  }
}
```

Notes:

- `searchQuery` is the standalone query after conversational rewriting;
  `rewritten` indicates whether it differs from the raw question.
- `modelMode` is `provider` (a Gemini key is configured) or `extractive`
  (offline fallback).
- When evidence is too weak, `verification.supported` is `false` and `content`
  explains that the answer was withheld — inspect the citations instead.

### `PATCH /api/threads/:threadId`

Rename a thread.

```json
{ "title": "New title" }
```

- `200 { "ok": true, "title": "New title" }`
- `404` if not found or not owned.

### `DELETE /api/threads/:threadId`

- `204` on success (cascades to messages).
- `404` if not found or not owned.

## Error shape

```json
{ "error": "Invalid request.", "details": [ { "path": "question", "message": "..." } ] }
```

`details` is present only for request-validation (Zod) failures. Server errors
return `500 { "error": "Internal server error." }` without internal detail.
