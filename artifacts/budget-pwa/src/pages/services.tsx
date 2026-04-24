import { useState } from "react";
import { useServices, useCreateService, useDeleteService, useUpdateService } from "@/hooks/use-services";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, MoreHorizontal, Server, Edit2, Trash2, TrendingUp, Zap, AlertCircle } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { fr as frLocale } from "date-fns/locale";
import { useAuth } from "@/hooks/use-auth";
import type { Supplier } from "@shared/schema";

function parseVariableCost(notes: string | null): string {
  if (!notes) return "—";
  const match = notes.match(/Variable\s*:\s*([^|]+)/i);
  if (!match) return "—";
  const raw = match[1].trim();
  if (raw.toLowerCase().includes("selon usage") || raw.toLowerCase().includes("selon volume")) return "Selon usage";
  return raw;
}

function parseDescription(notes: string | null): string {
  if (!notes) return "";
  const parts = notes.split("|");
  return parts[0]?.trim() ?? "";
}

export function Services() {
  const { data: services, isLoading } = useServices();
  const createMutation = useCreateService();
  const updateMutation = useUpdateService();
  const deleteMutation = useDeleteService();
  const { user } = useAuth();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

  const { data: suppliers = [] } = useQuery<Supplier[]>({ queryKey: ["/api/suppliers"] });

  const [formData, setFormData] = useState({
    name: "",
    provider: "",
    category: "Infrastructure",
    billingType: "monthly",
    cost: "",
    currency: "EUR",
    nextBillingDate: "",
    status: "active",
    isGlobal: false,
    supplierId: "",
    notes: "",
  });

  const resetForm = () => {
    setFormData({ name: "", provider: "", category: "Infrastructure", billingType: "monthly", cost: "", currency: "EUR", nextBillingDate: "", status: "active", isGlobal: false, supplierId: "", notes: "" });
    setEditingId(null);
  };

  const handleEdit = (service: any) => {
    setFormData({
      name: service.name,
      provider: service.provider ?? "",
      category: service.category ?? "Infrastructure",
      billingType: service.billingType,
      cost: String(service.cost),
      currency: service.currency ?? "EUR",
      nextBillingDate: service.nextBillingDate ? format(new Date(service.nextBillingDate), "yyyy-MM-dd") : "",
      status: service.status,
      isGlobal: service.isGlobal,
      supplierId: service.supplierId?.toString() ?? "",
      notes: service.notes ?? "",
    });
    setEditingId(service.id);
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...formData,
      cost: formData.cost,
      nextBillingDate: formData.nextBillingDate ? new Date(formData.nextBillingDate) : new Date(),
      supplierId: formData.supplierId && formData.supplierId !== "0" ? parseInt(formData.supplierId) : null,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload }, { onSuccess: () => { setIsDialogOpen(false); resetForm(); } });
    } else {
      createMutation.mutate(payload as any, { onSuccess: () => { setIsDialogOpen(false); resetForm(); } });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":    return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20">Actif</Badge>;
      case "paused":    return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20">Suspendu</Badge>;
      case "cancelled": return <Badge variant="outline" className="text-muted-foreground border-border/50">Résilié</Badge>;
      default:          return <Badge variant="outline">{status}</Badge>;
    }
  };

  const activeServices = services?.filter(s => s.status === "active") ?? [];
  const totalFixedMonthly = activeServices.reduce((sum, s) => sum + Number(s.cost), 0);
  const infraCount = activeServices.filter(s => s.category === "Infrastructure").length;

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Services & Abonnements</h1>
          <p className="text-muted-foreground mt-1">Suivi des coûts fixes et variables de vos services cloud & SaaS.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all" data-testid="button-add-service">
              <Plus className="w-4 h-4 mr-2" />
              Ajouter un service
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[540px] glass-panel border-border/50">
            <DialogHeader>
              <DialogTitle className="font-display text-xl">{editingId ? "Modifier le service" : "Nouveau service"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nom du service</label>
                  <Input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="ex : Plaid" className="bg-background/50" data-testid="input-service-name" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Fournisseur</label>
                  <Input required value={formData.provider} onChange={e => setFormData({ ...formData, provider: e.target.value })} placeholder="ex : Plaid Inc." className="bg-background/50" data-testid="input-service-provider" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Catégorie</label>
                  <Select value={formData.category} onValueChange={v => setFormData({ ...formData, category: v })}>
                    <SelectTrigger className="bg-background/50" data-testid="select-service-category"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Infrastructure">Infrastructure</SelectItem>
                      <SelectItem value="Paiement">Paiement</SelectItem>
                      <SelectItem value="Communication">Communication</SelectItem>
                      <SelectItem value="Hébergement">Hébergement</SelectItem>
                      <SelectItem value="IA">IA & Machine Learning</SelectItem>
                      <SelectItem value="Comptabilité">Comptabilité</SelectItem>
                      <SelectItem value="Autre">Autre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Facturation</label>
                  <Select value={formData.billingType} onValueChange={v => setFormData({ ...formData, billingType: v })}>
                    <SelectTrigger className="bg-background/50" data-testid="select-billing-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Mensuel</SelectItem>
                      <SelectItem value="yearly">Annuel</SelectItem>
                      <SelectItem value="usage">À l'usage</SelectItem>
                      <SelectItem value="one_time">Unique</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Coût fixe mensuel (€)</label>
                  <Input required type="number" step="0.01" value={formData.cost} onChange={e => setFormData({ ...formData, cost: e.target.value })} placeholder="0.00" className="bg-background/50" data-testid="input-service-cost" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Prochaine facture</label>
                  <Input type="date" value={formData.nextBillingDate} onChange={e => setFormData({ ...formData, nextBillingDate: e.target.value })} className="bg-background/50" data-testid="input-next-billing" />
                </div>
              </div>
              {suppliers.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Fournisseur lié (annuaire)</label>
                  <Select value={formData.supplierId} onValueChange={v => setFormData({ ...formData, supplierId: v })}>
                    <SelectTrigger className="bg-background/50" data-testid="select-supplier-link"><SelectValue placeholder="Aucun fournisseur lié" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Aucun</SelectItem>
                      {suppliers.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium">Coût variable & description</label>
                <Textarea
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="ex : Description du service | Variable : 0,30 € par transaction"
                  className="bg-background/50 min-h-[80px] resize-none"
                  data-testid="textarea-service-notes"
                />
                <p className="text-xs text-muted-foreground flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Format : Description | Variable : coût/unité</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Statut</label>
                  <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                    <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Actif</SelectItem>
                      <SelectItem value="paused">Suspendu</SelectItem>
                      <SelectItem value="cancelled">Résilié</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {(user?.role === "SUPER_ADMIN" || user?.role === "ROOT_ADMIN") && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Portée</label>
                    <Select value={formData.isGlobal ? "true" : "false"} onValueChange={v => setFormData({ ...formData, isGlobal: v === "true" })}>
                      <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="false">Application spécifique</SelectItem>
                        <SelectItem value="true">Global (infrastructure partagée)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Annuler</Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="bg-primary text-primary-foreground" data-testid="button-submit-service">
                  {editingId ? "Mettre à jour" : "Ajouter"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="glass-card border-border/50" data-testid="card-total-fixed">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Total fixe mensuel
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <p className="text-2xl font-bold text-foreground">{totalFixedMonthly.toFixed(2)} €</p>
            <p className="text-xs text-muted-foreground mt-1">{activeServices.length} service{activeServices.length > 1 ? "s" : ""} actif{activeServices.length > 1 ? "s" : ""}</p>
          </CardContent>
        </Card>
        <Card className="glass-card border-border/50" data-testid="card-infra-count">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Server className="w-4 h-4 text-blue-400" />
              Services Infrastructure
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <p className="text-2xl font-bold text-foreground">{infraCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Plaid, Mindee, Firebase…</p>
          </CardContent>
        </Card>
        <Card className="glass-card border-border/50" data-testid="card-variable-note">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              Coûts variables
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <p className="text-2xl font-bold text-foreground">Selon usage</p>
            <p className="text-xs text-muted-foreground mt-1">Transactions, SMS, OCR, Mo…</p>
          </CardContent>
        </Card>
      </div>

      {/* Infrastructure breakdown */}
      <Card className="glass-card border-border/50 overflow-hidden">
        <div className="px-6 py-4 border-b border-border/50 bg-accent/20 flex items-center justify-between">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <Server className="w-4 h-4 text-primary" />
            Dépenses / Infrastructure
          </h2>
          <Badge variant="outline" className="text-xs">Mensuel · {format(new Date(), "MMMM yyyy", { locale: frLocale })}</Badge>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-accent/20">
              <TableRow className="border-border/50 hover:bg-transparent">
                <TableHead className="font-medium text-foreground">Service</TableHead>
                <TableHead className="font-medium text-foreground">Description</TableHead>
                <TableHead className="font-medium text-foreground text-right">Coût fixe / mois</TableHead>
                <TableHead className="font-medium text-foreground">Coût variable</TableHead>
                <TableHead className="font-medium text-foreground text-right">Total estimé</TableHead>
                <TableHead className="font-medium text-foreground">Statut</TableHead>
                <TableHead className="font-medium text-foreground">Prochaine facturation</TableHead>
                <TableHead className="text-right font-medium text-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <>{[1,2,3].map(i => (
                  <TableRow key={i}>
                    {[1,2,3,4,5,6,7,8].map(j => (
                      <TableCell key={j}><div className="h-4 bg-muted/50 rounded animate-pulse" /></TableCell>
                    ))}
                  </TableRow>
                ))}</>
              
              ) : services?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12">
                    <div className="flex flex-col items-center justify-center opacity-50">
                      <Server className="w-12 h-12 mb-3" />
                      <p className="text-lg font-medium text-foreground">Aucun service</p>
                      <p className="text-sm">Cliquez sur "Ajouter un service" pour commencer.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {services?.map((service) => (
                    <TableRow key={service.id} className="border-border/50 hover:bg-accent/20 transition-colors" data-testid={`row-service-${service.id}`}>
                      <TableCell>
                        <div className="font-semibold text-foreground">{service.name}</div>
                        <div className="text-xs text-muted-foreground">{service.provider}{service.isGlobal && <span className="text-primary ml-1">(Global)</span>}</div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px]">
                        <span className="line-clamp-2">{parseDescription(service.notes)}</span>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-foreground" data-testid={`text-fixed-cost-${service.id}`}>
                        {Number(service.cost).toFixed(2)} €
                      </TableCell>
                      <TableCell className="text-sm" data-testid={`text-variable-cost-${service.id}`}>
                        <span className={parseVariableCost(service.notes) === "—" ? "text-muted-foreground" : "text-amber-400"}>
                          {parseVariableCost(service.notes)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-bold text-foreground" data-testid={`text-total-cost-${service.id}`}>
                        {Number(service.cost).toFixed(2)} €
                        {parseVariableCost(service.notes) !== "—" && <span className="text-xs text-amber-400 ml-1">+variable</span>}
                      </TableCell>
                      <TableCell>{getStatusBadge(service.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {service.nextBillingDate ? format(new Date(service.nextBillingDate), "d MMM yyyy", { locale: frLocale }) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-accent hover:text-foreground" data-testid={`button-actions-${service.id}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-background/95 backdrop-blur-xl border-border/50">
                            <DropdownMenuItem className="cursor-pointer hover:bg-accent focus:bg-accent" onClick={() => handleEdit(service)}>
                              <Edit2 className="w-4 h-4 mr-2" /> Modifier
                            </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive" onClick={() => setDeleteTarget({ id: service.id, name: service.name })}>
                              <Trash2 className="w-4 h-4 mr-2" /> Supprimer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Total row */}
                  <TableRow className="border-border/50 bg-accent/30 font-bold">
                    <TableCell colSpan={2} className="text-foreground">TOTAL MENSUEL ESTIMÉ</TableCell>
                    <TableCell className="text-right text-primary text-lg" data-testid="text-grand-total-fixed">{totalFixedMonthly.toFixed(2)} €</TableCell>
                    <TableCell className="text-amber-400 text-sm">+ coûts variables</TableCell>
                    <TableCell className="text-right text-primary text-lg">{totalFixedMonthly.toFixed(2)} €</TableCell>
                    <TableCell colSpan={3} />
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* How to add a new service */}
      <Card className="glass-card border-border/50 border-l-4 border-l-primary">
        <CardContent className="p-5">
          <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-primary" />
            Comment ajouter un nouveau service
          </h3>
          <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Cliquez sur <strong className="text-foreground">Ajouter un service</strong> en haut à droite.</li>
            <li>Renseignez le nom, le fournisseur, la catégorie et le <strong className="text-foreground">coût fixe mensuel</strong> (en €).</li>
            <li>Dans le champ <em>Coût variable & description</em>, utilisez le format :<br />
              <code className="bg-accent/50 px-1 rounded text-xs">Description du service | Variable : 0,XX € par unité</code>
            </li>
            <li>Le <strong className="text-foreground">total estimé</strong> = coût fixe + (coût variable × usage estimé). Mettez à jour manuellement le champ si l'usage est connu.</li>
            <li>Cliquez sur <strong className="text-foreground">Ajouter</strong> — le service apparaît dans le tableau et le total se met à jour automatiquement.</li>
          </ol>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Supprimer le service « {deleteTarget?.name} » ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
