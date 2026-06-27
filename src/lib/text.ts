// Small, dependency-free text helpers. Kept free of config/model imports so
// they can be unit tested in isolation and reused across services.

const SENTENCE_PATTERN = /[^.!?]+[.!?]+|[^.!?]+$/g;

/**
 * Return the first `maxSentences` sentences of `text`, normalized to single
 * spaces. Falls back to the whole string when no sentence boundary is found.
 */
export function summarizeSentences(text: string, maxSentences = 2): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  const sentences = normalized.match(SENTENCE_PATTERN) ?? [normalized];
  return sentences
    .slice(0, Math.max(1, maxSentences))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
