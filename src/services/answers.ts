import { completeJson, hasModelProvider } from "./ai.js";
import { type ConversationTurn, formatTranscript } from "./conversation.js";
import { summarizeSentences } from "../lib/text.js";
import type { Evidence } from "./retrieval.js";

export interface Citation {
  evidenceId: string;
  index: number;
  documentId: string;
  documentTitle: string;
  filename: string;
  pageNumber: number | null;
  kind: string;
  snippet: string;
  score: number;
}

export interface VerifiedAnswer {
  answer: string;
  citations: Citation[];
  verification: {
    supported: boolean;
    score: number;
    claims: Array<{
      text: string;
      supported: boolean;
      citationIndexes: number[];
      reason: string;
    }>;
  };
  modelMode: "provider" | "extractive";
}

interface DraftPayload {
  answer: string;
  claims: Array<{
    text: string;
    citationIndexes: number[];
  }>;
}

interface VerificationPayload {
  score: number;
  claims: Array<{
    text: string;
    supported: boolean;
    citationIndexes: number[];
    reason: string;
  }>;
}

export async function answerWithEvidence(
  question: string,
  evidence: Evidence[],
  history: ConversationTurn[] = [],
): Promise<VerifiedAnswer> {
  const citations = evidence.map((item, index) => ({
    evidenceId: item.id,
    index: index + 1,
    documentId: item.documentId,
    documentTitle: item.documentTitle,
    filename: item.filename,
    pageNumber: item.pageNumber,
    kind: item.kind,
    snippet: item.content.slice(0, 700),
    score: item.score,
  }));

  if (!evidence.length) return unsupportedAnswer(citations);

  const context = evidence
    .map(
      (item, index) =>
        `[${index + 1}] ${item.documentTitle}, page ${item.pageNumber ?? "unknown"} (${item.kind})\n${item.content}`,
    )
    .join("\n\n");

  const transcript = history.length
    ? `Conversation so far (context only — never cite or treat as evidence):\n${formatTranscript(history)}\n\n`
    : "";

  const draft = await completeJson<DraftPayload>(
    `You are Hogyoku, an evidence-only research assistant.
Return JSON with "answer" and "claims".
Every factual sentence must end with one or more citations like [1].
Use only the supplied evidence. If evidence is insufficient, say so.
Use the conversation only to interpret the question, never as a source.
claims must contain each factual claim and its citationIndexes.`,
    `${transcript}Question:\n${question}\n\nEvidence:\n${context}`,
  );

  if (!draft) return extractiveAnswer(question, evidence, citations);

  const verification = await completeJson<VerificationPayload>(
    `You verify evidence-grounded answers. Return JSON with score from 0-100 and claims.
For every claim, set supported, citationIndexes, and a concise reason.
A claim is supported only when the cited evidence directly entails it.
Penalize missing citations and overstatement.`,
    `Question:\n${question}\n\nDraft:\n${draft.answer}\n\nClaims:\n${JSON.stringify(draft.claims)}\n\nEvidence:\n${context}`,
  );

  const checked = verification ?? {
    score: 75,
    claims: draft.claims.map((claim) => ({
      ...claim,
      supported: claim.citationIndexes.length > 0,
      reason: "Citation present; provider verification unavailable.",
    })),
  };
  const supported = checked.score >= 70 && checked.claims.every((claim) => claim.supported);

  return {
    answer: supported
      ? draft.answer
      : "The retrieved sources do not support every claim strongly enough to provide a reliable answer. Review the evidence below or refine the question.",
    citations,
    verification: {
      supported,
      score: Math.max(0, Math.min(100, Math.round(checked.score))),
      claims: checked.claims,
    },
    modelMode: hasModelProvider() ? "provider" : "extractive",
  };
}

function extractiveAnswer(
  question: string,
  evidence: Evidence[],
  citations: Citation[],
): VerifiedAnswer {
  const top = evidence.slice(0, 3);
  const answer = [
    `A model provider is not configured, so Hogyoku is returning the strongest retrieved evidence for: "${question}".`,
    ...top.map((item, index) => `${summarizeSentences(item.content)} [${index + 1}]`),
  ].join("\n\n");
  return {
    answer,
    citations,
    verification: {
      supported: true,
      score: 72,
      claims: top.map((item, index) => ({
        text: summarizeSentences(item.content),
        supported: true,
        citationIndexes: [index + 1],
        reason: "Direct extract from the cited source.",
      })),
    },
    modelMode: "extractive",
  };
}

function unsupportedAnswer(citations: Citation[]): VerifiedAnswer {
  return {
    answer:
      "I could not find enough relevant evidence in the selected documents. Try broadening the source selection or rephrasing the question.",
    citations,
    verification: {
      supported: false,
      score: 0,
      claims: [],
    },
    modelMode: hasModelProvider() ? "provider" : "extractive",
  };
}
