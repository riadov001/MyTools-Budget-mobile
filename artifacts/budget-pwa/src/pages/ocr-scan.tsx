import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Upload, CheckCircle, AlertCircle, Loader2, ScanLine, X,
  Receipt, FileInput, FileCheck, FileMinus, ChevronLeft, Pencil,
} from "lucide-react";
import { getAuthToken, getActiveAppId, apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

type OcrResult = {
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
  customerEmail?: string;
  invoiceNumber?: string;
  date?: string;
  dueDate?: string;
  totalAmount?: number;
  totalNet?: number;
  taxAmount?: number;
  taxRate?: number;
  currency?: string;
  paymentMethod?: string;
  suggestedCategory?: string;
  lineItems?: Array<{ description: string; quantity: number; unitPrice: number; total: number }>;
  rawText?: string;
  aiNotes?: string;
};

type DocType = "expense" | "supplier_invoice" | "invoice" | "credit_note";

type EditForm = {
  docType: DocType;
  partyName: string;
  partyEmail: string;
  partyAddress: string;
  invoiceNumber: string;
  date: string;
  dueDate: string;
  totalNet: string;
  taxAmount: string;
  totalAmount: string;
  taxRate: string;
  category: string;
  notes: string;
};

const DOC_TYPES: { value: DocType; label: string; color: string; icon: React.ReactNode }[] = [
  { value: "expense",          label: "Dépense",       color: "bg-orange-600 hover:bg-orange-700 data-[active=true]:ring-2 data-[active=true]:ring-orange-400",  icon: <Receipt className="w-3.5 h-3.5" /> },
  { value: "supplier_invoice", label: "Fact. Fourn.",  color: "bg-blue-600 hover:bg-blue-700 data-[active=true]:ring-2 data-[active=true]:ring-blue-400",         icon: <FileInput className="w-3.5 h-3.5" /> },
  { value: "invoice",          label: "Fact. Client",  color: "bg-green-600 hover:bg-green-700 data-[active=true]:ring-2 data-[active=true]:ring-green-400",       icon: <FileCheck className="w-3.5 h-3.5" /> },
  { value: "credit_note",      label: "Avoir",         color: "bg-purple-600 hover:bg-purple-700 data-[active=true]:ring-2 data-[active=true]:ring-purple-400",    icon: <FileMinus className="w-3.5 h-3.5" /> },
];

const CATEGORIES = [
  "Infrastructure", "Voyage", "Logiciels", "Bureau", "Marketing",
  "Personnel", "Sous-traitance", "Fournisseurs", "Restauration", "Transport", "Autre",
];

async function uploadToOcr(file: File): Promise<OcrResult> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("type", "invoice");

  const headers: Record<string, string> = {};
  const token = getAuthToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const appId = getActiveAppId();
  if (appId) headers["X-App-Id"] = appId;

  const res = await fetch("/api/ocr/auto", {
    method: "POST",
    headers,
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    let msg: string;
    try { msg = (JSON.parse(text) as { message?: string }).message ?? text; }
    catch { msg = text; }
    throw new Error(msg || `Erreur ${res.status}`);
  }

  return res.json() as Promise<OcrResult>;
}

function ocrToForm(ocr: OcrResult, docType: DocType): EditForm {
  const isClientSide = docType === "invoice" || docType === "credit_note";
  const partyName = isClientSide
    ? (ocr.customerName ?? ocr.supplierName ?? "")
    : (ocr.supplierName ?? "");
  const partyEmail = isClientSide
    ? (ocr.customerEmail ?? "")
    : (ocr.supplierEmail ?? "");
  const partyAddress = isClientSide
    ? (ocr.customerAddress ?? "")
    : (ocr.supplierAddress ?? "");

  const ht  = ocr.totalNet    ?? 0;
  const tva = ocr.taxAmount   ?? 0;
  const ttc = (ocr.totalAmount ?? (ht + tva)) || 0;

  return {
    docType,
    partyName,
    partyEmail,
    partyAddress,
    invoiceNumber: ocr.invoiceNumber ?? "",
    date:          ocr.date     ? ocr.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
    dueDate:       ocr.dueDate  ? ocr.dueDate.slice(0, 10) : "",
    totalNet:      ht  > 0 ? ht.toFixed(2)  : "",
    taxAmount:     tva > 0 ? tva.toFixed(2) : "",
    totalAmount:   ttc > 0 ? ttc.toFixed(2) : "",
    taxRate:       ocr.taxRate != null ? (ocr.taxRate * 100).toFixed(0) : "20",
    category:      ocr.suggestedCategory ?? "Autre",
    notes:         ocr.aiNotes ?? "",
  };
}

function formToOcr(form: EditForm, orig: OcrResult): OcrResult {
  const isClientSide = form.docType === "invoice" || form.docType === "credit_note";
  return {
    ...orig,
    supplierName:  isClientSide ? orig.supplierName : (form.partyName || undefined),
    supplierEmail: isClientSide ? orig.supplierEmail : (form.partyEmail || undefined),
    supplierAddress: isClientSide ? orig.supplierAddress : (form.partyAddress || undefined),
    customerName:  isClientSide ? (form.partyName || undefined) : orig.customerName,
    customerEmail: isClientSide ? (form.partyEmail || undefined) : orig.customerEmail,
    customerAddress: isClientSide ? (form.partyAddress || undefined) : orig.customerAddress,
    invoiceNumber: form.invoiceNumber || undefined,
    date:          form.date || undefined,
    dueDate:       form.dueDate || undefined,
    totalNet:      form.totalNet    ? parseFloat(form.totalNet)    : undefined,
    taxAmount:     form.taxAmount   ? parseFloat(form.taxAmount)   : undefined,
    totalAmount:   form.totalAmount ? parseFloat(form.totalAmount) : undefined,
    taxRate:       form.taxRate     ? parseFloat(form.taxRate) / 100 : undefined,
    suggestedCategory: form.category || undefined,
    aiNotes:       form.notes || undefined,
  } as OcrResult;
}

export default function MindeeOcrPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [ocrResult, setOcrResult]     = useState<OcrResult | null>(null);
  const [form, setForm]               = useState<EditForm | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview]         = useState<string | null>(null);

  const setField = (key: keyof EditForm, value: string) => {
    setForm(prev => prev ? { ...prev, [key]: value } : prev);
  };

  const recalcTTC = (ht: string, tva: string) => {
    const htN  = parseFloat(ht)  || 0;
    const tvaN = parseFloat(tva) || 0;
    if (htN > 0 || tvaN > 0) setField("totalAmount", (htN + tvaN).toFixed(2));
  };

  useEffect(() => {
    if (form) recalcTTC(form.totalNet, form.taxAmount);
  }, [form?.totalNet, form?.taxAmount]);

  const handleDocTypeChange = (dt: DocType) => {
    if (!ocrResult || !form) return;
    const newForm = ocrToForm(ocrResult, dt);
    setForm({ ...newForm, notes: form.notes });
  };

  const scanMutation = useMutation({
    mutationFn: uploadToOcr,
    onSuccess: (data) => {
      setOcrResult(data);
      const guessedType: DocType =
        data.documentNature === "avoir"    ? "credit_note"      :
        data.documentNature === "facture"  ? "supplier_invoice" : "expense";
      setForm(ocrToForm(data, guessedType));
      toast({
        title: "Document analysé",
        description: `Confiance: ${((data.confidence ?? 0) * 100).toFixed(0)}%`,
      });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Erreur lors du scan", description: err.message });
    },
  });

  const createDocMutation = useMutation({
    mutationFn: async () => {
      if (!form || !ocrResult) throw new Error("Formulaire vide");
      const ocr = formToOcr(form, ocrResult);
      const res = await apiRequest("POST", "/api/ocr/create-document", {
        type: form.docType,
        ocr,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { message?: string }).message ?? `Erreur ${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Document créé avec succès ✓" });
      qc.invalidateQueries({ queryKey: ["/api/expenses"] });
      qc.invalidateQueries({ queryKey: ["/api/invoices"] });
      qc.invalidateQueries({ queryKey: ["/api/supplier-invoices"] });
      qc.invalidateQueries({ queryKey: ["/api/credit-notes"] });
      handleClear();
    },
    onError: (err: Error) => toast({ title: "Erreur", description: err.message, variant: "destructive" }),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ variant: "destructive", title: "Fichier trop volumineux", description: "Maximum 10 MB autorisé" });
      return;
    }
    setSelectedFile(file);
    setOcrResult(null);
    setForm(null);
    scanMutation.reset();
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  };

  const handleClear = () => {
    setSelectedFile(null);
    setPreview(null);
    setOcrResult(null);
    setForm(null);
    scanMutation.reset();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const dt = new DataTransfer();
    dt.items.add(file);
    if (fileInputRef.current) fileInputRef.current.files = dt.files;
    handleFileChange({ currentTarget: { files: dt.files } } as React.ChangeEvent<HTMLInputElement>);
  };

  const confidenceBadge = (c: number) =>
    c >= 0.85 ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
    : c >= 0.6 ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"
    : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";

  const partyLabel = form
    ? (form.docType === "invoice" || form.docType === "credit_note") ? "Client" : "Fournisseur"
    : "Fournisseur";

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-1">
            <ScanLine className="w-7 h-7 text-red-600" />
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Scan OCR</h1>
          </div>
          <p className="text-zinc-500 dark:text-zinc-400">
            Extraction intelligente de données de factures
          </p>
        </div>

        {/* Layout: upload zone + review form side by side when result available */}
        <div className={cn("gap-6", ocrResult ? "grid grid-cols-1 lg:grid-cols-5" : "")}>

          {/* ── Upload card ── */}
          <div className={cn(ocrResult ? "lg:col-span-2" : "w-full")}>
            <Card className="border-zinc-200 dark:border-zinc-800 h-full">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Upload className="w-4 h-4" />
                  {ocrResult ? "Document scanné" : "Déposer une facture"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div
                  data-testid="mindee-dropzone"
                  className={cn(
                    "relative border-2 border-dashed rounded-xl p-6 text-center transition-colors",
                    selectedFile
                      ? "border-zinc-300 dark:border-zinc-700"
                      : "border-zinc-300 dark:border-zinc-700 cursor-pointer hover:border-red-500 dark:hover:border-red-500"
                  )}
                  onClick={() => !selectedFile && fileInputRef.current?.click()}
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                >
                  <input
                    ref={fileInputRef}
                    data-testid="mindee-file-input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />

                  {selectedFile ? (
                    <div className="space-y-2">
                      {preview ? (
                        <img src={preview} alt="Aperçu" className="max-h-40 mx-auto rounded object-contain" />
                      ) : (
                        <div className="flex flex-col items-center gap-2 py-4">
                          <ScanLine className="w-10 h-10 text-zinc-400" />
                          <p className="text-sm font-medium text-zinc-500">Fichier PDF</p>
                        </div>
                      )}
                      <p className="font-medium text-sm text-zinc-900 dark:text-white truncate">{selectedFile.name}</p>
                      <p className="text-xs text-zinc-500">{(selectedFile.size / 1024).toFixed(0)} KB</p>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleClear(); }}
                        className="absolute top-2 right-2 text-zinc-400 hover:text-red-500"
                        data-testid="mindee-clear-btn"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="w-10 h-10 mx-auto text-zinc-400" />
                      <p className="font-medium text-zinc-700 dark:text-zinc-300 text-sm">
                        Cliquez ou glissez votre facture ici
                      </p>
                      <p className="text-xs text-zinc-400">JPG, PNG, WebP ou PDF — max 10 MB</p>
                    </div>
                  )}
                </div>

                {/* Scan button */}
                {selectedFile && !ocrResult && (
                  <Button
                    data-testid="mindee-scan-btn"
                    onClick={() => scanMutation.mutate(selectedFile)}
                    disabled={scanMutation.isPending}
                    className="w-full bg-red-600 hover:bg-red-700 text-white"
                  >
                    {scanMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analyse en cours…</>
                    ) : (
                      <><ScanLine className="w-4 h-4 mr-2" />Scanner la facture</>
                    )}
                  </Button>
                )}

                {/* Rescan */}
                {ocrResult && (
                  <Button
                    data-testid="mindee-reset-btn"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={handleClear}
                  >
                    <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                    Scanner un autre document
                  </Button>
                )}

                {/* Confidence */}
                {ocrResult && (
                  <div className={cn("text-xs font-semibold text-center px-2 py-1 rounded-full", confidenceBadge(ocrResult.confidence ?? 0))} data-testid="mindee-confidence">
                    <CheckCircle className="w-3 h-3 inline mr-1" />
                    Confiance {((ocrResult.confidence ?? 0) * 100).toFixed(0)}%
                    {ocrResult.aiNotes && <span className="ml-1 font-normal opacity-75">· {ocrResult.aiNotes}</span>}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Review / Edit form ── */}
          {ocrResult && form && (
            <div className="lg:col-span-3">
              <Card className="border-zinc-200 dark:border-zinc-800">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Pencil className="w-4 h-4 text-red-600" />
                    Vérifier et corriger les données
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">

                  {/* Type selector */}
                  <div>
                    <Label className="text-xs text-zinc-500 mb-2 block">Type de document</Label>
                    <div className="grid grid-cols-2 gap-2" data-testid="doc-type-selector">
                      {DOC_TYPES.map(dt => (
                        <button
                          key={dt.value}
                          data-testid={`doc-type-${dt.value}`}
                          data-active={form.docType === dt.value}
                          onClick={() => handleDocTypeChange(dt.value)}
                          className={cn(
                            "flex items-center gap-1.5 px-3 py-2 rounded-lg text-white text-sm font-medium transition-all",
                            dt.color,
                            form.docType !== dt.value && "opacity-50"
                          )}
                        >
                          {dt.icon}
                          {dt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Party info */}
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="ocr-party-name" className="text-xs text-zinc-500">{partyLabel}</Label>
                      <Input
                        id="ocr-party-name"
                        data-testid="ocr-party-name"
                        value={form.partyName}
                        onChange={(e) => setField("partyName", e.target.value)}
                        placeholder={`Nom du ${partyLabel.toLowerCase()}`}
                        className="mt-1"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="ocr-party-email" className="text-xs text-zinc-500">Email</Label>
                        <Input
                          id="ocr-party-email"
                          data-testid="ocr-party-email"
                          value={form.partyEmail}
                          onChange={(e) => setField("partyEmail", e.target.value)}
                          placeholder="email@exemple.com"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="ocr-invoice-number" className="text-xs text-zinc-500">N° Document</Label>
                        <Input
                          id="ocr-invoice-number"
                          data-testid="ocr-invoice-number"
                          value={form.invoiceNumber}
                          onChange={(e) => setField("invoiceNumber", e.target.value)}
                          placeholder="FA-2024-001"
                          className="mt-1"
                        />
                      </div>
                    </div>
                    {form.docType === "expense" && (
                      <div>
                        <Label htmlFor="ocr-category" className="text-xs text-zinc-500">Catégorie</Label>
                        <select
                          id="ocr-category"
                          data-testid="ocr-category"
                          value={form.category}
                          onChange={(e) => setField("category", e.target.value)}
                          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="ocr-date" className="text-xs text-zinc-500">Date</Label>
                      <Input
                        id="ocr-date"
                        data-testid="ocr-date"
                        type="date"
                        value={form.date}
                        onChange={(e) => setField("date", e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="ocr-due-date" className="text-xs text-zinc-500">Échéance</Label>
                      <Input
                        id="ocr-due-date"
                        data-testid="ocr-due-date"
                        type="date"
                        value={form.dueDate}
                        onChange={(e) => setField("dueDate", e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>

                  {/* Amounts */}
                  <div>
                    <Label className="text-xs text-zinc-500 mb-2 block">Montants (€)</Label>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label htmlFor="ocr-ht" className="text-xs text-zinc-400">Total HT</Label>
                        <Input
                          id="ocr-ht"
                          data-testid="ocr-ht"
                          type="number"
                          step="0.01"
                          min="0"
                          value={form.totalNet}
                          onChange={(e) => setField("totalNet", e.target.value)}
                          placeholder="0.00"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="ocr-tva" className="text-xs text-zinc-400">TVA</Label>
                        <Input
                          id="ocr-tva"
                          data-testid="ocr-tva"
                          type="number"
                          step="0.01"
                          min="0"
                          value={form.taxAmount}
                          onChange={(e) => setField("taxAmount", e.target.value)}
                          placeholder="0.00"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="ocr-ttc" className="text-xs text-zinc-400">Total TTC</Label>
                        <Input
                          id="ocr-ttc"
                          data-testid="ocr-ttc"
                          type="number"
                          step="0.01"
                          min="0"
                          value={form.totalAmount}
                          onChange={(e) => setField("totalAmount", e.target.value)}
                          placeholder="0.00"
                          className="mt-1 font-semibold"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <Label htmlFor="ocr-notes" className="text-xs text-zinc-500">Notes / Observations</Label>
                    <Textarea
                      id="ocr-notes"
                      data-testid="ocr-notes"
                      value={form.notes}
                      onChange={(e) => setField("notes", e.target.value)}
                      placeholder="Informations complémentaires…"
                      className="mt-1 resize-none"
                      rows={2}
                    />
                  </div>

                  {/* Create button */}
                  <Button
                    data-testid="create-document-btn"
                    onClick={() => createDocMutation.mutate()}
                    disabled={createDocMutation.isPending}
                    className={cn(
                      "w-full text-white font-semibold",
                      form.docType === "expense"          && "bg-orange-600 hover:bg-orange-700",
                      form.docType === "supplier_invoice" && "bg-blue-600 hover:bg-blue-700",
                      form.docType === "invoice"          && "bg-green-600 hover:bg-green-700",
                      form.docType === "credit_note"      && "bg-purple-600 hover:bg-purple-700",
                    )}
                  >
                    {createDocMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Création en cours…</>
                    ) : (
                      <>
                        {DOC_TYPES.find(d => d.value === form.docType)?.icon}
                        <span className="ml-2">
                          Créer — {DOC_TYPES.find(d => d.value === form.docType)?.label}
                        </span>
                      </>
                    )}
                  </Button>

                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Error state */}
        {scanMutation.isError && !ocrResult && (
          <Card className="border-red-200 dark:border-red-800" data-testid="mindee-error">
            <CardHeader className="bg-red-50 dark:bg-red-950/50 rounded-t-lg">
              <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400 text-base">
                <AlertCircle className="w-5 h-5" />
                Erreur d'analyse
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <p className="text-sm text-zinc-700 dark:text-zinc-300 mb-4">
                {scanMutation.error?.message || "Une erreur inattendue s'est produite"}
              </p>
              <Button variant="outline" className="w-full" onClick={() => scanMutation.reset()}>
                Réessayer
              </Button>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}
