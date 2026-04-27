import { fileTypeFromBuffer } from "file-type";
import { GoogleGenAI } from "@google/genai";
import path from "path";

export type OcrProcessorResult = {
  rawText: string;
  confidence: number;
  tables?: Array<{ headers: string[]; rows: string[][] }>;
};

// Image/PDF types handled by Gemini Vision
const VISION_TYPES = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif", "pdf", "tiff", "tif", "gif", "bmp"]);
// Text-based types — read directly without OCR
const TEXT_TYPES = new Set(["txt", "csv", "tsv", "log", "md", "json", "xml", "html", "rtf"]);

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
  if (VISION_TYPES.has(ext) || TEXT_TYPES.has(ext)) return ext;
  const detected = await fileTypeFromBuffer(buffer);
  if (detected && (VISION_TYPES.has(detected.ext) || TEXT_TYPES.has(detected.ext))) return detected.ext;
  // Try to detect text content (plain ASCII/UTF-8 with no binary chars)
  const sample = buffer.subarray(0, Math.min(buffer.length, 4096)).toString("utf-8");
  const printableRatio = (sample.match(/[\x09\x0A\x0D\x20-\x7E\u00A0-\uFFFF]/g)?.length ?? 0) / Math.max(sample.length, 1);
  if (printableRatio > 0.95) return "txt";
  return "pdf"; // default to PDF (Gemini will try)
}

export async function optimizeImage(buffer: Buffer, _fileType: string): Promise<Buffer> {
  const sharp = await getSharp();
  if (!sharp) return buffer;

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
    const semicolonMatch = /;/.test(line) && line.split(";").length >= 2;
    const commaMatch = /,/.test(line) && line.split(",").length >= 3;
    const delimiter = tabMatch ? "\t" : pipeMatch ? "|" : semicolonMatch ? ";" : commaMatch ? "," : "";

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

    // Direct text passthrough (CSV, TXT, JSON, etc.) — no OCR needed
    if (TEXT_TYPES.has(fileType)) {
      const rawText = fileBuffer.toString("utf-8").trim();
      const tables = detectTable(rawText);
      console.log(`[OCR Processor] Text passthrough done in ${Date.now() - startTime}ms (${rawText.length} chars)`);
      return { rawText, confidence: 1.0, tables: tables.length > 0 ? tables : undefined };
    }

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

    const EXTRACTION_PROMPT = `Tu es un OCR expert. Extrais TOUT le texte visible dans ce document, exhaustivement, en préservant la mise en page.

INSTRUCTIONS:
- Inclus chaque chiffre, montant, date, nom, adresse, référence, code, IBAN, SIRET.
- Pour les TABLEAUX (factures, relevés bancaires, listes): conserve les colonnes alignées en utilisant des tabulations entre cellules, une ligne par enregistrement. Garde l'en-tête en première ligne.
- Pour les RELEVÉS BANCAIRES: extrais chaque transaction sur une ligne avec format: DATE<tab>LIBELLÉ<tab>DÉBIT<tab>CRÉDIT (ou DATE<tab>LIBELLÉ<tab>MONTANT si une seule colonne montant).
- Conserve les sauts de ligne entre sections. N'invente rien. Si du texte est illisible, mets [...] à sa place.
- Réponds UNIQUEMENT avec le texte extrait — aucun commentaire, aucun markdown, aucune analyse.`;

    const timeoutMs = fileType === "pdf" ? 60000 : 25000;

    const textResponse = await Promise.race([
      aiInstance.models.generateContent({
        model,
        contents: [{ role: "user", parts: [
          { text: EXTRACTION_PROMPT },
          { inlineData: { mimeType, data: processedBuffer.toString("base64") } },
        ]}],
        config: { temperature: 0, maxOutputTokens: 16384 },
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
          .modulate({ brightness: 1.2 }).normalize().sharpen().png({ compressionLevel: 6 }).toBuffer();
        const retryResponse = await Promise.race([
          aiInstance.models.generateContent({
            model,
            contents: [{ role: "user", parts: [
              { text: EXTRACTION_PROMPT },
              { inlineData: { mimeType: "image/png", data: enhanced.toString("base64") } },
            ]}],
            config: { temperature: 0, maxOutputTokens: 8192 },
          }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout retry")), 25000)),
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
    console.log(`[OCR Processor] Done in ${elapsed}ms (${rawText.length} chars, ${tables.length} tables)`);
    return { rawText, confidence: 0.85, tables: tables.length > 0 ? tables : undefined };

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[OCR Processor] Error: ${msg}`);
    return { rawText: "", confidence: 0 };
  }
}
