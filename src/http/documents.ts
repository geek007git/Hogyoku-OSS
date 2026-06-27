import { randomUUID } from "node:crypto";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { ingestionQueue } from "../lib/queue.js";
import { uploadObject } from "../lib/storage.js";
import { requireUser } from "./auth.js";

const allowedTypes = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
]);

export async function registerDocumentRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/documents", { preHandler: requireUser }, async (request) => {
    const result = await db.query(
      `SELECT d.id, d.filename, d.title, d.mime_type AS "mimeType",
              d.byte_size AS "byteSize", d.page_count AS "pageCount",
              d.status, d.error_message AS "errorMessage", d.created_at AS "createdAt",
              count(c.id)::int AS "chunkCount"
       FROM documents d
       LEFT JOIN chunks c ON c.document_id = d.id
       WHERE d.user_id = $1
       GROUP BY d.id
       ORDER BY d.created_at DESC`,
      [request.user!.id],
    );
    return { documents: result.rows };
  });

  app.post("/api/documents", { preHandler: requireUser }, async (request, reply) => {
    const part = await request.file({
      limits: { fileSize: config.MAX_UPLOAD_MB * 1024 * 1024, files: 1 },
    });
    if (!part) return reply.code(400).send({ error: "A file is required." });
    if (!allowedTypes.has(part.mimetype)) {
      return reply.code(415).send({ error: `Unsupported file type: ${part.mimetype}` });
    }

    const buffer = await part.toBuffer();
    if (!buffer.length) return reply.code(400).send({ error: "The file is empty." });

    const documentId = randomUUID();
    const safeName = path.basename(part.filename).replace(/[^\w.-]+/g, "_").slice(0, 180);
    const storageKey = `${request.user!.id}/${documentId}/${safeName}`;
    const title = path.parse(safeName).name || "Untitled document";
    await uploadObject(storageKey, buffer, part.mimetype);
    await db.query(
      `INSERT INTO documents (
         id, user_id, filename, title, mime_type, byte_size, storage_key
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        documentId,
        request.user!.id,
        safeName,
        title,
        part.mimetype,
        buffer.length,
        storageKey,
      ],
    );
    await ingestionQueue.add(
      "ingest",
      { documentId, userId: request.user!.id },
      { jobId: documentId },
    );
    return reply.code(202).send({
      document: {
        id: documentId,
        filename: safeName,
        title,
        mimeType: part.mimetype,
        byteSize: buffer.length,
        pageCount: null,
        chunkCount: 0,
        status: "queued",
      },
    });
  });

  app.delete<{ Params: { documentId: string } }>(
    "/api/documents/:documentId",
    { preHandler: requireUser },
    async (request, reply) => {
      const result = await db.query(
        "DELETE FROM documents WHERE id = $1 AND user_id = $2 RETURNING id",
        [request.params.documentId, request.user!.id],
      );
      if (!result.rowCount) return reply.code(404).send({ error: "Document not found." });
      return reply.code(204).send();
    },
  );
}
