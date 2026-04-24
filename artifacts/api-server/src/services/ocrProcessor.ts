import { fileTypeFromBuffer } from "file-type";
import { GoogleGenAI } from "@google/genai";
import path from "path";

export type OcrProcessorResult = {
  rawText: string;
  confidence: number;
  tables?: Array<{ headers: string[]; rows: string[][] }>;
};

const SUPPORTED_TYPES = new Set(["jpg", "jpeg", "png", "webp", "heic", "pdf", "tiff"]);

// Lazy-load sharp — it may not be built in all environments
let sharpLib: typeof import("sharp") | null = null;
async function getSharp() {
  if (sharpLib) return sharpLib;
  try {
    sharpLib = (await import("sharp")).default as unknown as typeof import("sharp");
    return sharpLib;
  } catch {
    console.warn("[OCR] sharp not available — sending original image to Gemini");
    return null;
  }
}

export async function detectFileType(buffer: Buffer, filename: string): Promise<string> {
  const ext = path.extname(filename).slice(1).toLowerCase();
  if (SUPPORTED_TYPES.has(ext)) return ext;
  const detected = await fileTypeFromBuffer(buffer);
  if (detected && SUPPORTED_TYPES.has(detected.ext)) return detected.ext;
  return "pdf";
}

export async function optimizeImage(buffer: Buffer, _fileType: string): Promise<Buffer> {
  const sharp = await getSharp();
  if (!sharp) return buffer; // fall back to raw buffer

  const MAX_PX = 2000;
  const MAX_BYTES = 5 * 1024 * 1024;

  let pipeline = sharp(buffer);
  const meta = await pipeline.metadata();
  const { width = 1000, height = 1000 } = meta;

  if (width > MAX_PX || height > MAX_PX) {
    pipeline = pipeline.resize(MAX_PX, MAX_PX, { fit: "inside", withoutEnlargement: true });
  }
  pipeline = pipeline.normalize();
  let optimized = await pipeline.png({ compressionLevel: 6 }).toBuffer();

  if (optimized.length > MAX_BYTES) {
    optimized = await sharp(optimized)
      .resize(1500, 1500, { fit: "inside", withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toBuffer();
  }
  return optimized;
}

export async function preparePdf(buffer: Buffer): Promise<Buffer> {
  return buffer;
}

export function detectTable(text: string): Array<{ headers: string[]; rows: string[][] }> {
  const tables: Array<{ headers: string[]; rows: string[][] }> = [];
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  let currentRows: string[][] = [];
  let lastDelimiter = "";

  for (const line of lines) {
    const tabMatch = line.split("\t").length >= 2;
    const pipeMatch = /\|/.test(line) && line.split("|").filter(s => s.trim()).length >= 2;
    const commaMatch = /,/.test(line) && line.split(",").length >= 3;
    const delimiter = tabMatch ? "\t" : pipeMatch ? "|" : commaMatch ? "," : "";

    if (delimiter) {
      if (lastDelimiter && delimiter !== lastDelimiter && currentRows.length > 1) {
        tables.push({ headers: currentRows[0], rows: currentRows.slice(1) });
        currentRows = [];
      }
      const cells = line.split(delimiter).map(c => c.trim()).filter(Boolean);
      if (cells.length >= 2) { currentRows.push(cells); lastDelimiter = delimiter; }
    } else if (currentRows.length > 1) {
      tables.push({ headers: currentRows[0], rows: currentRows.slice(1) });
      currentRows = [];
      lastDelimiter = "";
    }
  }
  if (currentRows.length > 1) tables.push({ headers: currentRows[0], rows: currentRows.slice(1) });
  return tables;
}

export async function processFileForOCR(
  fileBuffer: Buffer,
  filename: string,
  aiInstance: GoogleGenAI
): Promise<OcrProcessorResult> {
  const startTime = Date.now();
  console.log(`[OCR Processor] Start: ${filename} (${(fileBuffer.length / 1024).toFixed(1)} KB)`);

  try {
    const fileType = await detectFileType(fileBuffer, filename);
    let processedBuffer: Buffer;
    let mimeType: string;

    if (fileType === "pdf") {
      processedBuffer = await preparePdf(fileBuffer);
      mimeType = "application/pdf";
    } else {
      processedBuffer = await optimizeImage(fileBuffer, fileType);
      mimeType = "image/png";
      const origKB = (fileBuffer.length / 1024).toFixed(1);
      const newKB = (processedBuffer.length / 1024).toFixed(1);
      console.log(`[OCR Processor] Image: ${origKB}KB → ${newKB}KB`);
    }

    const model = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL
      ? "gemini-2.5-flash"
      : "gemini-2.0-flash";

    const EXTRACTION_PROMPT = `Extrais TOUT le texte visible de ce document de façon exhaustive.
Inclus: numéros, montants, dates, noms, adresses, tableaux, références.
Conserve la structure du document (lignes, colonnes).
Retourne uniquement le texte extrait, sans commentaires.`;

    const timeoutMs = fileType === "pdf" ? 45000 : 20000;

    const textResponse = await Promise.race([
      aiInstance.models.generateContent({
        model,
        contents: [{ role: "user", parts: [
          { text: EXTRACTION_PROMPT },
          { inlineData: { mimeType, data: processedBuffer.toString("base64") } },
        ]}],
        config: { temperature: 0, maxOutputTokens: 8192 },
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout (${timeoutMs / 1000}s)`)), timeoutMs)
      ),
    ]);

    const rawText = textResponse.text?.trim() ?? "";

    if (!rawText || rawText.length < 10) {
      const sharp = await getSharp();
      if (fileType !== "pdf" && sharp) {
        const enhanced = await sharp(processedBuffer)
          .modulate({ brightness: 1.2 }).normalize().png({ compressionLevel: 6 }).toBuffer();
        const retryResponse = await Promise.race([
          aiInstance.models.generateContent({
            model,
            contents: [{ role: "user", parts: [
              { text: EXTRACTION_PROMPT },
              { inlineData: { mimeType: "image/png", data: enhanced.toString("base64") } },
            ]}],
            config: { temperature: 0, maxOutputTokens: 4096 },
          }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout retry")), 20000)),
        ]);
        const retryText = retryResponse.text?.trim() ?? "";
        if (retryText.length >= 10) {
          const tables = detectTable(retryText);
          return { rawText: retryText, confidence: 0.6, tables: tables.length > 0 ? tables : undefined };
        }
      }
      return { rawText: rawText || "", confidence: 0.1 };
    }

    const tables = detectTable(rawText);
    const elapsed = Date.now() - startTime;
    console.log(`[OCR Processor] Done in ${elapsed}ms`);
    return { rawText, confidence: 0.8, tables: tables.length > 0 ? tables : undefined };

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[OCR Processor] Error: ${msg}`);
    return { rawText: "", confidence: 0 };
  }
}
