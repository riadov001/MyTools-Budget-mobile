import { Blob } from "buffer";
import type { OcrResult } from "../ocr";

const MINDEE_KEY_1 = process.env.MINDEE_API_KEY_PROD ?? process.env.MINDEE_API_KEY ?? "";
const MINDEE_KEY_2 = process.env.MINDEE_API_KEY_PROD_2 ?? "";

export async function scanInvoiceWithMindee(fileBuffer: Buffer, filename: string): Promise<OcrResult> {
  console.log(`[Mindee OCR] Démarrage: ${filename} (${(fileBuffer.length / 1024).toFixed(1)} KB)`);
  const startTime = Date.now();

  if (!MINDEE_KEY_1 && !MINDEE_KEY_2) {
    throw new Error("Aucune clé API Mindee configurée (MINDEE_API_KEY_PROD, MINDEE_API_KEY, ou MINDEE_API_KEY_PROD_2 manquante)");
  }

  // Essai avec la clé principale
  if (MINDEE_KEY_1) {
    try {
      const result = await callMindeeApi(fileBuffer, filename, MINDEE_KEY_1);
      const elapsed = Date.now() - startTime;
      console.log(`[Mindee OCR] ✓ Clé principale OK en ${elapsed}ms, confiance=${result.confidence?.toFixed(2)}`);
      return result;
    } catch (err) {
      console.log(`[Mindee OCR] Clé principale échouée: ${err instanceof Error ? err.message : "erreur"} — essai clé secondaire`);
    }
  }

  // Fallback sur la clé secondaire
  if (MINDEE_KEY_2) {
    try {
      const result = await callMindeeApi(fileBuffer, filename, MINDEE_KEY_2);
      const elapsed = Date.now() - startTime;
      console.log(`[Mindee OCR] ✓ Clé secondaire OK en ${elapsed}ms, confiance=${result.confidence?.toFixed(2)}`);
      return result;
    } catch (err) {
      console.log(`[Mindee OCR] Clé secondaire échouée: ${err instanceof Error ? err.message : "erreur"}`);
    }
  }

  // Les deux clés ont échoué
  throw new Error("Mindee API: les deux clés ont échoué. Vérifiez vos credentials.");
}

async function callMindeeApi(fileBuffer: Buffer, filename: string, apiKey: string): Promise<OcrResult> {
  const form = new FormData();
  const blob = new Blob([fileBuffer], { type: guessMimeType(filename) });
  form.append("document", blob, filename);

  const MINDEE_API_URL = "https://api.mindee.com/v1/products/mindee/invoices/v4/predict";

  const response = await Promise.race([
    fetch(MINDEE_API_URL, {
      method: "POST",
      headers: { Authorization: `Token ${apiKey}` },
      body: form,
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), 30000)
    ),
  ]);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${response.status}: ${text.slice(0, 200)}`);
  }

  const data = (await response.json()) as MindeeResponse;
  const prediction = data.document?.inference?.prediction;

  if (!prediction) throw new Error("Aucune prédiction");

  return parseMindeeResponse(prediction);
}

function parseMindeeResponse(prediction: MindeePrediction): OcrResult {
  const supplierName = prediction.supplier_name?.value;
  const invoiceNumber = prediction.invoice_number?.value;
  const dateStr = prediction.date?.value;
  const dueDateStr = prediction.due_date?.value;
  const totalAmount = prediction.total_amount?.value ?? 0;
  const totalNet = prediction.total_net?.value ?? 0;
  const taxes = prediction.taxes ?? [];
  const taxAmount = taxes.reduce((sum, t) => sum + (t.value ?? 0), 0);
  const taxRate = taxes.length > 0 ? (taxes[0].rate ?? 0) / 100 : undefined;

  const confidences = [
    prediction.supplier_name?.confidence,
    prediction.invoice_number?.confidence,
    prediction.date?.confidence,
    prediction.total_amount?.confidence,
  ].filter((c): c is number => c !== undefined && c > 0);

  const avgConfidence = confidences.length > 0
    ? confidences.reduce((a, b) => a + b, 0) / confidences.length
    : 0.7;

  return {
    type: "invoice",
    documentNature: "facture",
    confidence: Math.min(avgConfidence, 1),
    supplierName: supplierName || undefined,
    invoiceNumber: invoiceNumber || undefined,
    date: dateStr || undefined,
    dueDate: dueDateStr || undefined,
    totalAmount: totalAmount,
    totalNet: totalNet,
    taxAmount: taxAmount > 0 ? taxAmount : undefined,
    taxRate,
    currency: "EUR",
    lineItems: prediction.line_items?.map((item) => ({
      description: item.description || "",
      quantity: item.quantity ?? 1,
      unitPrice: item.unit_price ?? 0,
      total: item.total_amount ?? 0,
    })) ?? [],
  };
}


function guessMimeType(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  const map: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
    webp: "image/webp", pdf: "application/pdf",
    tiff: "image/tiff", tif: "image/tiff",
  };
  return map[ext] ?? "application/octet-stream";
}

type MindeeField<T = string> = { value?: T; confidence?: number };
type MindeePrediction = {
  supplier_name?: MindeeField;
  invoice_number?: MindeeField;
  date?: MindeeField;
  due_date?: MindeeField;
  total_amount?: MindeeField<number>;
  total_net?: MindeeField<number>;
  taxes?: Array<{ rate?: number; value?: number; confidence?: number }>;
  line_items?: Array<{ description?: string; quantity?: number; unit_price?: number; total_amount?: number }>;
};
type MindeeResponse = {
  document?: { inference?: { prediction?: MindeePrediction } };
};
