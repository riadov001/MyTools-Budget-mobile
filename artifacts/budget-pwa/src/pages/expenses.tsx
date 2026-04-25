import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AttachmentButton } from "@/components/AttachmentButton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Receipt, CheckCircle, Clock, AlertTriangle, FileText, ScanLine, Tag, X } from "lucide-react";
import { Link } from "wouter";
import { ConfirmDelete } from "@/components/confirm-delete";
import { format } from "date-fns";
import { fr as frLocale, enUS } from "date-fns/locale";
import type { Expense, ExpenseCategory } from "@shared/schema";

const DEFAULT_CATEGORIES = ["Infrastructure", "Voyage", "Logiciels", "Bureau", "Marketing", "Personnel", "Sous-traitance", "Fournisseurs", "Clients", "Autre"];

const STATUS_MAP: Record<string, { label: string; labelEn: string; color: string; icon: React.ElementType }> = {
  paid:    { label: "Payée",      labelEn: "Paid",     color: "bg-green-500/20 text-green-400 border-green-500/30",  icon: CheckCircle },
  unpaid:  { label: "À payer",    labelEn: "Unpaid",   color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: Clock },
  overdue: { label: "En retard",  labelEn: "Overdue",  color: "bg-red-500/20 text-red-400 border-red-500/30",        icon: AlertTriangle },
};

const PAYMENT_METHODS: Record<string, { label: string; labelEn: string }> = {
  virement:    { label: "Virement bancaire", labelEn: "Bank Transfer" },
  carte:       { label: "Carte bancaire",    labelEn: "Credit Card" },
  especes:     { label: "Espèces",           labelEn: "Cash" },
  cheque:      { label: "Chèque",            labelEn: "Check" },
  prelevement: { label: "Prélèvement auto.", labelEn: "Direct Debit" },
  autre:       { label: "Autre",             labelEn: "Other" },
};

function AddCategoryDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [color, setColor] = useState("#6b7280");

  const mutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/expense-categories", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/expense-categories"] });
      toast({ title: "Catégorie ajoutée" });
      onClose();
    },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  return (
    <form onSubmit={e => { e.preventDefault(); mutation.mutate({ name, color }); }} className="space-y-4">
      <div>
        <label className="text-xs text-muted-foreground">Nom de la catégorie *</label>
        <Input value={name} onChange={e => setName(e.target.value)} required data-testid="input-category-name" />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Couleur</label>
        <div className="flex items-center gap-2">
          <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer border-0" />
          <span className="text-sm text-muted-foreground">{color}</span>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
        <Button type="submit" disabled={mutation.isPending} data-testid="button-save-category">
          {mutation.isPending ? "Ajout..." : "Ajouter"}
        </Button>
      </div>
    </form>
  );
}

// OcrScanner component removed — replaced by shared OcrScanDialog from components/ocr-scan-dialog.tsx

function ExpenseForm({ expense, onClose, categories, initialOcr }: { expense?: Expense; onClose: () => void; categories: string[]; initialOcr?: any }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const lang = user?.language ?? "fr";
  const t = (f: string, e: string) => lang === "en" ? e : f;

  const payMethodMap: Record<string, string> = { carte: "carte", card: "carte", cb: "carte", espèces: "especes", cash: "especes", virement: "virement", transfer: "virement", chèque: "cheque", check: "cheque", prélèvement: "prelevement", "direct debit": "prelevement" };
  const mapPayment = (v?: string) => { if (!v) return "virement"; const k = v.toLowerCase(); return payMethodMap[k] || Object.entries(payMethodMap).find(([key]) => k.includes(key))?.[1] || "autre"; };

  const [form, setForm] = useState({
    description: expense?.description ?? (initialOcr?.supplierName ? `${initialOcr.supplierName}${initialOcr.invoiceNumber ? ` - ${initialOcr.invoiceNumber}` : ""}` : ""),
    amount: expense?.amount?.toString() ?? initialOcr?.totalNet?.toString() ?? "",
    taxAmount: expense?.taxAmount?.toString() ?? initialOcr?.taxAmount?.toString() ?? "0",
    total: expense?.total?.toString() ?? initialOcr?.totalAmount?.toString() ?? "",
    category: expense?.category ?? initialOcr?.suggestedCategory ?? "Autre",
    date: expense?.date ? format(new Date(expense.date), "yyyy-MM-dd") : (initialOcr?.date || format(new Date(), "yyyy-MM-dd")),
    dueDate: expense?.dueDate ? format(new Date(expense.dueDate), "yyyy-MM-dd") : (initialOcr?.dueDate || ""),
    status: expense?.status ?? "unpaid",
    paymentMethod: expense?.paymentMethod ?? mapPayment(initialOcr?.paymentMethod),
    supplierName: expense?.supplierName ?? initialOcr?.supplierName ?? "",
    notes: expense?.notes ?? ([
      initialOcr?.invoiceNumber ? `Réf: ${initialOcr.invoiceNumber}` : "",
      initialOcr?.documentNature ? `Type: ${initialOcr.documentNature}` : "",
      initialOcr?.supplierVatNumber ? `TVA: ${initialOcr.supplierVatNumber}` : "",
      initialOcr?.lineItems?.length ? `Lignes: ${initialOcr.lineItems.map((li: any) => `${li.description} (${li.total?.toFixed(2)}€)`).join(", ")}` : "",
      initialOcr?.aiNotes || "",
    ].filter(Boolean).join(" | ") || ""),
    isRecurring: expense?.isRecurring ?? false,
    // Single key encoding "frequency:interval" for the simple selector
    recurrenceKey: encodeRecurrence(expense?.recurrenceFrequency, expense?.recurrenceInterval),
    recurrenceEndDate: expense?.recurrenceEndDate ? format(new Date(expense.recurrenceEndDate), "yyyy-MM-dd") : "",
  });

  const mutation = useMutation({
    mutationFn: (data: any) => expense
      ? apiRequest("PUT", `/api/expenses/${expense.id}`, data)
      : apiRequest("POST", "/api/expenses", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/expenses"] });
      qc.invalidateQueries({ queryKey: ["/api/analytics/dashboard"] });
      toast({ title: t("Dépense sauvegardée", "Expense saved") });
      onClose();
    },
    onError: () => toast({ title: t("Erreur", "Error"), variant: "destructive" }),
  });

  const ht = parseFloat(form.amount) || 0;
  const tva = parseFloat(form.taxAmount) || 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { isRecurring, recurrenceKey, recurrenceEndDate, ...rest } = form;
    const decoded = decodeRecurrence(recurrenceKey);
    const baseDate = new Date(rest.date);
    const nextOccurrence = isRecurring && decoded
      ? computeNextOccurrenceClient(baseDate, decoded.frequency, decoded.interval).toISOString()
      : null;
    mutation.mutate({
      ...rest,
      amount: ht.toFixed(2),
      taxAmount: tva.toFixed(2),
      total: (ht + tva).toFixed(2),
      date: baseDate.toISOString(),
      dueDate: rest.dueDate ? new Date(rest.dueDate).toISOString() : null,
      paymentMethod: rest.status === "paid" ? rest.paymentMethod : rest.paymentMethod || null,
      isRecurring,
      recurrenceFrequency: isRecurring && decoded ? decoded.frequency : null,
      recurrenceInterval: isRecurring && decoded ? decoded.interval : 1,
      recurrenceEndDate: isRecurring && recurrenceEndDate ? new Date(recurrenceEndDate).toISOString() : null,
      nextOccurrenceDate: nextOccurrence,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-xs text-muted-foreground">{t("Description *", "Description *")}</label>
        <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} required data-testid="input-expense-description" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">{t("Montant HT (€) *", "Amount excl. tax *")}</label>
          <Input type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required data-testid="input-expense-amount" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">TVA (€)</label>
          <Input type="number" step="0.01" min="0" value={form.taxAmount} onChange={e => setForm({ ...form, taxAmount: e.target.value })} data-testid="input-expense-tax" />
        </div>
      </div>
      <div className="text-sm text-right font-semibold text-primary">
        Total TTC : {(ht + tva).toFixed(2)} €
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">{t("Catégorie *", "Category *")}</label>
          <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
            <SelectTrigger data-testid="select-expense-category"><SelectValue /></SelectTrigger>
            <SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">{t("Date dépense *", "Expense date *")}</label>
          <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required data-testid="input-expense-date" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">{t("Date d'échéance", "Due date")}</label>
          <Input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} data-testid="input-expense-due-date" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">{t("Statut *", "Status *")}</label>
          <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
            <SelectTrigger data-testid="select-expense-status"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_MAP).map(([k, v]) => (
                <SelectItem key={k} value={k}>{t(v.label, v.labelEn)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">{t("Mode de paiement", "Payment method")}</label>
          <Select value={form.paymentMethod} onValueChange={v => setForm({ ...form, paymentMethod: v })}>
            <SelectTrigger data-testid="select-expense-payment-method"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(PAYMENT_METHODS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{t(v.label, v.labelEn)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">{t("Fournisseur", "Supplier")}</label>
          <Input value={form.supplierName} onChange={e => setForm({ ...form, supplierName: e.target.value })} data-testid="input-expense-supplier" />
        </div>
      </div>

      <div>
        <label className="text-xs text-muted-foreground">{t("Notes", "Notes")}</label>
        <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} data-testid="input-expense-notes" />
      </div>

      {/* ─── Recurrence ──────────────────────────────────────────────────── */}
      <div className="rounded-md border border-border/60 bg-muted/30 p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">{t("Dépense récurrente", "Recurring expense")}</div>
            <div className="text-xs text-muted-foreground">{t("Génère automatiquement les prochaines occurrences", "Auto-generates future occurrences")}</div>
          </div>
          <Switch
            checked={form.isRecurring}
            onCheckedChange={v => setForm({ ...form, isRecurring: v, recurrenceKey: form.recurrenceKey || "monthly:1" })}
            data-testid="switch-expense-recurring"
          />
        </div>
        {form.isRecurring && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">{t("Fréquence", "Frequency")}</label>
              <Select value={form.recurrenceKey || "monthly:1"} onValueChange={v => setForm({ ...form, recurrenceKey: v })}>
                <SelectTrigger data-testid="select-expense-frequency"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RECURRENCE_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{t(o.fr, o.en)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{t("Fin (optionnel)", "End (optional)")}</label>
              <Input type="date" value={form.recurrenceEndDate} onChange={e => setForm({ ...form, recurrenceEndDate: e.target.value })} data-testid="input-expense-recurrence-end" />
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2 justify-end pt-1">
        <Button type="button" variant="outline" onClick={onClose}>{t("Annuler", "Cancel")}</Button>
        <Button type="submit" disabled={mutation.isPending} className="bg-primary hover:bg-primary/90" data-testid="button-save-expense">
          {mutation.isPending ? t("Sauvegarde...", "Saving...") : t("Sauvegarder", "Save")}
        </Button>
      </div>
    </form>
  );
}

// ─── Recurrence helpers (shared between expense + invoice forms) ─────────────
const RECURRENCE_OPTIONS: Array<{ value: string; fr: string; en: string }> = [
  { value: "daily:1",     fr: "Tous les jours",      en: "Daily" },
  { value: "weekly:1",    fr: "Toutes les semaines", en: "Weekly" },
  { value: "weekly:2",    fr: "Toutes les 2 semaines", en: "Every 2 weeks" },
  { value: "monthly:1",   fr: "Tous les mois",       en: "Monthly" },
  { value: "monthly:3",   fr: "Tous les 3 mois",     en: "Quarterly" },
  { value: "monthly:6",   fr: "Tous les 6 mois",     en: "Every 6 months" },
  { value: "yearly:1",    fr: "Tous les ans",        en: "Yearly" },
];

export function encodeRecurrence(frequency?: string | null, interval?: number | null): string {
  if (!frequency) return "monthly:1";
  return `${frequency}:${interval || 1}`;
}

export function decodeRecurrence(key: string): { frequency: string; interval: number } | null {
  if (!key) return null;
  const [frequency, intervalStr] = key.split(":");
  const interval = parseInt(intervalStr, 10) || 1;
  if (!["daily", "weekly", "monthly", "yearly"].includes(frequency)) return null;
  return { frequency, interval };
}

export function computeNextOccurrenceClient(from: Date, frequency: string, interval: number): Date {
  const next = new Date(from);
  const i = Math.max(1, interval);
  switch (frequency) {
    case "daily":   next.setDate(next.getDate() + i); break;
    case "weekly":  next.setDate(next.getDate() + 7 * i); break;
    case "monthly": next.setMonth(next.getMonth() + i); break;
    case "yearly":  next.setFullYear(next.getFullYear() + i); break;
  }
  return next;
}

export function Expenses() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const lang = user?.language ?? "fr";
  const t = (f: string, e: string) => lang === "en" ? e : f;
  const locale = lang === "fr" ? frLocale : enUS;

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | undefined>();
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCat, setFilterCat] = useState("all");
  const [isExporting, setIsExporting] = useState(false);
  const [catOpen, setCatOpen] = useState(false);

  const { data: list = [], isLoading, isError, refetch } = useQuery<Expense[]>({ queryKey: ["/api/expenses"] });
  const { data: dynamicCategories = [] } = useQuery<ExpenseCategory[]>({ queryKey: ["/api/expense-categories"] });

  const categories = dynamicCategories.length > 0
    ? Array.from(new Set(dynamicCategories.map(c => c.name)))
    : DEFAULT_CATEGORIES;

  const deleteCatMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/expense-categories/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/expense-categories"] });
      toast({ title: t("Catégorie supprimée", "Category deleted") });
    },
    onError: () => toast({ title: t("Erreur lors de la suppression", "Deletion error"), variant: "destructive" }),
  });

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/expenses/export/pdf", {
        headers: {
          Authorization: `Bearer ${token}`,
          "x-app-id": user?.applicationId?.toString() ?? ""
        }
      });
      if (!res.ok) throw new Error("PDF error");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `depenses-${format(new Date(), "yyyy-MM-dd")}.pdf`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: t("PDF généré", "PDF generated") });
    } catch (err) {
      toast({ title: t("Erreur PDF", "PDF error"), variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/expenses/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/expenses"] });
      qc.invalidateQueries({ queryKey: ["/api/analytics/dashboard"] });
      toast({ title: t("Supprimée", "Deleted") });
    },
    onError: () => toast({ title: t("Erreur lors de la suppression", "Deletion error"), variant: "destructive" }),
  });

  const resolvedList = list.map(e => {
    if (e.status === "unpaid" && e.dueDate && new Date(e.dueDate) < new Date()) {
      return { ...e, status: "overdue" };
    }
    return e;
  });

  const filtered = resolvedList.filter(e => {
    const matchStatus = filterStatus === "all" || e.status === filterStatus;
    const matchCat = filterCat === "all" || e.category === filterCat;
    return matchStatus && matchCat;
  });

  const totalPaid = resolvedList.filter(e => e.status === "paid").reduce((s, e) => s + parseFloat(e.total as any), 0);
  const totalUnpaid = resolvedList.filter(e => e.status === "unpaid").reduce((s, e) => s + parseFloat(e.total as any), 0);
  const totalOverdue = resolvedList.filter(e => e.status === "overdue").reduce((s, e) => s + parseFloat(e.total as any), 0);
  const totalAll = resolvedList.reduce((s, e) => s + parseFloat(e.total as any), 0);

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("Dépenses", "Expenses")}</h1>
          <p className="text-muted-foreground text-sm">{t("Suivi des achats et notes de frais", "Track purchases and expenses")}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={handleExportPDF} disabled={isExporting} data-testid="button-export-pdf">
            <FileText className="w-4 h-4 mr-2" />
            {isExporting ? t("Génération...", "Generating...") : t("Export PDF", "Export PDF")}
          </Button>

          <Link href="/ocr-scan" asChild>
            <Button variant="outline" className="gap-2" data-testid="button-ocr-scan">
              <ScanLine className="w-4 h-4" />
              {t("Scanner OCR", "OCR Scan")}
            </Button>
          </Link>

          <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) { setEditing(undefined); } }}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90" data-testid="button-create-expense">
                <Plus className="w-4 h-4 mr-2" />{t("Nouvelle dépense", "New Expense")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {editing ? t("Modifier la dépense", "Edit Expense") : t("Nouvelle dépense", "New Expense")}
                </DialogTitle>
              </DialogHeader>
              <ExpenseForm expense={editing} categories={categories} onClose={() => { setOpen(false); setEditing(undefined); }} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {totalOverdue > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>
            {resolvedList.filter(e => e.status === "overdue").length} {t("dépense(s) en retard de paiement", "overdue expense(s)")} — {totalOverdue.toFixed(2)} €
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: t("Total", "Total"),          value: `${totalAll.toFixed(2)} €`,     color: "text-foreground",    count: resolvedList.length },
          { label: t("Payées", "Paid"),           value: `${totalPaid.toFixed(2)} €`,    color: "text-green-500",     count: resolvedList.filter(e => e.status === "paid").length },
          { label: t("À payer", "Unpaid"),        value: `${totalUnpaid.toFixed(2)} €`,  color: "text-yellow-500",    count: resolvedList.filter(e => e.status === "unpaid").length },
          { label: t("En retard", "Overdue"),     value: `${totalOverdue.toFixed(2)} €`, color: "text-red-500",       count: resolvedList.filter(e => e.status === "overdue").length },
        ].map(k => (
          <Card key={k.label} className="glass-card">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground font-medium">{k.label}</div>
              <div className={`text-xl font-bold mt-1 ${k.color}`}>{k.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{k.count} dépense{k.count > 1 ? "s" : ""}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1.5 flex-wrap">
          {(["all", "paid", "unpaid", "overdue"] as const).map(s => (
            <Button key={s} variant={filterStatus === s ? "default" : "outline"} size="sm"
              onClick={() => setFilterStatus(s)} className={filterStatus === s ? "bg-primary" : ""}>
              {s === "all" ? t("Tous statuts", "All statuses")
                : s === "paid" ? t("Payées", "Paid")
                : s === "unpaid" ? t("À payer", "Unpaid")
                : t("En retard", "Overdue")}
            </Button>
          ))}
        </div>
        <div className="flex gap-1.5 flex-wrap items-center">
          {["all", ...categories].map(c => (
            <Button key={c} variant={filterCat === c ? "default" : "outline"} size="sm"
              onClick={() => setFilterCat(c)} className={filterCat === c ? "bg-primary/80" : ""}>
              {c === "all" ? t("Toutes catégories", "All categories") : c}
            </Button>
          ))}

          <Dialog open={catOpen} onOpenChange={setCatOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1 border-dashed" data-testid="button-add-category">
                <Plus className="w-3 h-3" />
                <Tag className="w-3 h-3" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>{t("Ajouter une catégorie", "Add a category")}</DialogTitle>
              </DialogHeader>
              <AddCategoryDialog onClose={() => setCatOpen(false)} />
              {dynamicCategories.length > 0 && (
                <div className="border-t pt-3 mt-2">
                  <p className="text-xs text-muted-foreground mb-2">{t("Catégories existantes", "Existing categories")}</p>
                  <div className="flex flex-wrap gap-1">
                    {dynamicCategories.map(c => (
                      <Badge key={c.id} variant="outline" className="gap-1 text-xs" data-testid={`badge-category-${c.id}`}>
                        {c.color && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />}
                        {c.name}
                        <ConfirmDelete
                          title={t("Supprimer cette catégorie ?", "Delete this category?")}
                          description={t("Cette catégorie sera supprimée définitivement.", "This category will be permanently deleted.")}
                          onConfirm={() => deleteCatMutation.mutate(c.id)}
                          isPending={deleteCatMutation.isPending}
                          trigger={
                            <button className="ml-1 hover:text-red-400" data-testid={`btn-delete-category-${c.id}`}>
                              <X className="w-3 h-3" />
                            </button>
                          }
                        />
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="space-y-2">
        {isError ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-3">
            <AlertTriangle className="w-10 h-10 text-red-400" />
            <p className="text-sm font-medium">{t("Impossible de charger les dépenses", "Failed to load expenses")}</p>
            <button onClick={() => refetch()} className="text-xs px-3 py-1.5 rounded border border-border hover:bg-accent transition-colors" data-testid="btn-retry-expenses">{t("Réessayer", "Retry")}</button>
          </div>
        ) : isLoading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="flex items-center gap-3 p-4 rounded-xl border border-border/50 bg-card/50">
                <div className="w-10 h-10 rounded-lg bg-muted/50 animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-36 bg-muted/50 rounded animate-pulse" />
                  <div className="h-3 w-52 bg-muted/50 rounded animate-pulse" />
                </div>
                <div className="h-5 w-20 bg-muted/50 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground flex flex-col items-center gap-2">
            <Receipt className="w-12 h-12 opacity-20" />
            <span>{t("Aucune dépense", "No expenses")}</span>
          </div>
        ) : filtered.map(exp => {
          const cfg = STATUS_MAP[exp.status] ?? STATUS_MAP.unpaid;
          const Icon = cfg.icon;
          const payMethod = exp.paymentMethod ? PAYMENT_METHODS[exp.paymentMethod]?.label ?? exp.paymentMethod : null;
          return (
            <div
              key={exp.id}
              className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-card/50 hover:bg-card/80 transition-colors"
              data-testid={`row-expense-${exp.id}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  exp.status === "paid" ? "bg-green-500/10" : exp.status === "overdue" ? "bg-red-500/10" : "bg-yellow-500/10"
                }`}>
                  <Icon className={`w-5 h-5 ${
                    exp.status === "paid" ? "text-green-500" : exp.status === "overdue" ? "text-red-500" : "text-yellow-500"
                  }`} />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold truncate">{exp.description}</div>
                  <div className="text-xs text-muted-foreground flex flex-wrap gap-2 mt-0.5">
                    <span>{exp.category}</span>
                    {exp.supplierName && <span>· {exp.supplierName}</span>}
                    {payMethod && <span>· {payMethod}</span>}
                    <span>· {format(new Date(exp.date!), "dd MMM yyyy", { locale })}</span>
                    {exp.dueDate && (
                      <span className={exp.status === "overdue" ? "text-red-400" : ""}>
                        · Éch. {format(new Date(exp.dueDate), "dd MMM yyyy", { locale })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                <div className="text-right hidden sm:block">
                  <div className="font-bold">{parseFloat(exp.total as any).toFixed(2)} €</div>
                  <div className="text-xs text-muted-foreground">HT: {parseFloat(exp.amount as any).toFixed(2)} €</div>
                </div>
                <Badge className={`${cfg.color} text-xs hidden md:flex border items-center gap-1`}>
                  <Icon className="w-3 h-3" />
                  {t(cfg.label, cfg.labelEn)}
                </Badge>
                <div className="flex gap-1 items-center">
                  <AttachmentButton
                    linkEndpoint={`/api/expenses/${exp.id}/attachment`}
                    currentPath={(exp as any).attachmentPath}
                    currentName={(exp as any).attachmentName}
                    onUploaded={() => qc.invalidateQueries({ queryKey: ["/api/expenses"] })}
                    size="icon"
                    variant="ghost"
                  />
                  <Button variant="ghost" size="sm" onClick={() => { setEditing(list.find(e => e.id === exp.id) ?? exp); setOpen(true); }} data-testid={`button-edit-expense-${exp.id}`}>
                    <Edit className="w-3.5 h-3.5" />
                  </Button>
                  <ConfirmDelete
                    onConfirm={() => deleteMutation.mutate(exp.id)}
                    isPending={deleteMutation.isPending}
                    description={t(
                      `Supprimer la dépense « ${exp.description} » (${parseFloat(exp.total as any).toFixed(2)} €) ? Cette action est irréversible.`,
                      `Delete expense "${exp.description}" (${parseFloat(exp.total as any).toFixed(2)} €)? This cannot be undone.`
                    )}
                    testId={`button-delete-expense-${exp.id}`}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length > 0 && (
        <div className="flex justify-between items-center p-3 rounded-xl bg-muted/20 text-sm font-semibold border border-border/30">
          <span>{t("Total affiché", "Displayed total")} ({filtered.length})</span>
          <span>{filtered.reduce((s, e) => s + parseFloat(e.total as any), 0).toFixed(2)} €</span>
        </div>
      )}
    </div>
  );
}
