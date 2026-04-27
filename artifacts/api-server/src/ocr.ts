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
  customerSiret?: string;
  customerVatNumber?: string;
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
  iban?: string;
  bic?: string;
  suggestedCategory?: string;
  lineItems?: { description: string; quantity: number; unitPrice: number; total: number; vatRate?: number }[];
  rawText?: string;
  aiNotes?: string;
  warnings?: string[];
};

const STRUCTURED_PROMPT = `Tu es un expert-comptable français spécialisé dans la lecture de documents financiers (factures, tickets, devis, avoirs, notes de frais, relevés bancaires).

OBJECTIF
Lis le TEXTE EXTRAIT ci-dessous et renvoie UNIQUEMENT un objet JSON strict (pas de markdown, pas de commentaire), avec ces clés exactes (mets null si la donnée n'est pas trouvée).

RÈGLES MÉTIER
- Tous les montants sont en NOMBRES (pas de chaînes), virgule = point décimal, pas de séparateur de milliers, pas de symbole €.
- Dates au format ISO "YYYY-MM-DD". Si seul le mois est lisible, prends le 1er du mois.
- TVA française standard : 20%, intermédiaire : 10%, réduit : 5.5%, super-réduit : 2.1%. Déduis le taux quand il manque (taxAmount / totalNet * 100).
- SIRET = 14 chiffres. N° TVA intracommunautaire FR = "FR" + 2 chiffres + 9 chiffres SIREN.
- Vérifie la cohérence : totalAmount ≈ totalNet + taxAmount (tolérance 0.05 €). Si incohérent, corrige depuis les valeurs les plus fiables et liste l'incohérence dans "warnings".
- documentNature détermine le sens commercial :
   • "facture" = facture reçue d'un fournisseur (achat) ou émise (à un client) → si aucun customerName et un supplierName clair, c'est un achat
   • "ticket_de_caisse" = paiement immédiat en magasin
   • "avoir" = note de crédit (montants peuvent être négatifs)
   • "devis" = pas encore facturé, dueDate généralement absent
   • "note_de_frais" = remboursement employé
   • "releve_bancaire" = liste de transactions, pas un seul montant total
- Pour les tickets de caisse, supplierName = enseigne (ex "Carrefour", "Total Énergies", "McDonald's").
- suggestedCategory : choisis la mieux adaptée parmi la liste. Pour un ticket carburant → "Transport". Restaurant → "Restauration". Logiciel/SaaS → "Logiciels". Hôtel/train/avion → "Voyage". Achat informatique → "Bureau" ou "Infrastructure". Honoraires conseil → "Sous-traitance". Salaires/charges → "Personnel".
- lineItems : extrais chaque ligne du tableau si présent (description, quantité, prix unitaire HT, total HT, taux TVA si visible).
- Si plusieurs taux TVA coexistent, remplis taxDetails: [{rate, amount, base}, ...].
- iban, bic, paymentTerms : remplis si visibles dans le pied de page.

SCHÉMA JSON ATTENDU
{
  "documentNature": "facture" | "ticket_de_caisse" | "avoir" | "devis" | "note_de_frais" | "releve_bancaire" | "bon_de_commande" | "contrat" | "bulletin_de_paie" | "autre",
  "confidence": <nombre 0..1>,
  "supplierName": <string>, "supplierAddress": <string>, "supplierPhone": <string>, "supplierEmail": <string>, "supplierSiret": <string>, "supplierVatNumber": <string>,
  "customerName": <string>, "customerAddress": <string>, "customerSiret": <string>, "customerVatNumber": <string>,
  "invoiceNumber": <string>, "orderNumber": <string>,
  "date": "YYYY-MM-DD", "dueDate": "YYYY-MM-DD",
  "totalNet": <number>, "taxAmount": <number>, "totalAmount": <number>, "taxRate": <number>,
  "taxDetails": [{"rate": <number>, "amount": <number>, "base": <number>}],
  "currency": "EUR" | "USD" | "GBP" | ...,
  "paymentMethod": "carte" | "espèces" | "virement" | "chèque" | "prélèvement" | "PayPal" | "Stripe",
  "paymentTerms": <string>,
  "iban": <string>, "bic": <string>,
  "suggestedCategory": "Infrastructure" | "Voyage" | "Logiciels" | "Bureau" | "Marketing" | "Personnel" | "Sous-traitance" | "Fournisseurs" | "Restauration" | "Transport" | "Énergie" | "Loyer" | "Télécom" | "Assurance" | "Autre",
  "lineItems": [{"description": <string>, "quantity": <number>, "unitPrice": <number>, "total": <number>, "vatRate": <number>}],
  "warnings": [<string>],
  "aiNotes": <string>
}

Réponds avec le JSON UNIQUEMENT.`;

const VALIDATION_PROMPT = `Tu viens d'extraire un document. Voici ta première analyse JSON, puis le texte brut.
Vérifie :
1. Cohérence numérique : totalAmount = totalNet + taxAmount (tolérance 0.05 €) ?
2. taxRate déductible : taxAmount / totalNet * 100 doit donner ~5.5, ~10 ou ~20 ?
3. lineItems : la somme des "total" doit correspondre à totalNet ?
4. supplierName et invoiceNumber présents si documentNature = facture ?
5. Date au bon format ISO ?

Renvoie un JSON corrigé COMPLET avec les mêmes clés. Corrige les valeurs incohérentes en te basant sur le texte brut. Ajoute dans "warnings" tout problème non corrigeable. JSON UNIQUEMENT.`;

let aiInstance: GoogleGenAI | null = null;

function getAI(): GoogleGenAI | null {
  if (aiInstance) return aiInstance;

  // Préférence : clé Google directe (plus fiable). Sinon, proxy Replit AI Integrations.
  const directKey = process.env.GOOGLE_API_KEY;
  if (directKey) {
    aiInstance = new GoogleGenAI({ apiKey: directKey });
    return aiInstance;
  }

  const integrationKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
  if (!integrationKey) return null;

  const config: ConstructorParameters<typeof GoogleGenAI>[0] = { apiKey: integrationKey };
  if (process.env.AI_INTEGRATIONS_GEMINI_BASE_URL) {
    (config as Record<string, unknown>).httpOptions = {
      apiVersion: "",
      baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
    };
  }
  aiInstance = new GoogleGenAI(config);
  return aiInstance;
}

export function getModel(): string {
  // Avec la clé Google directe : gemini-2.0-flash. Avec le proxy : gemini-2.5-flash.
  if (process.env.GOOGLE_API_KEY) return "gemini-2.0-flash";
  return process.env.AI_INTEGRATIONS_GEMINI_BASE_URL ? "gemini-2.5-flash" : "gemini-2.0-flash";
}

const toNum = (v: unknown): number | undefined => {
  if (typeof v === "number" && !isNaN(v)) return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/[€$£\s]/g, "").replace(",", ".");
    const n = parseFloat(cleaned);
    if (!isNaN(n)) return n;
  }
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
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new OcrError("Document non reconnu ou illisible. Réessayez avec un fichier plus net.", 422);
    }
    try {
      parsed = JSON.parse(match[0]) as Record<string, unknown>;
    } catch {
      throw new OcrError("Document non reconnu ou illisible. Réessayez avec un fichier plus net.", 422);
    }
  }

  const str = (key: string): string | undefined => {
    const v = parsed[key];
    return typeof v === "string" && v ? v : undefined;
  };

  const docNature = str("documentNature") ?? "autre";
  const type = NATURE_MAP[docNature] || docNature;

  const warnings = Array.isArray(parsed.warnings)
    ? (parsed.warnings as unknown[]).filter((w): w is string => typeof w === "string")
    : undefined;

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
    customerSiret: str("customerSiret"),
    customerVatNumber: str("customerVatNumber"),
    invoiceNumber: str("invoiceNumber"),
    orderNumber: str("orderNumber"),
    date: str("date"),
    dueDate: str("dueDate"),
    totalAmount: toNum(parsed.totalAmount),
    totalNet: toNum(parsed.totalNet),
    taxAmount: toNum(parsed.taxAmount),
    taxRate: toNum(parsed.taxRate),
    taxDetails: Array.isArray(parsed.taxDetails)
      ? (parsed.taxDetails as Record<string, unknown>[]).map((t) => ({
          rate: toNum(t.rate) ?? 0,
          amount: toNum(t.amount) ?? 0,
          base: toNum(t.base) ?? 0,
        }))
      : undefined,
    currency: str("currency") ?? "EUR",
    paymentMethod: str("paymentMethod"),
    paymentTerms: str("paymentTerms"),
    iban: str("iban"),
    bic: str("bic"),
    suggestedCategory: str("suggestedCategory"),
    lineItems: Array.isArray(parsed.lineItems)
      ? (parsed.lineItems as Record<string, unknown>[]).map((li) => ({
          description: (typeof li.description === "string" ? li.description : "") || "",
          quantity: toNum(li.quantity) ?? 1,
          unitPrice: toNum(li.unitPrice) ?? 0,
          total: toNum(li.total) ?? 0,
          vatRate: toNum(li.vatRate),
        }))
      : undefined,
    aiNotes: str("aiNotes"),
    warnings,
  };
}

/**
 * Math reconciliation: fill in missing totals/tax amounts from the others.
 * Adds warnings if numbers don't add up.
 */
function reconcileTotals(r: OcrResult): void {
  const w = r.warnings ?? [];
  const TOL = 0.05;

  // If only totalAmount + taxAmount → derive totalNet
  if (r.totalAmount != null && r.taxAmount != null && r.totalNet == null) {
    r.totalNet = +(r.totalAmount - r.taxAmount).toFixed(2);
  }
  // If only totalNet + taxAmount → derive totalAmount
  if (r.totalNet != null && r.taxAmount != null && r.totalAmount == null) {
    r.totalAmount = +(r.totalNet + r.taxAmount).toFixed(2);
  }
  // If totalAmount + taxRate → derive totalNet & taxAmount
  if (r.totalAmount != null && r.taxRate != null && (r.totalNet == null || r.taxAmount == null)) {
    const net = r.totalAmount / (1 + r.taxRate / 100);
    r.totalNet ??= +net.toFixed(2);
    r.taxAmount ??= +(r.totalAmount - net).toFixed(2);
  }
  // If totalNet + taxRate → derive taxAmount + totalAmount
  if (r.totalNet != null && r.taxRate != null && r.taxAmount == null) {
    r.taxAmount = +(r.totalNet * r.taxRate / 100).toFixed(2);
    r.totalAmount ??= +(r.totalNet + r.taxAmount).toFixed(2);
  }
  // Derive taxRate when totalNet+taxAmount known
  if (r.taxRate == null && r.totalNet != null && r.taxAmount != null && r.totalNet > 0) {
    const rate = (r.taxAmount / r.totalNet) * 100;
    // Snap to common French TVA rates
    const snapped = [2.1, 5.5, 10, 20].find((s) => Math.abs(s - rate) < 0.5);
    r.taxRate = snapped ?? +rate.toFixed(2);
  }

  // Coherence check
  if (r.totalAmount != null && r.totalNet != null && r.taxAmount != null) {
    const diff = Math.abs(r.totalAmount - (r.totalNet + r.taxAmount));
    if (diff > TOL) {
      w.push(`Incohérence : totalAmount (${r.totalAmount}) ≠ totalNet + taxAmount (${(r.totalNet + r.taxAmount).toFixed(2)})`);
    }
  }

  // Line-items sum check
  if (r.lineItems && r.lineItems.length > 0 && r.totalNet != null) {
    const sum = r.lineItems.reduce((s, li) => s + (li.total || 0), 0);
    if (sum > 0 && Math.abs(sum - r.totalNet) > Math.max(TOL, r.totalNet * 0.02)) {
      w.push(`La somme des lignes (${sum.toFixed(2)}) ne correspond pas au totalNet (${r.totalNet})`);
    }
  }

  if (w.length) r.warnings = w;
}

function needsRefinement(r: OcrResult): boolean {
  if ((r.confidence ?? 0) < 0.7) return true;
  if (r.warnings && r.warnings.length > 0) return true;
  if (r.documentNature === "facture" && (!r.supplierName || !r.totalAmount)) return true;
  if (r.documentNature === "ticket_de_caisse" && !r.totalAmount) return true;
  return false;
}

async function callGemini(
  ai: GoogleGenAI,
  parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>,
  timeoutMs: number,
): Promise<string> {
  const result = await Promise.race([
    ai.models.generateContent({
      model: getModel(),
      contents: [{ role: "user", parts }],
      config: { temperature: 0.1, maxOutputTokens: 4096, responseMimeType: "application/json" },
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new OcrError("L'analyse a pris trop de temps. Réessayez.", 408)), timeoutMs),
    ),
  ]);
  return result.text ?? "";
}

export async function analyzeDocument(fileBuffer: Buffer, filename: string, _docType: string): Promise<OcrResult> {
  const ai = getAI();
  if (!ai) {
    throw new OcrError(
      "Service OCR non disponible. Configurez AI_INTEGRATIONS_GEMINI_API_KEY ou GOOGLE_API_KEY.",
      503,
    );
  }

  const sizeKB = (fileBuffer.length / 1024).toFixed(1);
  console.log(`[OCR] Démarrage: ${filename} (${sizeKB} KB)`);
  const startTime = Date.now();

  try {
    // STEP 1 — text extraction (vision pass)
    const processorResult = await processFileForOCR(fileBuffer, filename, ai);
    if (!processorResult.rawText || processorResult.rawText.length < 10) {
      throw new OcrError("Document non reconnu ou illisible. Réessayez avec un fichier plus net.", 422);
    }

    // STEP 2 — first structured extraction
    const firstText = await callGemini(
      ai,
      [
        { text: STRUCTURED_PROMPT },
        { text: `\n\nTEXTE EXTRAIT DU DOCUMENT:\n${processorResult.rawText}` },
      ],
      18000,
    );
    if (!firstText) throw new OcrError("L'IA n'a pas pu structurer les données.", 422);

    let result = parseGeminiResponse(firstText);
    reconcileTotals(result);

    // STEP 3 — refinement pass if confidence low or warnings present
    if (needsRefinement(result)) {
      console.log(`[OCR] Refinement pass (confidence=${result.confidence}, warnings=${result.warnings?.length ?? 0})`);
      try {
        const secondText = await callGemini(
          ai,
          [
            { text: VALIDATION_PROMPT },
            { text: `\n\nPREMIÈRE ANALYSE (à corriger):\n${JSON.stringify(result, null, 2)}` },
            { text: `\n\nTEXTE BRUT DU DOCUMENT:\n${processorResult.rawText}` },
          ],
          12000,
        );
        if (secondText) {
          const refined = parseGeminiResponse(secondText);
          reconcileTotals(refined);
          // Keep refined only if it improved (more fields filled or fewer warnings)
          const filledNew = countFilled(refined);
          const filledOld = countFilled(result);
          if (filledNew >= filledOld) result = refined;
        }
      } catch (refErr) {
        console.warn(`[OCR] Refinement skipped: ${refErr instanceof Error ? refErr.message : "unknown"}`);
      }
    }

    result.rawText = processorResult.rawText;
    result.confidence = Math.max(result.confidence ?? 0.5, processorResult.confidence);

    const elapsed = Date.now() - startTime;
    console.log(
      `[OCR] Complété en ${elapsed}ms: type=${result.type}, confiance=${result.confidence}, total=${result.totalAmount ?? "?"}`,
    );

    return result;
  } catch (err: unknown) {
    if (err instanceof OcrError) throw err;
    console.error("[OCR] Erreur:", err);
    throw new OcrError("Erreur lors de l'analyse du document.", 500);
  }
}

function countFilled(r: OcrResult): number {
  let c = 0;
  for (const k of [
    "supplierName", "invoiceNumber", "date", "dueDate", "totalAmount", "totalNet",
    "taxAmount", "taxRate", "supplierSiret", "supplierVatNumber", "paymentMethod",
  ] as const) {
    if (r[k] != null && r[k] !== "") c++;
  }
  if (r.lineItems && r.lineItems.length > 0) c += Math.min(5, r.lineItems.length);
  return c;
}
