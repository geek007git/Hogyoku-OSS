import assert from "node:assert/strict";
import test from "node:test";
import { chunkPages } from "../src/lib/chunking.js";

test("chunkPages preserves page metadata and stable ordinals", () => {
  const chunks = chunkPages([
    {
      pageNumber: 3,
      text: "First supported claim. Second supported claim.",
      kind: "table",
      metadata: { table: 1 },
    },
  ]);

  assert.equal(chunks.length, 1);
  assert.equal(chunks[0]?.pageNumber, 3);
  assert.equal(chunks[0]?.ordinal, 0);
  assert.equal(chunks[0]?.kind, "table");
  assert.deepEqual(chunks[0]?.metadata, { table: 1 });
});

test("chunkPages drops empty pages", () => {
  assert.deepEqual(chunkPages([{ pageNumber: 1, text: "   " }]), []);
});

test("chunkPages splits long content with overlap", () => {
  const sentence = "Evidence supports this specific statement. ";
  const chunks = chunkPages([{ pageNumber: 1, text: sentence.repeat(80) }]);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.content.length > 0));
  assert.deepEqual(
    chunks.map((chunk) => chunk.ordinal),
    chunks.map((_, index) => index),
  );
});
