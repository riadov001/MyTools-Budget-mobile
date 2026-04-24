import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Edit, BookOpen } from "lucide-react";
import { format } from "date-fns";
import { fr as frLocale, enUS } from "date-fns/locale";
import type { JournalEntry, Account } from "@shared/schema";

function JournalForm({ entry, accounts, onClose }: { entry?: JournalEntry; accounts: Account[]; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const lang = user?.language ?? "fr";
  const t = (f: string, e: string) => lang === "en" ? e : f;

  const [form, setForm] = useState({
    date: entry?.date ? format(new Date(entry.date), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
    reference: entry?.reference ?? `JRN-${Date.now().toString().slice(-6)}`,
    description: entry?.description ?? "",
    debitAccountCode: entry?.debitAccountCode ?? "",
    creditAccountCode: entry?.creditAccountCode ?? "",
    amount: entry?.amount?.toString() ?? "",
  });

  const mutation = useMutation({
    mutationFn: (data: any) => entry
      ? apiRequest("PUT", `/api/journal/${entry.id}`, data)
      : apiRequest("POST", "/api/journal", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/journal"] }); toast({ title: t("Écriture sauvegardée", "Entry saved") }); onClose(); },
    onError: () => toast({ title: t("Erreur", "Error"), variant: "destructive" }),
  });

  return (
    <form onSubmit={e => { e.preventDefault(); mutation.mutate({ ...form, date: new Date(form.date).toISOString() }); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">{t("Date", "Date")}</label>
          <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">{t("Référence", "Reference")}</label>
          <Input value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} required />
        </div>
      </div>
      <div>
        <label className="text-xs text-muted-foreground">{t("Libellé", "Description")}</label>
        <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">{t("Compte Débit", "Debit Account")}</label>
          <Input
            value={form.debitAccountCode}
            onChange={e => setForm({ ...form, debitAccountCode: e.target.value })}
            placeholder={t("Ex: 512 - Banque", "e.g. 512 - Bank")}
            list="accounts-list"
            required
          />
          <datalist id="accounts-list">
            {accounts.map(a => <option key={a.id} value={a.code}>{a.code} - {a.name}</option>)}
          </datalist>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">{t("Compte Crédit", "Credit Account")}</label>
          <Input
            value={form.creditAccountCode}
            onChange={e => setForm({ ...form, creditAccountCode: e.target.value })}
            placeholder={t("Ex: 411 - Clients", "e.g. 411 - Clients")}
            list="accounts-list"
            required
          />
        </div>
      </div>
      <div>
        <label className="text-xs text-muted-foreground">{t("Montant (€)", "Amount (€)")}</label>
        <Input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required />
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

export function Journal() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const lang = user?.language ?? "fr";
  const t = (f: string, e: string) => lang === "en" ? e : f;
  const locale = lang === "fr" ? frLocale : enUS;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<JournalEntry | undefined>();

  const { data: list = [], isLoading } = useQuery<JournalEntry[]>({ queryKey: ["/api/journal"] });
  const { data: accounts = [] } = useQuery<Account[]>({ queryKey: ["/api/accounts"] });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/journal/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/journal"] }); toast({ title: t("Supprimée", "Deleted") }); },
  });

  const totalDebit = list.reduce((s, e) => s + parseFloat(e.amount as any), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("Journal des Écritures", "Journal Entries")}</h1>
          <p className="text-muted-foreground text-sm">{t("Comptabilité en partie double", "Double-entry bookkeeping")}</p>
        </div>
        <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) setEditing(undefined); }}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90"><Plus className="w-4 h-4 mr-2" />{t("Nouvelle écriture", "New Entry")}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editing ? t("Modifier l'écriture", "Edit Entry") : t("Nouvelle écriture", "New Entry")}</DialogTitle></DialogHeader>
            <JournalForm entry={editing} accounts={accounts} onClose={() => { setOpen(false); setEditing(undefined); }} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card className="glass-card"><CardContent className="p-4"><div className="text-xs text-muted-foreground">{t("Total mouvements", "Total movements")}</div><div className="text-xl font-bold mt-1">{totalDebit.toFixed(2)} €</div></CardContent></Card>
        <Card className="glass-card"><CardContent className="p-4"><div className="text-xs text-muted-foreground">{t("Nb. écritures", "Entries count")}</div><div className="text-xl font-bold mt-1">{list.length}</div></CardContent></Card>
      </div>

      <Card className="glass-card overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("Livre journal", "General Journal")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">{t("Chargement...", "Loading...")}</div>
            ) : list.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground flex flex-col items-center gap-2">
                <BookOpen className="w-12 h-12 opacity-20" />
                <span>{t("Aucune écriture comptable", "No journal entries")}</span>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/20">
                    <th className="text-left p-3 text-muted-foreground font-medium text-xs uppercase">{t("Date", "Date")}</th>
                    <th className="text-left p-3 text-muted-foreground font-medium text-xs uppercase">{t("Réf.", "Ref.")}</th>
                    <th className="text-left p-3 text-muted-foreground font-medium text-xs uppercase">{t("Libellé", "Description")}</th>
                    <th className="text-center p-3 text-muted-foreground font-medium text-xs uppercase">{t("Débit", "Debit")}</th>
                    <th className="text-center p-3 text-muted-foreground font-medium text-xs uppercase">{t("Crédit", "Credit")}</th>
                    <th className="text-right p-3 text-muted-foreground font-medium text-xs uppercase">{t("Montant", "Amount")}</th>
                    <th className="text-right p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {list.map(entry => (
                    <tr key={entry.id} className="border-b border-border/30 hover:bg-muted/10 transition-colors">
                      <td className="p-3 text-muted-foreground text-xs whitespace-nowrap">{format(new Date(entry.date!), "dd/MM/yyyy", { locale })}</td>
                      <td className="p-3 font-mono text-xs text-primary">{entry.reference}</td>
                      <td className="p-3 max-w-[200px] truncate">{entry.description}</td>
                      <td className="p-3 text-center">
                        <span className="inline-block bg-red-500/10 text-red-400 px-2 py-0.5 rounded text-xs font-mono">{entry.debitAccountCode}</span>
                      </td>
                      <td className="p-3 text-center">
                        <span className="inline-block bg-green-500/10 text-green-400 px-2 py-0.5 rounded text-xs font-mono">{entry.creditAccountCode}</span>
                      </td>
                      <td className="p-3 text-right font-bold">{parseFloat(entry.amount as any).toFixed(2)} €</td>
                      <td className="p-3 text-right">
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="sm" onClick={() => { setEditing(entry); setOpen(true); }}><Edit className="w-3 h-3" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(entry.id)}><Trash2 className="w-3 h-3 text-red-400" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
