import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { encodeRecurrence, decodeRecurrence, computeNextOccurrenceClient } from "@/pages/expenses";

const INVOICE_RECURRENCE_OPTIONS: Array<{ value: string; fr: string; en: string }> = [
  { value: "monthly:1",   fr: "Tous les mois",       en: "Monthly" },
  { value: "monthly:3",   fr: "Tous les 3 mois",     en: "Quarterly" },
  { value: "monthly:6",   fr: "Tous les 6 mois",     en: "Every 6 months" },
  { value: "yearly:1",    fr: "Tous les ans",        en: "Yearly" },
  { value: "weekly:1",    fr: "Toutes les semaines", en: "Weekly" },
];
import { Plus, FileText, Edit, CheckCircle, Clock, AlertTriangle, XCircle, Send, Trash2, ScanLine, Calendar } from "lucide-react";
import { Link } from "wouter";
import { ConfirmDelete } from "@/components/confirm-delete";
import { AttachmentButton } from "@/components/AttachmentButton";
import { format } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import type { Invoice, Appointment } from "@shared/schema";

const STATUS_CONFIG: Record<string, { label: string; labelEn: string; color: string; icon: React.ElementType }> = {
  draft:    { label: "Brouillon", labelEn: "Draft",    color: "bg-slate-500/20 text-slate-400",   icon: FileText },
  pending:  { label: "En attente", labelEn: "Pending",  color: "bg-sky-500/20 text-sky-400",     icon: Clock },
  approved: { label: "Approuvé",  labelEn: "Approved", color: "bg-emerald-500/20 text-emerald-400", icon: CheckCircle },
  accepted: { label: "Accepté",   labelEn: "Accepted", color: "bg-emerald-600/20 text-emerald-500", icon: CheckCircle },
  rejected: { label: "Refusé",    labelEn: "Rejected", color: "bg-rose-500/20 text-rose-400",     icon: XCircle },
  completed:{ label: "Terminé",   labelEn: "Completed",color: "bg-slate-600/20 text-slate-500",   icon: CheckCircle },
  cancelled:{ label: "Annulée",   labelEn: "Cancelled",color: "bg-rose-600/20 text-rose-500",     icon: XCircle },
  paid:     { label: "Payée",     labelEn: "Paid",     color: "bg-emerald-500/20 text-emerald-400", icon: CheckCircle },
  overdue:  { label: "En retard", labelEn: "Overdue",  color: "bg-rose-700/20 text-rose-600",     icon: AlertTriangle },
  confirmed:{ label: "Confirmée", labelEn: "Confirmed",color: "bg-emerald-500/20 text-emerald-400", icon: CheckCircle },
  sent:     { label: "Envoyée",   labelEn: "Sent",     color: "bg-blue-500/20 text-blue-400",   icon: Send },
  issued:   { label: "Émis",      labelEn: "Issued",   color: "bg-blue-500/20 text-blue-400",   icon: FileText },
  refunded: { label: "Remboursé", labelEn: "Refunded", color: "bg-amber-500/20 text-amber-400",   icon: Clock },
  signed:   { label: "Signé",     labelEn: "Signed",   color: "bg-emerald-500/20 text-emerald-400", icon: CheckCircle },
  in_progress: { label: "En cours", labelEn: "In Progress", color: "bg-amber-500/20 text-amber-400", icon: Clock },
  finalized: { label: "Finalisé", labelEn: "Finalized", color: "bg-emerald-600/20 text-emerald-500", icon: CheckCircle },
};

function InvoiceForm({ invoice, onClose }: { invoice?: Invoice; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const lang = user?.language ?? "fr";
  const t = (fr: string, en: string) => lang === "en" ? en : fr;

  const [form, setForm] = useState({
    number: invoice?.number ?? `FAC-${Date.now().toString().slice(-6)}`,
    clientName: invoice?.clientName ?? "",
    clientEmail: invoice?.clientEmail ?? "",
    clientAddress: invoice?.clientAddress ?? "",
    status: invoice?.status ?? "draft",
    taxRate: invoice?.taxRate ?? "20",
    currency: invoice?.currency ?? "EUR",
    dueDate: invoice?.dueDate ? format(new Date(invoice.dueDate), "yyyy-MM-dd") : format(new Date(Date.now() + 30 * 86400000), "yyyy-MM-dd"),
    notes: invoice?.notes ?? "",
    isRecurring: invoice?.isRecurring ?? false,
    recurrenceKey: encodeRecurrence(invoice?.recurrenceFrequency, invoice?.recurrenceInterval),
    recurrenceEndDate: invoice?.recurrenceEndDate ? format(new Date(invoice.recurrenceEndDate), "yyyy-MM-dd") : "",
  });
  const [items, setItems] = useState<{ description: string; quantity: string; unitPrice: string }[]>(
    invoice ? [] : [{ description: "", quantity: "1", unitPrice: "0" }]
  );

  const { data: invoiceDetail } = useQuery<any>({
    queryKey: [`/api/invoices/${invoice?.id}`],
    enabled: !!invoice?.id,
  });

  useEffect(() => {
    if (invoiceDetail?.items && invoiceDetail.items.length > 0) {
      setItems(invoiceDetail.items.map((item: any) => ({
        description: item.description,
        quantity: String(item.quantity),
        unitPrice: String(item.unitPrice),
      })));
    }
  }, [invoiceDetail]);

  const subtotal = items.reduce((s, i) => s + (parseFloat(i.quantity) || 0) * (parseFloat(i.unitPrice) || 0), 0);
  const taxAmount = subtotal * (parseFloat(form.taxRate) / 100);
  const total = subtotal + taxAmount;

  const mutation = useMutation({
    mutationFn: (data: any) => invoice
      ? apiRequest("PUT", `/api/invoices/${invoice.id}`, data)
      : apiRequest("POST", "/api/invoices", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/invoices"] });
      qc.invalidateQueries({ queryKey: ["/api/analytics/dashboard"] });
      toast({ title: t("Facture sauvegardée", "Invoice saved") });
      onClose();
    },
    onError: () => toast({ title: t("Erreur", "Error"), variant: "destructive" }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { isRecurring, recurrenceKey, recurrenceEndDate, ...rest } = form;
    const decoded = decodeRecurrence(recurrenceKey);
    const issued = new Date();
    const nextOccurrence = isRecurring && decoded
      ? computeNextOccurrenceClient(issued, decoded.frequency, decoded.interval).toISOString()
      : null;
    mutation.mutate({
      ...rest,
      subtotal: subtotal.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      total: total.toFixed(2),
      issuedDate: issued.toISOString(),
      dueDate: new Date(rest.dueDate).toISOString(),
      isRecurring,
      recurrenceFrequency: isRecurring && decoded ? decoded.frequency : null,
      recurrenceInterval: isRecurring && decoded ? decoded.interval : 1,
      recurrenceEndDate: isRecurring && recurrenceEndDate ? new Date(recurrenceEndDate).toISOString() : null,
      nextOccurrenceDate: nextOccurrence,
      items: items.map(i => ({
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        total: ((parseFloat(i.quantity) || 0) * (parseFloat(i.unitPrice) || 0)).toFixed(2),
      })),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">{t("N° Facture", "Invoice #")}</label>
          <Input value={form.number} onChange={e => setForm({ ...form, number: e.target.value })} required />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">{t("Statut", "Status")}</label>
          <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <SelectItem key={k} value={k}>{t(v.label, v.labelEn)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">{t("Client", "Client")}</label>
          <Input value={form.clientName} onChange={e => setForm({ ...form, clientName: e.target.value })} required />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Email</label>
          <Input type="email" value={form.clientEmail} onChange={e => setForm({ ...form, clientEmail: e.target.value })} />
        </div>
      </div>
      <div>
        <label className="text-xs text-muted-foreground">{t("Adresse client", "Client address")}</label>
        <Input value={form.clientAddress} onChange={e => setForm({ ...form, clientAddress: e.target.value })} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">{t("Échéance", "Due date")}</label>
          <Input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} required />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">TVA %</label>
          <Input type="number" value={form.taxRate} onChange={e => setForm({ ...form, taxRate: e.target.value })} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Devise</label>
          <Select value={form.currency} onValueChange={v => setForm({ ...form, currency: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="EUR">EUR €</SelectItem>
              <SelectItem value="USD">USD $</SelectItem>
              <SelectItem value="GBP">GBP £</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Line items */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("Lignes", "Items")}</label>
          <Button type="button" variant="outline" size="sm" onClick={() => setItems([...items, { description: "", quantity: "1", unitPrice: "0" }])}>
            <Plus className="w-3 h-3 mr-1" />{t("Ajouter", "Add")}
          </Button>
        </div>
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-1 items-center">
              <Input className="col-span-6" placeholder={t("Description", "Description")} value={item.description} onChange={e => { const n = [...items]; n[idx].description = e.target.value; setItems(n); }} />
              <Input className="col-span-2" placeholder="Qté" type="number" value={item.quantity} onChange={e => { const n = [...items]; n[idx].quantity = e.target.value; setItems(n); }} />
              <Input className="col-span-2" placeholder="P.U." type="number" value={item.unitPrice} onChange={e => { const n = [...items]; n[idx].unitPrice = e.target.value; setItems(n); }} />
              <div className="col-span-1 text-xs text-right text-muted-foreground">
                {((parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0)).toFixed(2)}
              </div>
              <Button type="button" variant="ghost" size="sm" className="col-span-1" onClick={() => setItems(items.filter((_, i) => i !== idx))}>
                <Trash2 className="w-3 h-3 text-red-400" />
              </Button>
            </div>
          ))}
        </div>
        <div className="mt-3 border-t pt-3 space-y-1 text-sm text-right">
          <div className="text-muted-foreground">HT: <span className="font-semibold text-foreground">{subtotal.toFixed(2)} {form.currency}</span></div>
          <div className="text-muted-foreground">TVA ({form.taxRate}%): <span className="font-semibold text-foreground">{taxAmount.toFixed(2)} {form.currency}</span></div>
          <div className="text-base font-bold text-primary">Total TTC: {total.toFixed(2)} {form.currency}</div>
        </div>
      </div>

      <div>
        <label className="text-xs text-muted-foreground">{t("Notes", "Notes")}</label>
        <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
      </div>

      {/* ─── Recurrence ──────────────────────────────────────────────────── */}
      <div className="rounded-md border border-border/60 bg-muted/30 p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">{t("Facture récurrente", "Recurring invoice")}</div>
            <div className="text-xs text-muted-foreground">{t("Émet automatiquement la prochaine facture", "Auto-emits the next invoice")}</div>
          </div>
          <Switch
            checked={form.isRecurring}
            onCheckedChange={v => setForm({ ...form, isRecurring: v, recurrenceKey: form.recurrenceKey || "monthly:1" })}
          />
        </div>
        {form.isRecurring && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">{t("Fréquence", "Frequency")}</label>
              <Select value={form.recurrenceKey || "monthly:1"} onValueChange={v => setForm({ ...form, recurrenceKey: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INVOICE_RECURRENCE_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{t(o.fr, o.en)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{t("Fin (optionnel)", "End (optional)")}</label>
              <Input type="date" value={form.recurrenceEndDate} onChange={e => setForm({ ...form, recurrenceEndDate: e.target.value })} />
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2 justify-end pt-2">
        <Button type="button" variant="outline" onClick={onClose}>{t("Annuler", "Cancel")}</Button>
        <Button type="submit" disabled={mutation.isPending} className="bg-primary hover:bg-primary/90">
          {mutation.isPending ? t("Sauvegarde...", "Saving...") : t("Sauvegarder", "Save")}
        </Button>
      </div>
    </form>
  );
}

export function Invoices() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const lang = user?.language ?? "fr";
  const t = (fr: string, en: string) => lang === "en" ? en : fr;
  const locale = lang === "fr" ? fr : enUS;

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Invoice | undefined>();
  const [filterStatus, setFilterStatus] = useState("all");

  const { data: invoiceList = [], isLoading, isError, refetch } = useQuery<Invoice[]>({ queryKey: ["/api/invoices"] });
  // RDV payés en revenu : intégrés dans cet onglet (type d'activité = RDV).
  const { data: appointments = [] } = useQuery<Appointment[]>({ queryKey: ["/api/appointments"] });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/invoices/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/invoices"] });
      qc.invalidateQueries({ queryKey: ["/api/analytics/dashboard"] });
      toast({ title: t("Facture supprimée", "Invoice deleted") });
    },
    onError: () => toast({ title: t("Erreur lors de la suppression", "Deletion error"), variant: "destructive" }),
  });

  const sendEmailMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/email/invoice/${id}`, {}),
    onSuccess: () => toast({ title: t("Email envoyé au client", "Email sent to client") }),
    onError: (err: any) => toast({ title: t("Erreur envoi email", "Email error"), description: err?.message, variant: "destructive" }),
  });

  // Convertit les RDV payés en revenu en lignes virtuelles (type d'activité = RDV).
  const apptRevenues = appointments
    .filter(a => a.direction === "income" && a.status === "paid" && a.amount != null)
    .map(a => {
      const amt = parseFloat(a.amount as any);
      const date = (a.paidAt || a.startDate) as any;
      return {
        id: -Math.abs(a.id),
        applicationId: (a as any).applicationId,
        number: `RDV-${a.id}`,
        clientName: a.title,
        clientEmail: null as any,
        issuedDate: date,
        dueDate: date,
        subtotal: amt,
        total: amt,
        currency: "EUR",
        status: "paid",
        attachmentPath: (a as any).attachmentPath,
        attachmentName: (a as any).attachmentName,
        __source: "appointment" as const,
      } as any;
    });

  const merged = [...invoiceList, ...apptRevenues];
  const filtered = filterStatus === "all" ? merged : merged.filter(i => i.status === filterStatus);

  const stats = {
    total: merged.reduce((s, i) => s + parseFloat(i.total as any), 0),
    paid: merged.filter(i => i.status === "paid").reduce((s, i) => s + parseFloat(i.total as any), 0),
    pending: merged.filter(i => i.status === "sent").reduce((s, i) => s + parseFloat(i.total as any), 0),
    overdue: merged.filter(i => i.status === "overdue").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("Factures Clients", "Client Invoices")}</h1>
          <p className="text-muted-foreground text-sm">{t("Gérez vos factures de vente", "Manage your sales invoices")}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/ocr-scan" asChild>
            <Button variant="outline" data-testid="button-ocr-invoice">
              <ScanLine className="w-4 h-4 mr-2" />{t("Scan OCR", "OCR Scan")}
            </Button>
          </Link>
          <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) setEditing(undefined); }}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90" data-testid="button-create-invoice">
                <Plus className="w-4 h-4 mr-2" />{t("Nouvelle facture", "New Invoice")}
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>{editing ? t("Modifier la facture", "Edit Invoice") : t("Nouvelle facture", "New Invoice")}</DialogTitle></DialogHeader>
            <InvoiceForm invoice={editing} onClose={() => { setOpen(false); setEditing(undefined); }} />
          </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: t("Total facturé", "Total Billed"), value: `${stats.total.toFixed(2)} €`, color: "text-foreground" },
          { label: t("Encaissé", "Collected"), value: `${stats.paid.toFixed(2)} €`, color: "text-green-500" },
          { label: t("En attente", "Pending"), value: `${stats.pending.toFixed(2)} €`, color: "text-blue-500" },
          { label: t("En retard", "Overdue"), value: stats.overdue.toString(), color: "text-red-500" },
        ].map(k => (
          <Card key={k.label} className="glass-card">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">{k.label}</div>
              <div className={`text-2xl font-bold mt-1 ${k.color}`}>{k.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {["all", "draft", "sent", "paid", "overdue", "cancelled"].map(s => (
          <Button key={s} variant={filterStatus === s ? "default" : "outline"} size="sm"
            onClick={() => setFilterStatus(s)}
            className={filterStatus === s ? "bg-primary" : ""}>
            {s === "all" ? t("Tous", "All") : t(STATUS_CONFIG[s]?.label, STATUS_CONFIG[s]?.labelEn)}
          </Button>
        ))}
      </div>

      {/* Table */}
      <Card className="glass-card">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left p-4 text-muted-foreground font-medium">{t("N°", "#")}</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">{t("Client", "Client")}</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">{t("Émise le", "Issued")}</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">{t("Échéance", "Due")}</th>
                  <th className="text-right p-4 text-muted-foreground font-medium">Total TTC</th>
                  <th className="text-center p-4 text-muted-foreground font-medium">{t("Statut", "Status")}</th>
                  <th className="text-right p-4 text-muted-foreground font-medium">{t("Actions", "Actions")}</th>
                </tr>
              </thead>
              <tbody>
                {isError ? (
                  <tr><td colSpan={7} className="text-center p-8">
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <AlertTriangle className="w-10 h-10 text-red-400" />
                      <p className="text-sm font-medium">{t("Impossible de charger les factures", "Failed to load invoices")}</p>
                      <button onClick={() => refetch()} className="text-xs px-3 py-1.5 rounded border border-border hover:bg-accent transition-colors" data-testid="btn-retry-invoices">{t("Réessayer", "Retry")}</button>
                    </div>
                  </td></tr>
                ) : isLoading ? (
                  <>{[1,2,3].map(i => (
                    <tr key={i}>
                      {[1,2,3,4,5,6,7].map(j => (
                        <td key={j} className="p-4"><div className="h-4 bg-muted/50 rounded animate-pulse" /></td>
                      ))}
                    </tr>
                  ))}</>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={7} className="text-center p-8 text-muted-foreground">{t("Aucune facture", "No invoices")}</td></tr>
                ) : filtered.map(inv => {
                  const cfg = STATUS_CONFIG[inv.status] ?? STATUS_CONFIG.draft;
                  const Icon = cfg.icon;
                  const isAppt = (inv as any).__source === "appointment";
                  const realApptId = isAppt ? Math.abs(inv.id) : null;
                  return (
                    <tr
                      key={isAppt ? `appt-${realApptId}` : inv.id}
                      className="border-b border-border/30 hover:bg-accent/20 transition-colors"
                      data-testid={isAppt ? `row-appointment-revenue-${realApptId}` : `row-invoice-${inv.id}`}
                    >
                      <td className="p-4 font-mono font-semibold text-primary">{inv.number}</td>
                      <td className="p-4">
                        <div className="font-medium flex items-center gap-2">
                          {inv.clientName}
                          {isAppt && (
                            <Badge variant="outline" className="text-[10px] border-pink-400/40 text-pink-400 bg-pink-500/10 px-1.5 py-0 gap-1">
                              <Calendar className="w-2.5 h-2.5" />
                              {t("Type d'activité : RDV", "Activity type: Appointment")}
                            </Badge>
                          )}
                        </div>
                        {inv.clientEmail && <div className="text-xs text-muted-foreground">{inv.clientEmail}</div>}
                      </td>
                      <td className="p-4 text-muted-foreground">{format(new Date(inv.issuedDate!), "dd MMM yyyy", { locale })}</td>
                      <td className="p-4 text-muted-foreground">{format(new Date(inv.dueDate!), "dd MMM yyyy", { locale })}</td>
                      <td className="p-4 text-right font-bold">{parseFloat(inv.total as any).toFixed(2)} {inv.currency}</td>
                      <td className="p-4 text-center">
                        <Badge className={`${cfg.color} text-xs font-medium gap-1`}>
                          <Icon className="w-3 h-3" />
                          {t(cfg.label, cfg.labelEn)}
                        </Badge>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex gap-1 justify-end">
                          {isAppt ? (
                            <Link href="/agenda">
                              <Button variant="ghost" size="sm" data-testid={`button-open-agenda-rev-${realApptId}`} title={t("Gérer dans l'agenda", "Manage in agenda")}>
                                <Edit className="w-3 h-3" />
                              </Button>
                            </Link>
                          ) : (
                            <>
                              {inv.clientEmail && (
                                <Button
                                  variant="ghost" size="sm"
                                  onClick={() => sendEmailMutation.mutate(inv.id)}
                                  disabled={sendEmailMutation.isPending}
                                  title={t("Envoyer par email", "Send by email")}
                                >
                                  <Send className="w-3 h-3 text-blue-400" />
                                </Button>
                              )}
                              <AttachmentButton
                                linkEndpoint={`/api/invoices/${inv.id}/attachment`}
                                currentPath={(inv as any).attachmentPath}
                                currentName={(inv as any).attachmentName}
                                onUploaded={() => qc.invalidateQueries({ queryKey: ["/api/invoices"] })}
                                size="icon"
                                variant="ghost"
                              />
                              <Button variant="ghost" size="sm" onClick={() => { setEditing(inv); setOpen(true); }}>
                                <Edit className="w-3 h-3" />
                              </Button>
                              <ConfirmDelete
                                onConfirm={() => deleteMutation.mutate(inv.id)}
                                isPending={deleteMutation.isPending}
                                description={`Supprimer la facture « ${inv.number} » de ${inv.clientName} ? Cette action est irréversible.`}
                                testId={`button-delete-invoice-${inv.id}`}
                              />
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
