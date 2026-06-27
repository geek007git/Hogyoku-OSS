// Integration test for the hybrid-retrieval SQL and the offline answer path.
//
// This exercises the real PostgreSQL + pgvector schema (semantic vector search,
// full-text search, and reciprocal-rank fusion) and the extractive answer
// assembly, end to end, without Redis, S3, or a model provider.
//
// It is gated on RUN_DB_TESTS=1 and a reachable pgvector database. App modules
// are imported dynamically so the default unit suite never loads config.
//
//   docker compose up -d postgres
//   RUN_DB_TESTS=1 \
//   DATABASE_URL=postgres://hogyoku:hogyoku@localhost:5432/hogyoku \
//   REDIS_URL=redis://localhost:6379 S3_ENDPOINT=http://localhost:9000 \
//   S3_BUCKET=hogyoku S3_ACCESS_KEY=minio S3_SECRET_KEY=miniosecret \
//   SESSION_SECRET=test-session-secret-at-least-32-characters-long \
//   npm run test:integration

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";

const RUN = process.env.RUN_DB_TESTS === "1";
const skip = RUN ? false : "set RUN_DB_TESTS=1 with a pgvector database";

let db: typeof import("../../src/db/client.js")["db"];
let embedTexts: typeof import("../../src/services/ai.js")["embedTexts"];
let retrieveEvidence: typeof import("../../src/services/retrieval.js")["retrieveEvidence"];
let answerWithEvidence: typeof import("../../src/services/answers.js")["answerWithEvidence"];

let userId = "";

const CHUNKS = [
  "Reciprocal rank fusion merges the semantic and lexical rankings into a single relevance score for hybrid retrieval.",
  "Hierarchical navigable small world graphs accelerate approximate nearest neighbor search over dense vector embeddings.",
  "Tesseract performs optical character recognition to extract text from scanned document images during ingestion.",
];

before(async () => {
  if (!RUN) return;
  ({ db } = await import("../../src/db/client.js"));
  ({ embedTexts } = await import("../../src/services/ai.js"));
  ({ retrieveEvidence } = await import("../../src/services/retrieval.js"));
  ({ answerWithEvidence } = await import("../../src/services/answers.js"));

  const migration = await readFile(
    new URL("../../src/db/migrations/001_initial.sql", import.meta.url),
    "utf8",
  );
  await db.query(migration);

  userId = randomUUID();
  const documentId = randomUUID();
  await db.query(
    `INSERT INTO users(id, email, display_name, password_hash)
     VALUES ($1, $2, $3, $4)`,
    [userId, `it-${userId}@example.com`, "Integration User", "scrypt$test$test"],
  );
  await db.query(
    `INSERT INTO documents(id, user_id, filename, title, mime_type, byte_size, status, storage_key)
     VALUES ($1, $2, 'doc.txt', 'Hybrid Retrieval Notes', 'text/plain', 256, 'ready', $3)`,
    [documentId, userId, `${userId}/${documentId}/doc.txt`],
  );

  const embeddings = await embedTexts(CHUNKS);
  for (let index = 0; index < CHUNKS.length; index += 1) {
    await db.query(
      `INSERT INTO chunks(document_id, user_id, page_number, ordinal, kind, content, embedding)
       VALUES ($1, $2, 1, $3, 'text', $4, $5::vector)`,
      [documentId, userId, index, CHUNKS[index], `[${embeddings[index]!.join(",")}]`],
    );
  }
});

after(async () => {
  if (!RUN || !db) return;
  if (userId) await db.query("DELETE FROM users WHERE id = $1", [userId]);
  await db.end();
});

test(
  "hybrid retrieval ranks the relevant chunk first and yields a cited extractive answer",
  { skip },
  async () => {
    const question = "How does reciprocal rank fusion work?";
    const evidence = await retrieveEvidence({ userId, query: question });

    assert.ok(evidence.length > 0, "expected at least one evidence chunk");
    assert.match(
      evidence[0]!.content,
      /reciprocal rank fusion/i,
      "the most relevant chunk should rank first",
    );
    assert.ok(
      evidence.every((item) => item.documentTitle === "Hybrid Retrieval Notes"),
      "evidence must stay scoped to the user's ready document",
    );

    const answer = await answerWithEvidence(question, evidence);
    assert.equal(answer.modelMode, "extractive");
    assert.ok(answer.citations.length > 0, "extractive answer should cite sources");
    assert.match(answer.answer, /\[1\]/, "answer should contain a citation marker");
  },
);

test(
  "retrieval isolates by user (a different user sees nothing)",
  { skip },
  async () => {
    const otherUser = randomUUID();
    const evidence = await retrieveEvidence({
      userId: otherUser,
      query: "reciprocal rank fusion",
    });
    assert.equal(evidence.length, 0, "another user must not see these chunks");
  },
);
