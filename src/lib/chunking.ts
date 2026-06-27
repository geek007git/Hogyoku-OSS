export interface ExtractedPage {
  pageNumber: number;
  text: string;
  kind?: string;
  metadata?: Record<string, unknown>;
}

export interface ContentChunk {
  pageNumber: number;
  ordinal: number;
  kind: string;
  content: string;
  metadata: Record<string, unknown>;
}

const TARGET_SIZE = 1_200;
const OVERLAP_SENTENCES = 2;

export function chunkPages(pages: ExtractedPage[]): ContentChunk[] {
  const chunks: ContentChunk[] = [];
  let ordinal = 0;

  for (const page of pages) {
    const normalized = page.text.replace(/\s+/g, " ").trim();
    if (!normalized) continue;
    const sentences =
      normalized.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((item) => item.trim()) ??
      [normalized];
    let current: string[] = [];

    for (const sentence of sentences) {
      const candidate = [...current, sentence].join(" ");
      if (candidate.length > TARGET_SIZE && current.length) {
        chunks.push({
          pageNumber: page.pageNumber,
          ordinal: ordinal++,
          kind: page.kind ?? "text",
          content: current.join(" "),
          metadata: page.metadata ?? {},
        });
        current = [...current.slice(-OVERLAP_SENTENCES), sentence];
      } else {
        current.push(sentence);
      }
    }

    if (current.length) {
      chunks.push({
        pageNumber: page.pageNumber,
        ordinal: ordinal++,
        kind: page.kind ?? "text",
        content: current.join(" "),
        metadata: page.metadata ?? {},
      });
    }
  }

  return chunks;
}
