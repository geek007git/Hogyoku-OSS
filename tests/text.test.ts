import assert from "node:assert/strict";
import test from "node:test";
import { summarizeSentences } from "../src/lib/text.js";

test("summarizeSentences returns the first two sentences by default", () => {
  const text = "First sentence. Second sentence. Third sentence.";
  assert.equal(summarizeSentences(text), "First sentence. Second sentence.");
});

test("summarizeSentences respects a custom sentence count", () => {
  const text = "One. Two. Three. Four.";
  assert.equal(summarizeSentences(text, 1), "One.");
  assert.equal(summarizeSentences(text, 3), "One. Two. Three.");
});

test("summarizeSentences collapses whitespace", () => {
  const text = "  Spread   out\n\nsentence  here.  ";
  assert.equal(summarizeSentences(text), "Spread out sentence here.");
});

test("summarizeSentences handles text without sentence punctuation", () => {
  assert.equal(summarizeSentences("a bare fragment"), "a bare fragment");
});

test("summarizeSentences returns empty string for blank input", () => {
  assert.equal(summarizeSentences("   "), "");
  assert.equal(summarizeSentences(""), "");
});

test("summarizeSentences treats a zero or negative count as at least one", () => {
  const text = "Alpha. Beta. Gamma.";
  assert.equal(summarizeSentences(text, 0), "Alpha.");
});
