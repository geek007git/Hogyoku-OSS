// Conversational RAG helpers: turn a follow-up question into a standalone
// search query and format prior turns for grounded, history-aware answers.
//
// The pure helpers below intentionally avoid importing the model client (and
// therefore the environment-validated config) at module load, so they can be
// unit tested in isolation. The model is loaded lazily inside
// rewriteStandaloneQuery only when a provider is configured.

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}

export interface RewriteResult {
  query: string;
  rewritten: boolean;
}

const FOLLOW_UP_HINTS =
  /\b(it|its|it's|they|them|their|that|those|this|these|he|she|him|his|her|same|above|below|previous|prior|earlier|former|latter|instead|also|then|why|how come)\b/i;

const MAX_TRANSCRIPT_TURNS = 6;
const MAX_TURN_CHARS = 600;
const MAX_QUERY_CHARS = 400;

function normalize(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function formatTranscript(
  history: ConversationTurn[],
  maxTurns = MAX_TRANSCRIPT_TURNS,
): string {
  return history
    .slice(-maxTurns)
    .map((turn) => {
      const speaker = turn.role === "user" ? "User" : "Assistant";
      return `${speaker}: ${normalize(turn.content).slice(0, MAX_TURN_CHARS)}`;
    })
    .join("\n");
}

export function looksLikeFollowUp(question: string): boolean {
  const words = normalize(question).split(" ").filter(Boolean);
  if (words.length <= 5) return true;
  return FOLLOW_UP_HINTS.test(question);
}

export function buildFallbackQuery(
  history: ConversationTurn[],
  question: string,
): string {
  const trimmed = normalize(question);
  if (!history.length || !looksLikeFollowUp(trimmed)) {
    return trimmed.slice(0, MAX_QUERY_CHARS);
  }
  const lastUser = [...history].reverse().find((turn) => turn.role === "user");
  if (!lastUser) return trimmed.slice(0, MAX_QUERY_CHARS);
  return `${normalize(lastUser.content)} ${trimmed}`.slice(0, MAX_QUERY_CHARS);
}

export async function rewriteStandaloneQuery(
  history: ConversationTurn[],
  question: string,
): Promise<RewriteResult> {
  const original = normalize(question);
  if (!history.length) return { query: original, rewritten: false };

  const { completeJson, hasModelProvider } = await import("./ai.js");

  if (!hasModelProvider()) {
    const query = buildFallbackQuery(history, question);
    return { query, rewritten: query !== original };
  }

  const payload = await completeJson<{ query: string }>(
    `You rewrite a follow-up question into a single standalone search query.
Resolve pronouns and references using the conversation so the query is
self-contained. Return JSON {"query": string}. Keep it concise. Do not answer
the question and do not invent details that are not implied.`,
    `Conversation so far:\n${formatTranscript(history)}\n\nFollow-up question:\n${original}`,
  );

  const query = payload?.query ? normalize(payload.query) : "";
  if (!query) {
    const fallback = buildFallbackQuery(history, question);
    return { query: fallback, rewritten: fallback !== original };
  }
  return {
    query: query.slice(0, MAX_QUERY_CHARS),
    rewritten: query.toLowerCase() !== original.toLowerCase(),
  };
}
