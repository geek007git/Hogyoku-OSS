import { db } from "../db/client.js";
import { chunkPages } from "../lib/chunking.js";
import { downloadObject } from "../lib/storage.js";
import { embedTexts } from "./ai.js";
import { extractDocument } from "./extraction.js";

interface DocumentRow {
  id: string;
  user_id: string;
  filename: string;
  mime_type: string;
  storage_key: string;
}

export async function ingestDocument(
  documentId: string,
  userId: string,
): Promise<void> {
  const result = await db.query<DocumentRow>(
    `SELECT id, user_id, filename, mime_type, storage_key
     FROM documents WHERE id = $1 AND user_id = $2`,
    [documentId, userId],
  );
  const document = result.rows[0];
  if (!document) throw new Error("Document not found");

  await db.query(
    `UPDATE documents
     SET status = 'processing', error_message = NULL, updated_at = now()
     WHERE id = $1`,
    [documentId],
  );

  try {
    const buffer = await downloadObject(document.storage_key);
    const pages = await extractDocument(
      buffer,
      document.mime_type,
      document.filename,
    );
    const chunks = chunkPages(pages);
    if (!chunks.length) throw new Error("No extractable document content found");

    const embeddings: number[][] = [];
    for (let offset = 0; offset < chunks.length; offset += 32) {
      const batch = chunks.slice(offset, offset + 32);
      embeddings.push(...(await embedTexts(batch.map((chunk) => chunk.content))));
    }

    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM chunks WHERE document_id = $1", [documentId]);
      for (let index = 0; index < chunks.length; index += 1) {
        const chunk = chunks[index]!;
        const embedding = embeddings[index]!;
        await client.query(
          `INSERT INTO chunks (
             document_id, user_id, page_number, ordinal, kind,
             content, evidence_label, embedding, metadata
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector, $9::jsonb)`,
          [
            documentId,
            userId,
            chunk.pageNumber,
            chunk.ordinal,
            chunk.kind,
            chunk.content,
            `${document.filename}, page ${chunk.pageNumber}`,
            `[${embedding.join(",")}]`,
            JSON.stringify(chunk.metadata),
          ],
        );
      }
      await client.query(
        `UPDATE documents
         SET status = 'ready', page_count = $2, updated_at = now()
         WHERE id = $1`,
        [documentId, pages.length],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown ingestion error";
    await db.query(
      `UPDATE documents
       SET status = 'failed', error_message = $2, updated_at = now()
       WHERE id = $1`,
      [documentId, message.slice(0, 1_000)],
    );
    throw error;
  }
}
