import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, ShoppingCart, FileDown, X, Check, Receipt, AlertTriangle, ScanLine } from "lucide-react";
import { Link } from "wouter";
import { ConfirmDelete } from "@/components/confirm-delete";
import { AttachmentButton } from "@/components/AttachmentButton";
import { format } from "date-fns";
import { fr as frLocale, enUS } from "date-fns/locale";
import type { SupplierInvoice, Supplier, Service } from "@shared/schema";

const STATUS_MAP: Record<string, { label: string; labelEn: string; color: string }> = {
  pending:   { label: "À approuver", labelEn: "Pending",   color: "bg-yellow-500/20 text-yellow-400" },
  approved:  { label: "Approuvée",   labelEn: "Approved",  color: "bg-blue-500/20 text-blue-400" },
  paid:      { label: "Payée",       labelEn: "Paid",      color: "bg-green-500/20 text-green-400" },
  cancelled: { label: "Annulée",     labelEn: "Cancelled", color: "bg-gray-500/20 text-gray-400" },
};

function ServiceSelector({ selected, onChange, services }: {
  selected: string[];
  onChange: (v: string[]) => void;
  services: Service[];
}) {
  const toggle = (name: string) => {
    onChange(selected.includes(name) ? selected.filter(s => s !== name) : [...selected, name]);
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 rounded-md border border-input bg-background">
        {selected.length === 0 && <span className="text-xs text-muted-foreground self-center">Aucun service sélectionné</span>}
        {selected.map(s => (
          <span key={s} className="flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded text-xs font-medium">
            {s}
            <button type="button" onClick={() => toggle(s)}><X className="w-3 h-3" /></button>
          </span>
        ))}
      </div>
      <div className="max-h-36 overflow-y-auto rounded-md border border-border/50 divide-y divide-border/30">
        {services.map(svc => (
          <button
            key={svc.id}
            type="button"
            onClick={() => toggle(svc.name)}
            className="flex items-center justify-between w-full px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
          >
            <span className="truncate">{svc.name}</span>
            {selected.includes(svc.name) && <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
          </button>
        ))}
        {services.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">Aucun service disponible</div>}
      </div>
    </div>
  );
}

function SupplierInvoiceForm({ invoice, onClose }: { invoice?: SupplierInvoice; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const lang = user?.language ?? "fr";
  const t = (f: string, e: string) => lang === "en" ? e : f;

  const { data: suppliers = [] } = useQuery<Supplier[]>({ queryKey: ["/api/suppliers"] });
  const { data: services = [] } = useQuery<Service[]>({ queryKey: ["/api/services"] });

  const initServices: string[] = invoice?.linkedServices ? JSON.parse(invoice.linkedServices) : [];

  const [form, setForm] = useState({
    number: invoice?.number ?? `FF-${Date.now().toString().slice(-6)}`,
    supplierId: invoice?.supplierId?.toString() ?? "",
    supplierName: invoice?.supplierName ?? "",
    supplierEmail: invoice?.supplierEmail ?? "",
    supplierPhone: invoice?.supplierPhone ?? "",
    supplierAddress: invoice?.supplierAddress ?? "",
    status: invoice?.status ?? "pending",
    subtotal: invoice?.subtotal?.toString() ?? "",
    taxRate: invoice?.taxRate?.toString() ?? "20",
    taxAmount: invoice?.taxAmount?.toString() ?? "0",
    total: invoice?.total?.toString() ?? "",
    currency: invoice?.currency ?? "EUR",
    issuedDate: invoice?.issuedDate ? format(new Date(invoice.issuedDate), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
    dueDate: invoice?.dueDate ? format(new Date(invoice.dueDate), "yyyy-MM-dd") : format(new Date(Date.now() + 30 * 86400000), "yyyy-MM-dd"),
    notes: invoice?.notes ?? "",
  });
  const [selectedServices, setSelectedServices] = useState<string[]>(initServices);

  const ht = parseFloat(form.subtotal) || 0;
  const taxRate = parseFloat(form.taxRate) || 0;
  const tva = ht * taxRate / 100;

  const handleSupplierSelect = (supplierId: string) => {
    const supplier = suppliers.find(s => s.id.toString() === supplierId);
    if (supplier) {
      setForm(prev => ({
        ...prev,
        supplierId,
        supplierName: supplier.name,
        supplierEmail: supplier.email ?? "",
        supplierPhone: supplier.phone ?? "",
        supplierAddress: supplier.address ?? "",
      }));
    }
  };

  const mutation = useMutation({
    mutationFn: (data: any) => invoice
      ? apiRequest("PUT", `/api/supplier-invoices/${invoice.id}`, data)
      : apiRequest("POST", "/api/supplier-invoices", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/supplier-invoices"] });
      toast({ title: t("Sauvegardée", "Saved") });
      onClose();
    },
    onError: () => toast({ title: t("Erreur", "Error"), variant: "destructive" }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      ...form,
      supplierId: form.supplierId ? parseInt(form.supplierId) : null,
      subtotal: ht.toFixed(2),
      taxAmount: tva.toFixed(2),
      total: (ht + tva).toFixed(2),
      issuedDate: new Date(form.issuedDate).toISOString(),
      dueDate: new Date(form.dueDate).toISOString(),
      linkedServices: JSON.stringify(selectedServices),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">{t("N° Facture", "Invoice #")}</label>
          <Input data-testid="input-invoice-number" value={form.number} onChange={e => setForm({ ...form, number: e.target.value })} required />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">{t("Statut", "Status")}</label>
          <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
            <SelectTrigger data-testid="select-status"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(STATUS_MAP).map(([k, v]) => <SelectItem key={k} value={k}>{t(v.label, v.labelEn)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      {/* Supplier selector */}
      <div>
        <label className="text-xs text-muted-foreground">{t("Fournisseur (depuis annuaire)", "Supplier (from directory)")}</label>
        <Select value={form.supplierId} onValueChange={handleSupplierSelect}>
          <SelectTrigger data-testid="select-supplier"><SelectValue placeholder={t("Sélectionner un fournisseur...", "Select a supplier...")} /></SelectTrigger>
          <SelectContent>
            {suppliers.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Supplier details */}
      <div className="p-3 rounded-lg border border-border/50 bg-muted/20 space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("Coordonnées fournisseur", "Supplier Details")}</div>
        <div>
          <label className="text-xs text-muted-foreground">{t("Nom", "Name")}</label>
          <Input data-testid="input-supplier-name" value={form.supplierName} onChange={e => setForm({ ...form, supplierName: e.target.value })} required />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground">Email</label>
            <Input data-testid="input-supplier-email" type="email" value={form.supplierEmail} onChange={e => setForm({ ...form, supplierEmail: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">{t("Téléphone", "Phone")}</label>
            <Input data-testid="input-supplier-phone" value={form.supplierPhone} onChange={e => setForm({ ...form, supplierPhone: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">{t("Adresse", "Address")}</label>
          <Input data-testid="input-supplier-address" value={form.supplierAddress} onChange={e => setForm({ ...form, supplierAddress: e.target.value })} />
        </div>
      </div>

      {/* Services */}
      <div>
        <label className="text-xs text-muted-foreground block mb-1">{t("Services liés (pour le PDF)", "Linked Services (for PDF)")}</label>
        <ServiceSelector selected={selectedServices} onChange={setSelectedServices} services={services} />
      </div>

      {/* Amounts */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <label className="text-xs text-muted-foreground">{t("Montant HT", "Excl. Tax")}</label>
          <Input data-testid="input-subtotal" type="number" step="0.01" value={form.subtotal} onChange={e => setForm({ ...form, subtotal: e.target.value })} required />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">TVA %</label>
          <Input data-testid="input-tax-rate" type="number" value={form.taxRate} onChange={e => setForm({ ...form, taxRate: e.target.value })} />
        </div>
      </div>
      <div className="flex items-center justify-between text-sm px-1">
        <span className="text-muted-foreground">TVA : {tva.toFixed(2)} €</span>
        <span className="font-bold text-primary">Total TTC : {(ht + tva).toFixed(2)} €</span>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">{t("Date facture", "Issue date")}</label>
          <Input data-testid="input-issued-date" type="date" value={form.issuedDate} onChange={e => setForm({ ...form, issuedDate: e.target.value })} required />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">{t("Échéance", "Due date")}</label>
          <Input data-testid="input-due-date" type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} required />
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onClose}>{t("Annuler", "Cancel")}</Button>
        <Button type="submit" disabled={mutation.isPending} className="bg-primary hover:bg-primary/90">
          {mutation.isPending ? t("Sauvegarde...", "Saving...") : t("Sauvegarder", "Save")}
        </Button>
      </div>
    </form>
  );
}

export function SupplierInvoices() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const lang = user?.language ?? "fr";
  const t = (f: string, e: string) => lang === "en" ? e : f;
  const locale = lang === "fr" ? frLocale : enUS;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SupplierInvoice | undefined>();
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const { data: list = [], isLoading, isError, refetch } = useQuery<SupplierInvoice[]>({ queryKey: ["/api/supplier-invoices"] });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/supplier-invoices/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/supplier-invoices"] }); toast({ title: t("Supprimée", "Deleted") }); },
    onError: () => toast({ title: t("Erreur lors de la suppression", "Deletion error"), variant: "destructive" }),
  });

  const createExpenseMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/expenses/from-invoice/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/expenses"] });
      qc.invalidateQueries({ queryKey: ["/api/analytics/dashboard"] });
      toast({ title: t("Dépense créée depuis la facture", "Expense created from invoice") });
    },
    onError: () => toast({ title: t("Erreur", "Error"), variant: "destructive" }),
  });

  const handleDownloadPDF = async (inv: SupplierInvoice) => {
    setDownloadingId(inv.id);
    try {
      const token = localStorage.getItem("token");
      const appId = localStorage.getItem("activeAppId");
      const res = await fetch(`/api/supplier-invoices/${inv.id}/pdf`, {
        headers: {
          Authorization: `Bearer ${token}`,
          ...(appId ? { "x-app-id": appId } : {}),
        },
      });
      if (!res.ok) throw new Error("PDF error");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `facture-fournisseur-${inv.number}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: t("PDF téléchargé", "PDF downloaded") });
    } catch {
      toast({ title: t("Erreur PDF", "PDF error"), variant: "destructive" });
    } finally {
      setDownloadingId(null);
    }
  };

  const totalPending = list.filter(i => i.status === "pending" || i.status === "approved").reduce((s, i) => s + parseFloat(i.total as any), 0);
  const totalPaid = list.filter(i => i.status === "paid").reduce((s, i) => s + parseFloat(i.total as any), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("Factures Fournisseurs", "Supplier Invoices")}</h1>
          <p className="text-muted-foreground text-sm">{t("Vos achats et factures reçues — rappels automatiques 48h avant échéance", "Purchases and received invoices")}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/ocr-scan" asChild>
            <Button variant="outline" data-testid="button-ocr-supplier-invoice">
              <ScanLine className="w-4 h-4 mr-2" />{t("Scan OCR", "OCR Scan")}
            </Button>
          </Link>
          <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) setEditing(undefined); }}>
            <DialogTrigger asChild>
              <Button data-testid="button-new-invoice" className="bg-primary hover:bg-primary/90">
                <Plus className="w-4 h-4 mr-2" />{t("Nouvelle facture", "New Invoice")}
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? t("Modifier", "Edit") : t("Nouvelle facture fournisseur", "New Supplier Invoice")}</DialogTitle></DialogHeader>
            <SupplierInvoiceForm invoice={editing} onClose={() => { setOpen(false); setEditing(undefined); }} />
          </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">{t("À payer", "To pay")}</div>
            <div className="text-xl font-bold text-red-500 mt-1">{totalPending.toFixed(2)} €</div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">{t("Payées", "Paid")}</div>
            <div className="text-xl font-bold text-green-500 mt-1">{totalPaid.toFixed(2)} €</div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">{t("Total factures", "Total invoices")}</div>
            <div className="text-xl font-bold mt-1">{list.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* List */}
      <div className="space-y-2">
        {isError ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-3">
            <AlertTriangle className="w-10 h-10 text-red-400" />
            <p className="text-sm font-medium">{t("Impossible de charger les factures fournisseurs", "Failed to load supplier invoices")}</p>
            <button onClick={() => refetch()} className="text-xs px-3 py-1.5 rounded border border-border hover:bg-accent transition-colors" data-testid="btn-retry-supplier-invoices">{t("Réessayer", "Retry")}</button>
          </div>
        ) : isLoading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="flex items-center gap-3 p-4 rounded-xl border border-border/50 bg-card/50">
                <div className="w-10 h-10 rounded-lg bg-muted/50 animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 bg-muted/50 rounded animate-pulse" />
                  <div className="h-3 w-48 bg-muted/50 rounded animate-pulse" />
                </div>
                <div className="h-5 w-20 bg-muted/50 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : list.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground flex flex-col items-center gap-2">
            <ShoppingCart className="w-12 h-12 opacity-20" />
            <span>{t("Aucune facture fournisseur", "No supplier invoices")}</span>
          </div>
        ) : list.map(inv => {
          const cfg = STATUS_MAP[inv.status] ?? STATUS_MAP.pending;
          const linkedServices: string[] = inv.linkedServices ? JSON.parse(inv.linkedServices) : [];
          return (
            <div key={inv.id} data-testid={`row-supplier-invoice-${inv.id}`} className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-card/50 hover:bg-card/80 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                  <ShoppingCart className="w-5 h-5 text-orange-500" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold font-mono text-primary truncate">{inv.number}</div>
                  <div className="text-sm font-medium truncate">{inv.supplierName}</div>
                  {inv.supplierEmail && <div className="text-xs text-muted-foreground truncate">{inv.supplierEmail}</div>}
                  <div className="text-xs text-muted-foreground">{t("Échéance", "Due")}: {format(new Date(inv.dueDate!), "dd MMM yyyy", { locale })}</div>
                  {linkedServices.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {linkedServices.slice(0, 3).map(s => (
                        <span key={s} className="text-[10px] px-1.5 py-0.5 bg-muted rounded text-muted-foreground">{s}</span>
                      ))}
                      {linkedServices.length > 3 && <span className="text-[10px] text-muted-foreground">+{linkedServices.length - 3}</span>}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                <div className="text-right">
                  <div className="font-bold">{parseFloat(inv.total as any).toFixed(2)} {inv.currency}</div>
                  <Badge className={`${cfg.color} text-xs mt-1`}>{t(cfg.label, cfg.labelEn)}</Badge>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    data-testid={`button-expense-from-${inv.id}`}
                    onClick={() => createExpenseMutation.mutate(inv.id)}
                    disabled={createExpenseMutation.isPending}
                    title={t("Créer dépense", "Create expense")}
                  >
                    <Receipt className="w-3.5 h-3.5 text-purple-400" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    data-testid={`button-pdf-${inv.id}`}
                    onClick={() => handleDownloadPDF(inv)}
                    disabled={downloadingId === inv.id}
                    title={t("Télécharger PDF", "Download PDF")}
                  >
                    <FileDown className="w-3.5 h-3.5 text-blue-400" />
                  </Button>
                  <AttachmentButton
                    linkEndpoint={`/api/supplier-invoices/${inv.id}/attachment`}
                    currentPath={(inv as any).attachmentPath}
                    currentName={(inv as any).attachmentName}
                    onUploaded={() => qc.invalidateQueries({ queryKey: ["/api/supplier-invoices"] })}
                    size="icon"
                    variant="ghost"
                  />
                  <Button variant="ghost" size="sm" data-testid={`button-edit-${inv.id}`} onClick={() => { setEditing(inv); setOpen(true); }}>
                    <Edit className="w-3.5 h-3.5" />
                  </Button>
                  <ConfirmDelete
                    onConfirm={() => deleteMutation.mutate(inv.id)}
                    isPending={deleteMutation.isPending}
                    description={`Supprimer la facture fournisseur « ${inv.number} » de ${inv.supplierName} ? Cette action est irréversible.`}
                    testId={`button-delete-${inv.id}`}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
