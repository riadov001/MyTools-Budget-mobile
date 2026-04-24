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
import { Plus, Trash2, Edit, List } from "lucide-react";
import type { Account } from "@shared/schema";

const TYPES: Record<string, { label: string; labelEn: string; color: string }> = {
  asset:     { label: "Actif",   labelEn: "Asset",     color: "bg-blue-500/20 text-blue-400" },
  liability: { label: "Passif",  labelEn: "Liability", color: "bg-orange-500/20 text-orange-400" },
  equity:    { label: "Capitaux", labelEn: "Equity",   color: "bg-purple-500/20 text-purple-400" },
  revenue:   { label: "Produit", labelEn: "Revenue",   color: "bg-green-500/20 text-green-400" },
  expense:   { label: "Charge",  labelEn: "Expense",   color: "bg-red-500/20 text-red-400" },
};

function AccountForm({ account, onClose }: { account?: Account; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const lang = user?.language ?? "fr";
  const t = (f: string, e: string) => lang === "en" ? e : f;

  const [form, setForm] = useState({
    code: account?.code ?? "",
    name: account?.name ?? "",
    type: account?.type ?? "asset",
    category: account?.category ?? "",
    balance: account?.balance?.toString() ?? "0",
  });

  const mutation = useMutation({
    mutationFn: (data: any) => account
      ? apiRequest("PUT", `/api/accounts/${account.id}`, data)
      : apiRequest("POST", "/api/accounts", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/accounts"] }); toast({ title: t("Compte sauvegardé", "Account saved") }); onClose(); },
    onError: () => toast({ title: t("Erreur", "Error"), variant: "destructive" }),
  });

  return (
    <form onSubmit={e => { e.preventDefault(); mutation.mutate(form); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">{t("Numéro de compte", "Account Code")}</label>
          <Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="Ex: 512" required />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">{t("Intitulé", "Name")}</label>
          <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={t("Ex: Banques", "e.g. Bank accounts")} required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">{t("Type", "Type")}</label>
          <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{t(v.label, v.labelEn)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">{t("Catégorie", "Category")}</label>
          <Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder={t("Ex: Trésorerie", "e.g. Treasury")} />
        </div>
      </div>
      <div>
        <label className="text-xs text-muted-foreground">{t("Solde initial (€)", "Opening balance (€)")}</label>
        <Input type="number" step="0.01" value={form.balance} onChange={e => setForm({ ...form, balance: e.target.value })} />
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

export function Accounts() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const lang = user?.language ?? "fr";
  const t = (f: string, e: string) => lang === "en" ? e : f;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Account | undefined>();
  const [filterType, setFilterType] = useState("all");
  const [search, setSearch] = useState("");

  const { data: list = [], isLoading } = useQuery<Account[]>({ queryKey: ["/api/accounts"] });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/accounts/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/accounts"] }); toast({ title: t("Supprimé", "Deleted") }); },
  });

  const filtered = list.filter(a => {
    const matchType = filterType === "all" || a.type === filterType;
    const matchSearch = !search || a.code.includes(search) || a.name.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  const grouped: Record<string, Account[]> = {};
  filtered.forEach(a => {
    const cat = a.category ?? a.type;
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(a);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("Plan Comptable", "Chart of Accounts")}</h1>
          <p className="text-muted-foreground text-sm">{t("Plan comptable général (PCG)", "General chart of accounts")}</p>
        </div>
        <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) setEditing(undefined); }}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90"><Plus className="w-4 h-4 mr-2" />{t("Nouveau compte", "New Account")}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{editing ? t("Modifier le compte", "Edit Account") : t("Nouveau compte", "New Account")}</DialogTitle></DialogHeader>
            <AccountForm account={editing} onClose={() => { setOpen(false); setEditing(undefined); }} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Input placeholder={t("Rechercher (code, intitulé)...", "Search (code, name)...")} value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
        <div className="flex gap-2 flex-wrap">
          {["all", ...Object.keys(TYPES)].map(type => (
            <Button key={type} variant={filterType === type ? "default" : "outline"} size="sm"
              onClick={() => setFilterType(type)} className={filterType === type ? "bg-primary" : ""}>
              {type === "all" ? t("Tout", "All") : t(TYPES[type]?.label, TYPES[type]?.labelEn)}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">{t("Chargement...", "Loading...")}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground flex flex-col items-center gap-2">
          <List className="w-12 h-12 opacity-20" />
          <span>{t("Aucun compte", "No accounts")}</span>
        </div>
      ) : Object.entries(grouped).map(([cat, accounts]) => (
        <div key={cat}>
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 px-1">{cat}</h3>
          <div className="space-y-1">
            {accounts.map(acc => {
              const cfg = TYPES[acc.type] ?? TYPES.asset;
              return (
                <div key={acc.id} className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-card/40 hover:bg-card/70 transition-colors" data-testid={`row-account-${acc.id}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono font-bold text-primary text-sm w-12 flex-shrink-0">{acc.code}</span>
                    <span className="truncate text-sm">{acc.name}</span>
                    <Badge className={`${cfg.color} text-xs hidden sm:flex flex-shrink-0`}>{t(cfg.label, cfg.labelEn)}</Badge>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                    <span className="font-bold text-sm hidden sm:block">{parseFloat(acc.balance as any).toFixed(2)} €</span>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => { setEditing(acc); setOpen(true); }}><Edit className="w-3 h-3" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(acc.id)}><Trash2 className="w-3 h-3 text-red-400" /></Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
