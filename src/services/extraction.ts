import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import sharp from "sharp";
import { createWorker } from "tesseract.js";
import type { ExtractedPage } from "../lib/chunking.js";
import { describeImage } from "./ai.js";

export async function extractDocument(
  buffer: Buffer,
  mimeType: string,
  filename: string,
): Promise<ExtractedPage[]> {
  if (mimeType === "application/pdf" || filename.toLowerCase().endsWith(".pdf")) {
    return extractPdf(buffer);
  }
  if (mimeType.startsWith("image/")) {
    return [await extractImage(buffer, mimeType, 1)];
  }
  if (
    mimeType.startsWith("text/") ||
    /\.(md|csv|json)$/i.test(filename)
  ) {
    return [{ pageNumber: 1, text: buffer.toString("utf8"), kind: "text" }];
  }
  throw new Error(`Unsupported document type: ${mimeType}`);
}

async function extractPdf(buffer: Buffer): Promise<ExtractedPage[]> {
  const pdf = await getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
  }).promise;
  const pages: ExtractedPage[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    pages.push({
      pageNumber,
      text: text || `[Page ${pageNumber} contains visual or scanned content requiring OCR.]`,
      kind: text.length > 80 ? "text" : "ocr",
    });
  }
  return pages;
}

async function extractImage(
  buffer: Buffer,
  mimeType: string,
  pageNumber: number,
): Promise<ExtractedPage> {
  const normalized = await sharp(buffer)
    .rotate()
    .resize({ width: 2200, withoutEnlargement: true })
    .grayscale()
    .normalize()
    .png()
    .toBuffer();
  const worker = await createWorker("eng");
  try {
    const ocr = await worker.recognize(normalized);
    const visualDescription = await describeImage(buffer, mimeType);
    return {
      pageNumber,
      kind: visualDescription ? "visual" : "ocr",
      text: [ocr.data.text.trim(), visualDescription].filter(Boolean).join("\n\n"),
      metadata: { ocrConfidence: ocr.data.confidence },
    };
  } finally {
    await worker.terminate();
  }
}
