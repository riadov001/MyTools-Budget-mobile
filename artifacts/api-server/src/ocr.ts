import { GoogleGenAI } from "@google/genai";
import { processFileForOCR } from "./services/ocrProcessor";

class OcrError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export type OcrResult = {
  type: string;
  documentNature?: string;
  confidence?: number;
  supplierName?: string;
  supplierAddress?: string;
  supplierPhone?: string;
  supplierEmail?: string;
  supplierSiret?: string;
  supplierVatNumber?: string;
  customerName?: string;
  customerAddress?: string;
  invoiceNumber?: string;
  orderNumber?: string;
  date?: string;
  dueDate?: string;
  totalAmount?: number;
  totalNet?: number;
  taxAmount?: number;
  taxRate?: number;
  taxDetails?: { rate: number; amount: number; base: number }[];
  currency?: string;
  paymentMethod?: string;
  paymentTerms?: string;
  suggestedCategory?: string;
  lineItems?: { description: string; quantity: number; unitPrice: number; total: number; vatRate?: number }[];
  rawText?: string;
  aiNotes?: string;
};

const GEMINI_PROMPT = `Extrais les données de ce document en JSON strict (pas de markdown).
{documentNature:"facture"|"ticket_de_caisse"|"avoir"|"devis"|"note_de_frais"|"autre",confidence:0-1,supplierName,supplierVatNumber,supplierSiret,invoiceNumber,date:"YYYY-MM-DD",dueDate:"YYYY-MM-DD",totalNet,taxAmount,totalAmount,taxRate,currency:"EUR",paymentMethod:"carte"|"espèces"|"virement"|"chèque"|"prélèvement",lineItems:[{description,quantity,unitPrice,total}],suggestedCategory:"Infrastructure"|"Voyage"|"Logiciels"|"Bureau"|"Marketing"|"Personnel"|"Sous-traitance"|"Fournisseurs"|"Restauration"|"Transport"|"Autre",aiNotes}
Champs absents=null. JSON uniquement.`;

let aiInstance: GoogleGenAI | null = null;

function getAI(): GoogleGenAI | null {
  if (aiInstance) return aiInstance;
  const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) return null;

  const config: ConstructorParameters<typeof GoogleGenAI>[0] = { apiKey };
  if (process.env.AI_INTEGRATIONS_GEMINI_BASE_URL) {
    (config as Record<string, unknown>).httpOptions = {
      apiVersion: "",
      baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
    };
  }
  aiInstance = new GoogleGenAI(config);
  return aiInstance;
}

function getModel(): string {
  return process.env.AI_INTEGRATIONS_GEMINI_BASE_URL ? "gemini-2.5-flash" : "gemini-2.0-flash";
}

const toNum = (v: unknown): number | undefined => {
  if (typeof v === "number" && !isNaN(v)) return v;
  if (typeof v === "string") { const n = parseFloat(v); if (!isNaN(n)) return n; }
  return undefined;
};

const NATURE_MAP: Record<string, string> = {
  facture: "invoice",
  ticket_de_caisse: "receipt",
  bon_de_commande: "purchase_order",
  avoir: "credit_note",
  devis: "quote",
  releve_bancaire: "bank_statement",
  note_de_frais: "expense_report",
  contrat: "contract",
  bulletin_de_paie: "payslip",
  autre: "other",
};

function parseGeminiResponse(text: string): OcrResult {
  const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    throw new OcrError("Document non reconnu ou illisible. Réessayez avec un fichier plus net.", 422);
  }

  const str = (key: string): string | undefined => {
    const v = parsed[key];
    return typeof v === "string" && v ? v : undefined;
  };

  const docNature = str("documentNature") ?? "autre";
  const type = NATURE_MAP[docNature] || docNature;

  return {
    type,
    documentNature: docNature,
    confidence: toNum(parsed.confidence) ?? 0.5,
    supplierName: str("supplierName"),
    supplierAddress: str("supplierAddress"),
    supplierPhone: str("supplierPhone"),
    supplierEmail: str("supplierEmail"),
    supplierSiret: str("supplierSiret"),
    supplierVatNumber: str("supplierVatNumber"),
    customerName: str("customerName"),
    customerAddress: str("customerAddress"),
    invoiceNumber: str("invoiceNumber"),
    orderNumber: str("orderNumber"),
    date: str("date"),
    dueDate: str("dueDate"),
    totalAmount: toNum(parsed.totalAmount),
    totalNet: toNum(parsed.totalNet),
    taxAmount: toNum(parsed.taxAmount),
    taxRate: toNum(parsed.taxRate),
    taxDetails: Array.isArray(parsed.taxDetails)
      ? parsed.taxDetails.map((t: Record<string, unknown>) => ({ rate: toNum(t.rate) ?? 0, amount: toNum(t.amount) ?? 0, base: toNum(t.base) ?? 0 }))
      : undefined,
    currency: str("currency") ?? "EUR",
    paymentMethod: str("paymentMethod"),
    paymentTerms: str("paymentTerms"),
    suggestedCategory: str("suggestedCategory"),
    lineItems: Array.isArray(parsed.lineItems)
      ? parsed.lineItems.map((li: Record<string, unknown>) => ({
          description: (typeof li.description === "string" ? li.description : "") || "",
          quantity: toNum(li.quantity) ?? 1,
          unitPrice: toNum(li.unitPrice) ?? 0,
          total: toNum(li.total) ?? 0,
          vatRate: toNum(li.vatRate),
        }))
      : undefined,
    aiNotes: str("aiNotes"),
  };
}

export async function analyzeDocument(fileBuffer: Buffer, filename: string, _docType: string): Promise<OcrResult> {
  const ai = getAI();
  if (!ai) {
    throw new OcrError("Service OCR non disponible. Configurez AI_INTEGRATIONS_GEMINI_API_KEY ou GOOGLE_API_KEY.", 503);
  }

  const sizeKB = (fileBuffer.length / 1024).toFixed(1);
  console.log(`[OCR] Démarrage: ${filename} (${sizeKB} KB)`);
  const startTime = Date.now();

  try {
    // Utiliser le nouveau pipeline OCR
    const processorResult = await processFileForOCR(fileBuffer, filename, ai);
    
    if (!processorResult.rawText || processorResult.rawText.length < 10) {
      throw new OcrError("Document non reconnu ou illisible. Réessayez avec un fichier plus net.", 422);
    }

    // Structurer les données extraites avec l'IA (timeout 15s)
    const geminiResult = await Promise.race([
      ai.models.generateContent({
        model: getModel(),
        contents: [{
          role: "user",
          parts: [
            { text: GEMINI_PROMPT },
            { text: `\n\nTEXTE EXTRAIT DU DOCUMENT:\n${processorResult.rawText}` },
          ],
        }],
        config: {
          temperature: 0.1,
          maxOutputTokens: 2048,
        },
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new OcrError("L'analyse a pris trop de temps. Réessayez.", 408)), 15000)
      ),
    ]);

    const text = geminiResult.text;
    if (!text) {
      throw new OcrError("L'IA n'a pas pu structurer les données.", 422);
    }

    const result = parseGeminiResponse(text);
    result.rawText = processorResult.rawText;
    result.confidence = Math.max(result.confidence ?? 0.5, processorResult.confidence);

    const elapsed = Date.now() - startTime;
    console.log(`[OCR] Complété en ${elapsed}ms: type=${result.type}, confiance=${result.confidence}`);

    return result;
  } catch (err: unknown) {
    if (err instanceof OcrError) throw err;
    console.error("[OCR] Erreur:", err);
    throw new OcrError("Erreur lors de l'analyse du document.", 500);
  }
}
