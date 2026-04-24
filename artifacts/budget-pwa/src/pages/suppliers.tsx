import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Edit, Package, Mail, Phone, MapPin, Server } from "lucide-react";
import type { Supplier, Service } from "@shared/schema";

function SupplierForm({ supplier, onClose }: { supplier?: Supplier; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const lang = user?.language ?? "fr";
  const t = (f: string, e: string) => lang === "en" ? e : f;
  const [form, setForm] = useState({
    name: supplier?.name ?? "",
    email: supplier?.email ?? "",
    phone: supplier?.phone ?? "",
    address: supplier?.address ?? "",
    siret: supplier?.siret ?? "",
    vatNumber: supplier?.vatNumber ?? "",
  });
  const mutation = useMutation({
    mutationFn: (data: any) => supplier ? apiRequest("PUT", `/api/suppliers/${supplier.id}`, data) : apiRequest("POST", "/api/suppliers", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/suppliers"] }); toast({ title: t("Fournisseur sauvegardé", "Supplier saved") }); onClose(); },
  });
  return (
    <form onSubmit={e => { e.preventDefault(); mutation.mutate(form); }} className="space-y-4">
      <div>
        <label className="text-xs text-muted-foreground">{t("Nom / Raison sociale", "Name / Company")}</label>
        <Input data-testid="input-supplier-name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-xs text-muted-foreground">Email</label><Input data-testid="input-supplier-email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
        <div><label className="text-xs text-muted-foreground">{t("Téléphone", "Phone")}</label><Input data-testid="input-supplier-phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
      </div>
      <div><label className="text-xs text-muted-foreground">{t("Adresse", "Address")}</label><Input data-testid="input-supplier-address" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-xs text-muted-foreground">SIRET</label><Input data-testid="input-supplier-siret" value={form.siret} onChange={e => setForm({ ...form, siret: e.target.value })} /></div>
        <div><label className="text-xs text-muted-foreground">N° TVA</label><Input data-testid="input-supplier-vat" value={form.vatNumber} onChange={e => setForm({ ...form, vatNumber: e.target.value })} /></div>
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

export function Suppliers() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const lang = user?.language ?? "fr";
  const t = (f: string, e: string) => lang === "en" ? e : f;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | undefined>();
  const [search, setSearch] = useState("");

  const { data: list = [], isLoading } = useQuery<Supplier[]>({ queryKey: ["/api/suppliers"] });
  const { data: allServices = [] } = useQuery<Service[]>({ queryKey: ["/api/services"] });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/suppliers/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/suppliers"] }); },
  });

  const filtered = list.filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()));

  const getLinkedServices = (supplierId: number) =>
    allServices.filter((s: any) => s.supplierId === supplierId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("Fournisseurs", "Suppliers")}</h1>
          <p className="text-muted-foreground text-sm">{t("Carnet d'adresses fournisseurs avec services liés", "Supplier directory with linked services")}</p>
        </div>
        <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) setEditing(undefined); }}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-supplier" className="bg-primary hover:bg-primary/90">
              <Plus className="w-4 h-4 mr-2" />{t("Nouveau fournisseur", "New Supplier")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{editing ? t("Modifier", "Edit") : t("Nouveau fournisseur", "New Supplier")}</DialogTitle></DialogHeader>
            <SupplierForm supplier={editing} onClose={() => { setOpen(false); setEditing(undefined); }} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-3">
        <Input
          data-testid="input-search-supplier"
          placeholder={t("Rechercher...", "Search...")}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <span className="text-sm text-muted-foreground">{filtered.length} {t("fournisseurs", "suppliers")}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {isLoading ? (
          <div className="col-span-3 text-center py-12 text-muted-foreground">{t("Chargement...", "Loading...")}</div>
        ) : filtered.length === 0 ? (
          <div className="col-span-3 text-center py-12 text-muted-foreground flex flex-col items-center gap-2">
            <Package className="w-12 h-12 opacity-20" />
            <span>{t("Aucun fournisseur", "No suppliers")}</span>
          </div>
        ) : filtered.map(supplier => {
          const linkedServices = getLinkedServices(supplier.id);
          return (
            <Card key={supplier.id} data-testid={`card-supplier-${supplier.id}`} className="glass-card">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold truncate">{supplier.name}</div>
                    {supplier.siret && <div className="text-xs text-muted-foreground font-mono mt-0.5">SIRET: {supplier.siret}</div>}
                  </div>
                  <div className="flex gap-1 flex-shrink-0 ml-2">
                    <Button variant="ghost" size="sm" data-testid={`button-edit-supplier-${supplier.id}`} onClick={() => { setEditing(supplier); setOpen(true); }}>
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" data-testid={`button-delete-supplier-${supplier.id}`} onClick={() => deleteMutation.mutate(supplier.id)}>
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </Button>
                  </div>
                </div>

                {/* Contact info */}
                <div className="space-y-1 text-xs text-muted-foreground">
                  {supplier.email && (
                    <div className="flex items-center gap-1.5">
                      <Mail className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{supplier.email}</span>
                    </div>
                  )}
                  {supplier.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3 h-3 flex-shrink-0" />
                      <span>{supplier.phone}</span>
                    </div>
                  )}
                  {supplier.address && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{supplier.address}</span>
                    </div>
                  )}
                </div>

                {/* Linked services */}
                {linkedServices.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border/40">
                    <div className="flex items-center gap-1 text-xs font-semibold text-muted-foreground mb-1.5">
                      <Server className="w-3 h-3" />
                      {t("Services liés", "Linked services")} ({linkedServices.length})
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {linkedServices.map((svc: any) => (
                        <Badge
                          key={svc.id}
                          data-testid={`badge-service-${svc.id}`}
                          className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
                        >
                          {svc.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
