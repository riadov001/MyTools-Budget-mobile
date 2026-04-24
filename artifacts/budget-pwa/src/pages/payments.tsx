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
import { Plus, Edit, CreditCard, ArrowDownLeft, ArrowUpRight, AlertTriangle } from "lucide-react";
import { ConfirmDelete } from "@/components/confirm-delete";
import { format } from "date-fns";
import { fr as frLocale, enUS } from "date-fns/locale";
import type { Payment } from "@shared/schema";

const METHODS: Record<string, { label: string; labelEn: string }> = {
  bank_transfer:  { label: "Virement bancaire", labelEn: "Bank Transfer" },
  card:           { label: "Carte bancaire",    labelEn: "Credit Card" },
  cash:           { label: "Espèces",           labelEn: "Cash" },
  check:          { label: "Chèque",            labelEn: "Check" },
  direct_debit:   { label: "Prélèvement",       labelEn: "Direct Debit" },
};

function PaymentForm({ payment, onClose }: { payment?: Payment; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const lang = user?.language ?? "fr";
  const t = (f: string, e: string) => lang === "en" ? e : f;

  const [form, setForm] = useState({
    reference: payment?.reference ?? `PAY-${Date.now().toString().slice(-6)}`,
    amount: payment?.amount?.toString() ?? "",
    currency: payment?.currency ?? "EUR",
    date: payment?.date ? format(new Date(payment.date), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
    method: payment?.method ?? "bank_transfer",
    direction: payment?.direction ?? "inbound",
    status: payment?.status ?? "completed",
    entityLabel: payment?.entityLabel ?? "",
    notes: payment?.notes ?? "",
  });

  const mutation = useMutation({
    mutationFn: (data: any) => payment
      ? apiRequest("PUT", `/api/payments/${payment.id}`, data)
      : apiRequest("POST", "/api/payments", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/payments"] }); qc.invalidateQueries({ queryKey: ["/api/analytics/dashboard"] }); toast({ title: t("Paiement enregistré", "Payment saved") }); onClose(); },
    onError: () => toast({ title: t("Erreur", "Error"), variant: "destructive" }),
  });

  return (
    <form onSubmit={e => { e.preventDefault(); mutation.mutate({ ...form, date: new Date(form.date).toISOString() }); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">{t("Référence", "Reference")}</label>
          <Input value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} required />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">{t("Sens", "Direction")}</label>
          <Select value={form.direction} onValueChange={v => setForm({ ...form, direction: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="inbound">{t("Encaissement", "Inbound")}</SelectItem>
              <SelectItem value="outbound">{t("Décaissement", "Outbound")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <label className="text-xs text-muted-foreground">{t("Montant", "Amount")}</label>
          <Input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">{t("Devise", "Currency")}</label>
          <Select value={form.currency} onValueChange={v => setForm({ ...form, currency: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="EUR">EUR</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="GBP">GBP</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">{t("Mode de paiement", "Payment method")}</label>
          <Select value={form.method} onValueChange={v => setForm({ ...form, method: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(METHODS).map(([k, v]) => <SelectItem key={k} value={k}>{t(v.label, v.labelEn)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">{t("Date", "Date")}</label>
          <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required />
        </div>
      </div>
      <div>
        <label className="text-xs text-muted-foreground">{t("Libellé / Tiers", "Label / Counterpart")}</label>
        <Input value={form.entityLabel} onChange={e => setForm({ ...form, entityLabel: e.target.value })} />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">{t("Notes", "Notes")}</label>
        <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onClose}>{t("Annuler", "Cancel")}</Button>
        <Button type="submit" disabled={mutation.isPending} className="bg-primary hover:bg-primary/90">
          {mutation.isPending ? t("Sauvegarde...", "Saving...") : t("Enregistrer", "Save")}
        </Button>
      </div>
    </form>
  );
}

export function Payments() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const lang = user?.language ?? "fr";
  const t = (f: string, e: string) => lang === "en" ? e : f;
  const locale = lang === "fr" ? frLocale : enUS;

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Payment | undefined>();
  const [dir, setDir] = useState("all");

  const { data: list = [], isLoading, isError, refetch } = useQuery<Payment[]>({ queryKey: ["/api/payments"] });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/payments/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/payments"] }); qc.invalidateQueries({ queryKey: ["/api/analytics/dashboard"] }); toast({ title: t("Supprimé", "Deleted") }); },
    onError: () => toast({ title: t("Erreur lors de la suppression", "Deletion error"), variant: "destructive" }),
  });

  const filtered = dir === "all" ? list : list.filter(p => p.direction === dir);
  const inbound = list.filter(p => p.direction === "inbound").reduce((s, p) => s + parseFloat(p.amount as any), 0);
  const outbound = list.filter(p => p.direction === "outbound").reduce((s, p) => s + parseFloat(p.amount as any), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("Paiements", "Payments")}</h1>
          <p className="text-muted-foreground text-sm">{t("Encaissements et décaissements", "Inbound and outbound payments")}</p>
        </div>
        <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) setEditing(undefined); }}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90" data-testid="button-create-payment">
              <Plus className="w-4 h-4 mr-2" />{t("Nouveau paiement", "New Payment")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editing ? t("Modifier", "Edit") : t("Nouveau paiement", "New Payment")}</DialogTitle></DialogHeader>
            <PaymentForm payment={editing} onClose={() => { setOpen(false); setEditing(undefined); }} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">{t("Encaissements", "Inbound")}</div>
            <div className="text-xl font-bold text-green-500 mt-1">+{inbound.toFixed(2)} €</div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">{t("Décaissements", "Outbound")}</div>
            <div className="text-xl font-bold text-red-500 mt-1">-{outbound.toFixed(2)} €</div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">{t("Solde net", "Net Balance")}</div>
            <div className={`text-xl font-bold mt-1 ${inbound - outbound >= 0 ? "text-green-500" : "text-red-500"}`}>
              {(inbound - outbound).toFixed(2)} €
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2">
        {[["all", t("Tous", "All")], ["inbound", t("Encaissements", "Inbound")], ["outbound", t("Décaissements", "Outbound")]].map(([v, label]) => (
          <Button key={v} variant={dir === v ? "default" : "outline"} size="sm" onClick={() => setDir(v)} className={dir === v ? "bg-primary" : ""}>{label}</Button>
        ))}
      </div>

      <div className="space-y-2">
        {isError ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-3">
            <AlertTriangle className="w-10 h-10 text-red-400" />
            <p className="text-sm font-medium">{t("Impossible de charger les paiements", "Failed to load payments")}</p>
            <button onClick={() => refetch()} className="text-xs px-3 py-1.5 rounded border border-border hover:bg-accent transition-colors" data-testid="btn-retry-payments">{t("Réessayer", "Retry")}</button>
          </div>
        ) : isLoading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="flex items-center gap-3 p-4 rounded-xl border border-border/50 bg-card/50">
                <div className="w-10 h-10 rounded-full bg-muted/50 animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-28 bg-muted/50 rounded animate-pulse" />
                  <div className="h-3 w-40 bg-muted/50 rounded animate-pulse" />
                </div>
                <div className="h-5 w-24 bg-muted/50 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground flex flex-col items-center gap-2">
            <CreditCard className="w-12 h-12 opacity-20" />
            <span>{t("Aucun paiement", "No payments")}</span>
          </div>
        ) : filtered.map(pay => {
          const isInbound = pay.direction === "inbound";
          return (
            <div key={pay.id} className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-card/50 hover:bg-card/80 transition-colors" data-testid={`row-payment-${pay.id}`}>
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isInbound ? "bg-green-500/10" : "bg-red-500/10"}`}>
                  {isInbound ? <ArrowDownLeft className="w-5 h-5 text-green-500" /> : <ArrowUpRight className="w-5 h-5 text-red-500" />}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold truncate">{pay.reference}</div>
                  <div className="text-xs text-muted-foreground flex flex-wrap gap-2 mt-0.5">
                    <span>{t(METHODS[pay.method]?.label ?? pay.method, METHODS[pay.method]?.labelEn ?? pay.method)}</span>
                    {pay.entityLabel && <span>• {pay.entityLabel}</span>}
                    <span>• {format(new Date(pay.date!), "dd MMM yyyy", { locale })}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                <div className={`font-bold text-lg ${isInbound ? "text-green-500" : "text-red-500"}`}>
                  {isInbound ? "+" : "-"}{parseFloat(pay.amount as any).toFixed(2)} {pay.currency}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => { setEditing(pay); setOpen(true); }}><Edit className="w-3.5 h-3.5" /></Button>
                  <ConfirmDelete
                    onConfirm={() => deleteMutation.mutate(pay.id)}
                    isPending={deleteMutation.isPending}
                    description={`Supprimer le paiement « ${pay.reference} » (${parseFloat(pay.amount as any).toFixed(2)} ${pay.currency}) ? Cette action est irréversible.`}
                    testId={`button-delete-payment-${pay.id}`}
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
