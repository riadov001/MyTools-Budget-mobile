import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Edit, Users } from "lucide-react";
import type { Client } from "@shared/schema";

function ClientForm({ client, onClose }: { client?: Client; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const lang = user?.language ?? "fr";
  const t = (f: string, e: string) => lang === "en" ? e : f;
  const [form, setForm] = useState({ name: client?.name ?? "", email: client?.email ?? "", phone: client?.phone ?? "", address: client?.address ?? "", siret: client?.siret ?? "", vatNumber: client?.vatNumber ?? "" });
  const mutation = useMutation({
    mutationFn: (data: any) => client ? apiRequest("PUT", `/api/clients/${client.id}`, data) : apiRequest("POST", "/api/clients", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/clients"] }); toast({ title: t("Client sauvegardé", "Client saved") }); onClose(); },
  });
  return (
    <form onSubmit={e => { e.preventDefault(); mutation.mutate(form); }} className="space-y-4">
      <div><label className="text-xs text-muted-foreground">{t("Nom / Raison sociale", "Name / Company")}</label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-xs text-muted-foreground">Email</label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
        <div><label className="text-xs text-muted-foreground">{t("Téléphone", "Phone")}</label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
      </div>
      <div><label className="text-xs text-muted-foreground">{t("Adresse", "Address")}</label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-xs text-muted-foreground">SIRET</label><Input value={form.siret} onChange={e => setForm({ ...form, siret: e.target.value })} /></div>
        <div><label className="text-xs text-muted-foreground">N° TVA</label><Input value={form.vatNumber} onChange={e => setForm({ ...form, vatNumber: e.target.value })} /></div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onClose}>{t("Annuler", "Cancel")}</Button>
        <Button type="submit" disabled={mutation.isPending} className="bg-primary hover:bg-primary/90">{mutation.isPending ? t("Sauvegarde...", "Saving...") : t("Sauvegarder", "Save")}</Button>
      </div>
    </form>
  );
}

export function Clients() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const lang = user?.language ?? "fr";
  const t = (f: string, e: string) => lang === "en" ? e : f;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Client | undefined>();
  const [search, setSearch] = useState("");

  const { data: list = [], isLoading } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const deleteMutation = useMutation({ mutationFn: (id: number) => apiRequest("DELETE", `/api/clients/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/clients"] }) });

  const filtered = list.filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.email?.includes(search));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div><h1 className="text-2xl font-bold">{t("Clients", "Clients")}</h1><p className="text-muted-foreground text-sm">{t("Carnet d'adresses clients", "Client address book")}</p></div>
        <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) setEditing(undefined); }}>
          <DialogTrigger asChild><Button className="bg-primary hover:bg-primary/90"><Plus className="w-4 h-4 mr-2" />{t("Nouveau client", "New Client")}</Button></DialogTrigger>
          <DialogContent className="max-w-md"><DialogHeader><DialogTitle>{editing ? t("Modifier", "Edit") : t("Nouveau client", "New Client")}</DialogTitle></DialogHeader><ClientForm client={editing} onClose={() => { setOpen(false); setEditing(undefined); }} /></DialogContent>
        </Dialog>
      </div>
      <div className="flex items-center gap-3">
        <Input placeholder={t("Rechercher...", "Search...")} value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
        <span className="text-sm text-muted-foreground">{filtered.length} {t("clients", "clients")}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {isLoading ? <div className="col-span-3 text-center py-12 text-muted-foreground">{t("Chargement...", "Loading...")}</div>
          : filtered.length === 0 ? <div className="col-span-3 text-center py-12 text-muted-foreground flex flex-col items-center gap-2"><Users className="w-12 h-12 opacity-20" /><span>{t("Aucun client", "No clients")}</span></div>
          : filtered.map(client => (
            <Card key={client.id} className="glass-card" data-testid={`card-client-${client.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <div className="font-bold truncate">{client.name}</div>
                    {client.email && <div className="text-xs text-muted-foreground truncate">{client.email}</div>}
                    {client.phone && <div className="text-xs text-muted-foreground">{client.phone}</div>}
                    {client.siret && <div className="text-xs text-muted-foreground font-mono mt-1">SIRET: {client.siret}</div>}
                  </div>
                  <div className="flex gap-1 flex-shrink-0 ml-2">
                    <Button variant="ghost" size="sm" onClick={() => { setEditing(client); setOpen(true); }}><Edit className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(client.id)}><Trash2 className="w-3.5 h-3.5 text-red-400" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
      </div>
    </div>
  );
}
