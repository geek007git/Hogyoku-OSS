import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFallbackQuery,
  formatTranscript,
  looksLikeFollowUp,
  type ConversationTurn,
} from "../src/services/conversation.js";

test("buildFallbackQuery returns the question unchanged without history", () => {
  assert.equal(
    buildFallbackQuery([], "What is hybrid retrieval?"),
    "What is hybrid retrieval?",
  );
});

test("buildFallbackQuery expands pronoun follow-ups using the last user turn", () => {
  const history: ConversationTurn[] = [
    { role: "user", content: "How does reciprocal rank fusion work?" },
    { role: "assistant", content: "It merges ranked lists into one score." },
  ];
  const query = buildFallbackQuery(history, "Why is it effective?");
  assert.match(query, /reciprocal rank fusion/i);
  assert.match(query, /effective/i);
});

test("buildFallbackQuery leaves a self-contained question untouched", () => {
  const history: ConversationTurn[] = [
    { role: "user", content: "Earlier question about embeddings." },
  ];
  const question =
    "Explain hierarchical navigable small world graphs accelerating vector search";
  assert.equal(buildFallbackQuery(history, question), question);
});

test("buildFallbackQuery collapses whitespace", () => {
  assert.equal(
    buildFallbackQuery([], "  what    is   chunking?  "),
    "what is chunking?",
  );
});

test("looksLikeFollowUp flags short or referential questions", () => {
  assert.equal(looksLikeFollowUp("Why?"), true);
  assert.equal(looksLikeFollowUp("What about its limitations?"), true);
  assert.equal(
    looksLikeFollowUp(
      "Describe the full hybrid retrieval and reranking pipeline in depth",
    ),
    false,
  );
});

test("formatTranscript labels speakers and keeps recent turns", () => {
  const transcript = formatTranscript([
    { role: "user", content: "First question" },
    { role: "assistant", content: "First answer" },
  ]);
  assert.match(transcript, /^User: First question$/m);
  assert.match(transcript, /^Assistant: First answer$/m);
});

test("formatTranscript truncates to the most recent turns", () => {
  const history: ConversationTurn[] = Array.from({ length: 10 }, (_, index) => ({
    role: index % 2 === 0 ? "user" : "assistant",
    content: `turn ${index}`,
  }));
  const transcript = formatTranscript(history, 4);
  assert.equal(transcript.split("\n").length, 4);
  assert.match(transcript, /turn 9/);
  assert.doesNotMatch(transcript, /turn 0\b/);
});
