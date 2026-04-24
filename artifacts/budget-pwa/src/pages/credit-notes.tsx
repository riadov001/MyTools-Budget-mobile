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
import { Plus, Trash2, Edit, RotateCcw, ScanLine } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { fr as frLocale, enUS } from "date-fns/locale";
import type { CreditNote } from "@shared/schema";

const STATUS_MAP: Record<string, { label: string; labelEn: string; color: string }> = {
  issued:    { label: "Émis",    labelEn: "Issued",    color: "bg-blue-500/20 text-blue-400" },
  applied:   { label: "Appliqué", labelEn: "Applied",  color: "bg-green-500/20 text-green-400" },
  cancelled: { label: "Annulé",  labelEn: "Cancelled", color: "bg-gray-500/20 text-gray-400" },
};

function CreditNoteForm({ note, onClose }: { note?: CreditNote; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const lang = user?.language ?? "fr";
  const t = (f: string, e: string) => lang === "en" ? e : f;

  const [form, setForm] = useState({
    number: note?.number ?? `AV-${Date.now().toString().slice(-6)}`,
    clientName: note?.clientName ?? "",
    reason: note?.reason ?? "",
    amount: note?.amount?.toString() ?? "",
    taxAmount: note?.taxAmount?.toString() ?? "0",
    total: note?.total?.toString() ?? "",
    currency: note?.currency ?? "EUR",
    date: note?.date ? format(new Date(note.date), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
    status: note?.status ?? "issued",
  });

  const ht = parseFloat(form.amount) || 0;
  const tva = parseFloat(form.taxAmount) || 0;

  const mutation = useMutation({
    mutationFn: (data: any) => note
      ? apiRequest("PUT", `/api/credit-notes/${note.id}`, data)
      : apiRequest("POST", "/api/credit-notes", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/credit-notes"] }); toast({ title: t("Avoir sauvegardé", "Credit note saved") }); onClose(); },
    onError: () => toast({ title: t("Erreur", "Error"), variant: "destructive" }),
  });

  return (
    <form onSubmit={e => { e.preventDefault(); mutation.mutate({ ...form, amount: ht.toFixed(2), taxAmount: tva.toFixed(2), total: (ht + tva).toFixed(2), date: new Date(form.date).toISOString() }); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">{t("N° Avoir", "Credit Note #")}</label>
          <Input value={form.number} onChange={e => setForm({ ...form, number: e.target.value })} required />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">{t("Client", "Client")}</label>
          <Input value={form.clientName} onChange={e => setForm({ ...form, clientName: e.target.value })} required />
        </div>
      </div>
      <div>
        <label className="text-xs text-muted-foreground">{t("Motif", "Reason")}</label>
        <Input value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">{t("Montant HT (€)", "Amount excl. tax")}</label>
          <Input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">TVA (€)</label>
          <Input type="number" step="0.01" value={form.taxAmount} onChange={e => setForm({ ...form, taxAmount: e.target.value })} />
        </div>
      </div>
      <div className="text-sm text-right font-semibold text-primary">Total TTC: {(ht + tva).toFixed(2)} €</div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">{t("Date", "Date")}</label>
          <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">{t("Statut", "Status")}</label>
          <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(STATUS_MAP).map(([k, v]) => <SelectItem key={k} value={k}>{t(v.label, v.labelEn)}</SelectItem>)}</SelectContent>
          </Select>
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

export function CreditNotes() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const lang = user?.language ?? "fr";
  const t = (f: string, e: string) => lang === "en" ? e : f;
  const locale = lang === "fr" ? frLocale : enUS;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CreditNote | undefined>();

  const { data: list = [], isLoading } = useQuery<CreditNote[]>({ queryKey: ["/api/credit-notes"] });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/credit-notes/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/credit-notes"] }); toast({ title: t("Supprimé", "Deleted") }); },
  });

  const totalIssued = list.filter(n => n.status === "issued").reduce((s, n) => s + parseFloat(n.total as any), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("Avoirs", "Credit Notes")}</h1>
          <p className="text-muted-foreground text-sm">{t("Avoirs et remboursements clients", "Client credits and refunds")}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/ocr-scan" asChild>
            <Button variant="outline" data-testid="button-ocr-credit-note">
              <ScanLine className="w-4 h-4 mr-2" />{t("Scan OCR", "OCR Scan")}
            </Button>
          </Link>
          <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) setEditing(undefined); }}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90" data-testid="button-create-credit-note">
                <Plus className="w-4 h-4 mr-2" />{t("Nouvel avoir", "New Credit Note")}
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editing ? t("Modifier l'avoir", "Edit Credit Note") : t("Nouvel avoir", "New Credit Note")}</DialogTitle></DialogHeader>
            <CreditNoteForm note={editing} onClose={() => { setOpen(false); setEditing(undefined); }} />
          </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card className="glass-card"><CardContent className="p-4"><div className="text-xs text-muted-foreground">{t("Total émis", "Total issued")}</div><div className="text-xl font-bold text-blue-500 mt-1">{totalIssued.toFixed(2)} €</div></CardContent></Card>
        <Card className="glass-card"><CardContent className="p-4"><div className="text-xs text-muted-foreground">{t("Nombre d'avoirs", "Count")}</div><div className="text-xl font-bold mt-1">{list.length}</div></CardContent></Card>
      </div>

      <div className="space-y-2">
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">{t("Chargement...", "Loading...")}</div>
        ) : list.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground flex flex-col items-center gap-2">
            <RotateCcw className="w-12 h-12 opacity-20" />
            <span>{t("Aucun avoir", "No credit notes")}</span>
          </div>
        ) : list.map(note => {
          const cfg = STATUS_MAP[note.status] ?? STATUS_MAP.issued;
          return (
            <div key={note.id} className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-card/50 hover:bg-card/80 transition-colors" data-testid={`row-credit-note-${note.id}`}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                  <RotateCcw className="w-5 h-5 text-blue-500" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold font-mono text-primary truncate">{note.number}</div>
                  <div className="text-sm truncate">{note.clientName}</div>
                  <div className="text-xs text-muted-foreground truncate">{note.reason}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                <div className="text-right">
                  <div className="font-bold">{parseFloat(note.total as any).toFixed(2)} {note.currency}</div>
                  <div className="text-xs text-muted-foreground">{format(new Date(note.date!), "dd MMM yyyy", { locale })}</div>
                </div>
                <Badge className={`${cfg.color} text-xs hidden sm:flex`}>{t(cfg.label, cfg.labelEn)}</Badge>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => { setEditing(note); setOpen(true); }}><Edit className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(note.id)}><Trash2 className="w-3.5 h-3.5 text-red-400" /></Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
