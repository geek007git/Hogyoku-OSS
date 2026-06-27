import { createHash } from "node:crypto";
import { GoogleGenAI } from "@google/genai";
import { config } from "../config.js";

const client = config.GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: config.GEMINI_API_KEY,
    })
  : null;

export function hasModelProvider(): boolean {
  return client !== null;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (!client) return texts.map(deterministicEmbedding);
  const response = await client.models.embedContent({
    model: config.EMBEDDING_MODEL,
    contents: texts,
    config: {
      outputDimensionality: config.EMBEDDING_DIMENSIONS,
    },
  });
  const embeddings = response.embeddings?.map((item) => item.values ?? []);
  if (!embeddings || embeddings.length !== texts.length) {
    throw new Error("Gemini returned an incomplete embedding response");
  }
  return embeddings;
}

export async function completeJson<T>(
  system: string,
  user: string,
): Promise<T | null> {
  if (!client) return null;
  const response = await client.models.generateContent({
    model: config.CHAT_MODEL,
    contents: user,
    config: {
      systemInstruction: system,
      temperature: 0.1,
      responseMimeType: "application/json",
    },
  });
  const value = response.text;
  return value ? (JSON.parse(value) as T) : null;
}

export async function describeImage(
  buffer: Buffer,
  mimeType: string,
): Promise<string | null> {
  if (!client) return null;
  const response = await client.models.generateContent({
    model: config.VISION_MODEL,
    contents: [
      {
        text:
          "Extract all useful evidence from this document image. Describe charts, tables, labels, relationships, and visible text precisely.",
      },
      {
        inlineData: {
          mimeType,
          data: buffer.toString("base64"),
        },
      },
    ],
    config: {
      temperature: 0.1,
      maxOutputTokens: 700,
    },
  });
  return response.text ?? null;
}

function deterministicEmbedding(text: string): number[] {
  const vector = new Array<number>(config.EMBEDDING_DIMENSIONS).fill(0);
  const tokens = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  for (const token of tokens) {
    const digest = createHash("sha256").update(token).digest();
    for (let index = 0; index < 8; index += 1) {
      const position = digest.readUInt16BE(index * 2) % vector.length;
      vector[position] = (vector[position] ?? 0) + (digest[index]! % 2 ? 1 : -1);
    }
  }
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / magnitude);
}
