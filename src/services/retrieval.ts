import { db } from "../db/client.js";
import { embedTexts } from "./ai.js";

export interface Evidence {
  id: string;
  documentId: string;
  documentTitle: string;
  filename: string;
  pageNumber: number | null;
  kind: string;
  content: string;
  score: number;
}

export async function retrieveEvidence(input: {
  userId: string;
  query: string;
  documentIds?: string[];
  limit?: number;
}): Promise<Evidence[]> {
  const [embedding] = await embedTexts([input.query]);
  if (!embedding) return [];
  const limit = Math.min(Math.max(input.limit ?? 8, 1), 20);
  const documentIds = input.documentIds?.length ? input.documentIds : null;

  const result = await db.query<{
    id: string;
    document_id: string;
    title: string;
    filename: string;
    page_number: number | null;
    kind: string;
    content: string;
    score: number;
  }>(
    `WITH ranked AS (
       SELECT
         c.id,
         c.document_id,
         d.title,
         d.filename,
         c.page_number,
         c.kind,
         c.content,
         row_number() OVER (
           ORDER BY c.embedding <=> $2::vector
         ) AS semantic_rank,
         row_number() OVER (
           ORDER BY ts_rank_cd(c.search_vector, websearch_to_tsquery('english', $3)) DESC
         ) AS lexical_rank,
         ts_rank_cd(c.search_vector, websearch_to_tsquery('english', $3)) AS lexical_score
       FROM chunks c
       JOIN documents d ON d.id = c.document_id
       WHERE c.user_id = $1
         AND d.status = 'ready'
         AND ($4::uuid[] IS NULL OR c.document_id = ANY($4::uuid[]))
     )
     SELECT *,
       (
         1.0 / (60 + semantic_rank) +
         CASE WHEN lexical_score > 0 THEN 1.0 / (60 + lexical_rank) ELSE 0 END
       )::float AS score
     FROM ranked
     ORDER BY score DESC
     LIMIT $5`,
    [
      input.userId,
      `[${embedding.join(",")}]`,
      input.query,
      documentIds,
      limit,
    ],
  );

  return result.rows.map((row) => ({
    id: row.id,
    documentId: row.document_id,
    documentTitle: row.title,
    filename: row.filename,
    pageNumber: row.page_number,
    kind: row.kind,
    content: row.content,
    score: Number(row.score),
  }));
}
