import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/client.js";
import { answerWithEvidence } from "../services/answers.js";
import {
  rewriteStandaloneQuery,
  type ConversationTurn,
} from "../services/conversation.js";
import { retrieveEvidence } from "../services/retrieval.js";
import { requireUser } from "./auth.js";

const askSchema = z.object({
  question: z.string().trim().min(3).max(4_000),
  threadId: z.string().uuid().optional(),
  documentIds: z.array(z.string().uuid()).max(100).optional(),
});

const renameSchema = z.object({
  title: z.string().trim().min(1).max(120),
});

export async function registerThreadRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/threads", { preHandler: requireUser }, async (request) => {
    const result = await db.query(
      `SELECT t.id, t.title, t.created_at AS "createdAt",
              t.updated_at AS "updatedAt", count(m.id)::int AS "messageCount"
       FROM threads t
       LEFT JOIN messages m ON m.thread_id = t.id
       WHERE t.user_id = $1
       GROUP BY t.id
       ORDER BY t.updated_at DESC
       LIMIT 50`,
      [request.user!.id],
    );
    return { threads: result.rows };
  });

  app.get<{ Params: { threadId: string } }>(
    "/api/threads/:threadId",
    { preHandler: requireUser },
    async (request, reply) => {
      const thread = await db.query(
        "SELECT id, title FROM threads WHERE id = $1 AND user_id = $2",
        [request.params.threadId, request.user!.id],
      );
      if (!thread.rowCount) return reply.code(404).send({ error: "Thread not found." });
      const messages = await db.query(
        `SELECT id, role, content, citations, verification, created_at AS "createdAt"
         FROM messages WHERE thread_id = $1 ORDER BY created_at`,
        [request.params.threadId],
      );
      return { thread: thread.rows[0], messages: messages.rows };
    },
  );

  app.post("/api/ask", { preHandler: requireUser }, async (request, reply) => {
    const input = askSchema.parse(request.body);
    let threadId = input.threadId;
    let history: ConversationTurn[] = [];
    if (threadId) {
      const ownsThread = await db.query(
        "SELECT 1 FROM threads WHERE id = $1 AND user_id = $2",
        [threadId, request.user!.id],
      );
      if (!ownsThread.rowCount) {
        return reply.code(404).send({ error: "Thread not found." });
      }
      const prior = await db.query<{ role: "user" | "assistant"; content: string }>(
        `SELECT role, content FROM messages
         WHERE thread_id = $1 ORDER BY created_at DESC LIMIT 8`,
        [threadId],
      );
      history = prior.rows.reverse();
    } else {
      const result = await db.query<{ id: string }>(
        `INSERT INTO threads(user_id, title)
         VALUES ($1, $2) RETURNING id`,
        [request.user!.id, input.question.slice(0, 80)],
      );
      threadId = result.rows[0]!.id;
    }

    await db.query(
      `INSERT INTO messages(thread_id, user_id, role, content)
       VALUES ($1, $2, 'user', $3)`,
      [threadId, request.user!.id, input.question],
    );

    const { query: searchQuery, rewritten } = await rewriteStandaloneQuery(
      history,
      input.question,
    );

    const evidence = await retrieveEvidence({
      userId: request.user!.id,
      query: searchQuery,
      documentIds: input.documentIds,
      limit: 8,
    });
    const result = await answerWithEvidence(input.question, evidence, history);
    const saved = await db.query<{ id: string; created_at: Date }>(
      `INSERT INTO messages(
         thread_id, user_id, role, content, citations, verification
       ) VALUES ($1, $2, 'assistant', $3, $4::jsonb, $5::jsonb)
       RETURNING id, created_at`,
      [
        threadId,
        request.user!.id,
        result.answer,
        JSON.stringify(result.citations),
        JSON.stringify(result.verification),
      ],
    );
    await db.query("UPDATE threads SET updated_at = now() WHERE id = $1", [threadId]);

    return {
      threadId,
      searchQuery,
      rewritten,
      message: {
        id: saved.rows[0]!.id,
        content: result.answer,
        citations: result.citations,
        verification: result.verification,
        modelMode: result.modelMode,
        createdAt: saved.rows[0]!.created_at,
      },
    };
  });

  app.patch<{ Params: { threadId: string } }>(
    "/api/threads/:threadId",
    { preHandler: requireUser },
    async (request, reply) => {
      const { title } = renameSchema.parse(request.body);
      const result = await db.query(
        `UPDATE threads SET title = $1, updated_at = now()
         WHERE id = $2 AND user_id = $3 RETURNING id`,
        [title, request.params.threadId, request.user!.id],
      );
      if (!result.rowCount) {
        return reply.code(404).send({ error: "Thread not found." });
      }
      return { ok: true, title };
    },
  );

  app.delete<{ Params: { threadId: string } }>(
    "/api/threads/:threadId",
    { preHandler: requireUser },
    async (request, reply) => {
      const result = await db.query(
        "DELETE FROM threads WHERE id = $1 AND user_id = $2 RETURNING id",
        [request.params.threadId, request.user!.id],
      );
      if (!result.rowCount) {
        return reply.code(404).send({ error: "Thread not found." });
      }
      return reply.code(204).send();
    },
  );
}
