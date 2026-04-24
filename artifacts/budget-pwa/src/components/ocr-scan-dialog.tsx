import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { getAuthToken, getActiveAppId, apiRequest } from "@/lib/queryClient";
import {
  Upload, Loader2, ScanLine, X, AlertTriangle, Sparkles,
  Building2, Calendar, Hash, CreditCard, Tag, FileText, ShieldCheck,
  ArrowRight, Receipt, FileCheck, FileMinus, FileInput,
} from "lucide-react";

export type OcrDocType = "expense" | "supplier_invoice" | "invoice" | "credit_note";

interface OcrScanDialogProps {
  trigger: React.ReactNode;
  defaultType?: OcrDocType;
  actions?: OcrDocType[];
  onCreated?: (type: OcrDocType, document: any) => void;
}

const DOC_NATURE_LABELS: Record<string, { fr: string; en: string; color: string }> = {
  facture:          { fr: "Facture",          en: "Invoice",        color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  ticket_de_caisse: { fr: "Ticket de caisse", en: "Receipt",        color: "bg-green-500/20 text-green-400 border-green-500/30" },
  avoir:            { fr: "Avoir",            en: "Credit Note",    color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  devis:            { fr: "Devis",            en: "Quote",          color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  note_de_frais:    { fr: "Note de frais",    en: "Expense Report", color: "bg-pink-500/20 text-pink-400 border-pink-500/30" },
  autre:            { fr: "Autre",            en: "Other",          color: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
};

const ACTION_CONFIG: Record<OcrDocType, { label: string; icon: React.ElementType; queryKeys: string[]; color: string }> = {
  expense:          { label: "Créer une dépense",            icon: Receipt,    queryKeys: ["/api/expenses", "/api/analytics/dashboard"],              color: "bg-orange-600 hover:bg-orange-700" },
  supplier_invoice: { label: "Créer facture fournisseur",    icon: FileInput,  queryKeys: ["/api/supplier-invoices"],                                 color: "bg-blue-600 hover:bg-blue-700" },
  invoice:          { label: "Créer une facture client",     icon: FileCheck,  queryKeys: ["/api/invoices", "/api/analytics/dashboard"],              color: "bg-green-600 hover:bg-green-700" },
  credit_note:      { label: "Créer un avoir",               icon: FileMinus,  queryKeys: ["/api/credit-notes"],                                      color: "bg-purple-600 hover:bg-purple-700" },
};

async function scanFile(file: File): Promise<any> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("type", "invoice");
  const headers: Record<string, string> = {};
  const token = getAuthToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const appId = getActiveAppId();
  if (appId) headers["X-App-Id"] = appId;
  const res = await fetch("/api/ocr/auto", { method: "POST", headers, body: formData });
  if (!res.ok) {
    const txt = await res.text();
    let msg: string;
    try { msg = (JSON.parse(txt) as { message?: string }).message ?? txt; } catch { msg = txt; }
    throw new Error(msg || `Erreur ${res.status}`);
  }
  return res.json();
}

export function OcrScanDialog({ trigger, defaultType, actions, onCreated }: OcrScanDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const qc = useQueryClient();
  const lang = user?.language ?? "fr";
  const t = (fr: string, en: string) => lang === "en" ? en : fr;

  const [open, setOpen] = useState(false);
  const [ocr, setOcr] = useState<any>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [creatingType, setCreatingType] = useState<OcrDocType | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const availableActions: OcrDocType[] = actions ?? (defaultType ? [defaultType] : ["expense", "supplier_invoice", "invoice", "credit_note"]);

  const scanMutation = useMutation({
    mutationFn: scanFile,
    onSuccess: (data) => {
      setOcr(data);
      toast({ title: t("Document analysé ✓", "Document analyzed ✓"), description: `Confiance : ${Math.round((data.confidence ?? 0) * 100)}%` });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: t("Erreur d'analyse", "Scan error"), description: err.message });
    },
  });

  const createMutation = useMutation({
    mutationFn: ({ type, ocrData }: { type: OcrDocType; ocrData: any }) =>
      apiRequest("POST", "/api/ocr/create-document", { type, ocr: ocrData }),
    onSuccess: (data: any, vars) => {
      const cfg = ACTION_CONFIG[vars.type];
      cfg.queryKeys.forEach(k => qc.invalidateQueries({ queryKey: [k] }));
      toast({ title: t("Document créé ✓", "Document created ✓"), description: cfg.label });
      onCreated?.(vars.type, data.document);
      handleClose();
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: t("Erreur de création", "Creation error"), description: err.message });
      setCreatingType(null);
    },
  });

  const handleFileChange = (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast({ variant: "destructive", title: t("Fichier trop volumineux", "File too large"), description: "Max 10 MB" });
      return;
    }
    setSelectedFile(file);
    setOcr(null);
    scanMutation.reset();
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setOcr(null);
    setPreview(null);
    setSelectedFile(null);
    setCreatingType(null);
    scanMutation.reset();
    createMutation.reset();
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleCreate = (type: OcrDocType) => {
    if (!ocr) return;
    setCreatingType(type);
    createMutation.mutate({ type, ocrData: ocr });
  };

  const nature = ocr?.documentNature || "autre";
  const natureLabel = DOC_NATURE_LABELS[nature] ?? DOC_NATURE_LABELS.autre;
  const confidencePct = Math.round((ocr?.confidence ?? 0) * 100);
  const fmt = (v?: number) => v != null ? `${v.toFixed(2)} €` : "—";

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); else setOpen(true); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            {t("Scanner un document OCR", "OCR Document Scan")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Drop zone */}
          <div
            className="border-2 border-dashed border-border/50 rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => !scanMutation.isPending && fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={e => {
              e.preventDefault(); e.stopPropagation();
              if (e.dataTransfer.files[0]) handleFileChange(e.dataTransfer.files[0]);
            }}
            data-testid="ocr-dropzone"
          >
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={e => { if (e.target.files?.[0]) handleFileChange(e.target.files[0]); }}
            />

            {scanMutation.isPending ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="relative">
                  <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                  <Sparkles className="w-5 h-5 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                </div>
                <p className="text-sm font-medium">{t("Analyse IA en cours…", "AI analysis in progress…")}</p>
                <p className="text-xs text-muted-foreground">{selectedFile?.name}</p>
              </div>
            ) : ocr ? (
              <div className="flex items-center gap-3 text-left">
                {preview && <img src={preview} alt="Preview" className="w-16 h-16 object-cover rounded-lg flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{selectedFile?.name}</p>
                  <p className="text-xs text-green-400 mt-0.5">{t("✓ Analysé — cliquez pour changer", "✓ Analyzed — click to change")}</p>
                </div>
                <button onClick={e => { e.stopPropagation(); setOcr(null); setSelectedFile(null); setPreview(null); }} className="text-zinc-400 hover:text-red-500">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-2">
                <div className="relative">
                  <Upload className="w-10 h-10 text-muted-foreground/30" />
                  <Sparkles className="w-4 h-4 text-primary absolute -top-1 -right-1" />
                </div>
                <p className="text-sm text-muted-foreground">{t("Glissez un document ou cliquez pour parcourir", "Drop a document or click to browse")}</p>
                <p className="text-[10px] text-muted-foreground/50">{t("Facture · Avoir · Ticket — PDF, JPG, PNG (max 10 Mo)", "Invoice · Credit Note · Receipt — PDF, JPG, PNG (max 10 MB)")}</p>
              </div>
            )}
          </div>

          {/* Scan button — shown when file selected but not yet scanned */}
          {selectedFile && !ocr && !scanMutation.isPending && (
            <Button
              className="w-full bg-primary hover:bg-primary/90"
              onClick={() => scanMutation.mutate(selectedFile)}
            >
              <ScanLine className="w-4 h-4 mr-2" />
              {t("Analyser le document", "Analyze document")}
            </Button>
          )}

          {/* OCR Results */}
          {ocr && (
            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className={`${natureLabel.color} border`}>{lang === "en" ? natureLabel.en : natureLabel.fr}</Badge>
                  <div className="flex items-center gap-1">
                    <ShieldCheck className={`w-3.5 h-3.5 ${confidencePct >= 80 ? "text-green-400" : confidencePct >= 50 ? "text-yellow-400" : "text-red-400"}`} />
                    <span className={`text-xs font-medium ${confidencePct >= 80 ? "text-green-400" : confidencePct >= 50 ? "text-yellow-400" : "text-red-400"}`}>{confidencePct}%</span>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px]"><Sparkles className="w-3 h-3 mr-1" /> IA OCR</Badge>
              </div>

              {/* Supplier */}
              {ocr.supplierName && (
                <div className="bg-muted/30 rounded-lg p-2.5">
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">
                    <Building2 className="w-3 h-3" /> {t("Fournisseur / Émetteur", "Supplier / Issuer")}
                  </div>
                  <p className="text-sm font-medium">{ocr.supplierName}</p>
                  <div className="flex flex-wrap gap-x-3 mt-0.5">
                    {ocr.supplierVatNumber && <span className="text-[10px] text-muted-foreground">TVA: {ocr.supplierVatNumber}</span>}
                    {ocr.supplierSiret && <span className="text-[10px] text-muted-foreground">SIRET: {ocr.supplierSiret}</span>}
                  </div>
                </div>
              )}

              {/* Dates + Ref */}
              <div className="grid grid-cols-2 gap-2">
                {ocr.invoiceNumber && (
                  <div className="bg-muted/30 rounded-lg p-2.5">
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase mb-0.5"><Hash className="w-3 h-3" /> N° Doc</div>
                    <p className="text-sm font-medium">{ocr.invoiceNumber}</p>
                  </div>
                )}
                {ocr.date && (
                  <div className="bg-muted/30 rounded-lg p-2.5">
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase mb-0.5"><Calendar className="w-3 h-3" /> Date</div>
                    <p className="text-sm font-medium">{ocr.date}</p>
                    {ocr.dueDate && <p className="text-[10px] text-muted-foreground">{t("Éch.", "Due")}: {ocr.dueDate}</p>}
                  </div>
                )}
              </div>

              {/* Amounts */}
              <div className="bg-muted/30 rounded-lg p-3">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">{t("HT", "Net")}</p>
                    <p className="text-sm font-bold">{fmt(ocr.totalNet)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">TVA{ocr.taxRate ? ` (${(ocr.taxRate * 100).toFixed(0)}%)` : ""}</p>
                    <p className="text-sm font-bold text-orange-400">{fmt(ocr.taxAmount)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">TTC</p>
                    <p className="text-sm font-bold text-primary">{fmt(ocr.totalAmount)}</p>
                  </div>
                </div>
              </div>

              {/* Line items */}
              {ocr.lineItems && ocr.lineItems.length > 0 && (
                <details>
                  <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground flex items-center gap-1">
                    <FileText className="w-3 h-3" /> {ocr.lineItems.length} {t("ligne(s) détectée(s)", "line(s) detected")}
                  </summary>
                  <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                    {ocr.lineItems.map((li: any, i: number) => (
                      <div key={i} className="flex justify-between text-xs bg-muted/20 rounded px-2 py-1.5">
                        <span className="truncate flex-1 mr-2">{li.description || "—"}</span>
                        <span className="text-muted-foreground whitespace-nowrap">{li.quantity > 1 ? `${li.quantity}× ` : ""}{li.total?.toFixed(2)} €</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {/* Badges */}
              <div className="flex flex-wrap gap-1.5">
                {ocr.paymentMethod && <Badge variant="outline" className="text-[10px] gap-1"><CreditCard className="w-2.5 h-2.5" />{ocr.paymentMethod}</Badge>}
                {ocr.suggestedCategory && <Badge variant="outline" className="text-[10px] gap-1"><Tag className="w-2.5 h-2.5" />{ocr.suggestedCategory}</Badge>}
              </div>

              {ocr.aiNotes && (
                <p className="text-[11px] text-muted-foreground italic bg-muted/20 rounded-lg p-2">{ocr.aiNotes}</p>
              )}

              {/* Action buttons */}
              <div className="border-t border-border/50 pt-3 space-y-2">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{t("Créer depuis ce document", "Create from this document")}</p>
                <div className="grid grid-cols-1 gap-2">
                  {availableActions.map(type => {
                    const cfg = ACTION_CONFIG[type];
                    const Icon = cfg.icon;
                    const isCreating = createMutation.isPending && creatingType === type;
                    return (
                      <Button
                        key={type}
                        className={`w-full text-white ${cfg.color}`}
                        onClick={() => handleCreate(type)}
                        disabled={createMutation.isPending}
                        data-testid={`button-ocr-create-${type}`}
                      >
                        {isCreating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Icon className="w-4 h-4 mr-2" />}
                        {isCreating ? t("Création en cours…", "Creating…") : cfg.label}
                        {!isCreating && <ArrowRight className="w-3 h-3 ml-auto" />}
                      </Button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* No data detected */}
          {ocr && !ocr.totalAmount && !ocr.supplierName && !ocr.invoiceNumber && (
            <div className="flex flex-col items-center gap-2 p-4 bg-yellow-500/10 rounded-xl border border-yellow-500/30 text-yellow-400">
              <AlertTriangle className="w-6 h-6" />
              <p className="text-sm font-medium text-center">{t("Aucune donnée détectée", "No data detected")}</p>
              <p className="text-xs text-muted-foreground text-center">{t("Essayez avec une image plus nette.", "Try a clearer image.")}</p>
            </div>
          )}

          {/* Error */}
          {scanMutation.isError && (
            <div className="flex flex-col items-center gap-2 p-4 bg-red-500/10 rounded-xl border border-red-500/30">
              <AlertTriangle className="w-6 h-6 text-red-400" />
              <p className="text-sm text-red-400 font-medium text-center">{scanMutation.error?.message}</p>
              <Button size="sm" variant="outline" onClick={() => scanMutation.reset()}>{t("Réessayer", "Retry")}</Button>
            </div>
          )}

          {/* Cancel */}
          {!ocr && (
            <div className="flex justify-end">
              <Button variant="outline" onClick={handleClose}>{t("Annuler", "Cancel")}</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
