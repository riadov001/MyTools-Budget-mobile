import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Trash2, Edit, Key, Users, BarChart3, Copy, Eye, EyeOff,
  AlertTriangle, CheckCircle, Clock, Activity, Globe, Lock, RefreshCw
} from "lucide-react";
import { format } from "date-fns";
import { fr as frLocale } from "date-fns/locale";
import type { ApiPlan, ApiClient, ApiKey } from "@shared/schema";

// ─── Plan Form ────────────────────────────────────────────────────────────────

function PlanForm({ plan, onClose }: { plan?: ApiPlan; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: plan?.name ?? "",
    description: plan?.description ?? "",
    requestsPerDay: plan?.requestsPerDay?.toString() ?? "1000",
    requestsPerMonth: plan?.requestsPerMonth?.toString() ?? "30000",
    price: plan?.price?.toString() ?? "0",
  });

  const mutation = useMutation({
    mutationFn: (data: any) => plan
      ? apiRequest("PUT", `/api/admin/api-plans/${plan.id}`, data)
      : apiRequest("POST", "/api/admin/api-plans", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/api-plans"] });
      toast({ title: plan ? "Plan mis à jour" : "Plan créé" });
      onClose();
    },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  return (
    <form onSubmit={e => { e.preventDefault(); mutation.mutate({ ...form, requestsPerDay: +form.requestsPerDay, requestsPerMonth: +form.requestsPerMonth }); }} className="space-y-4">
      <div>
        <label className="text-xs text-muted-foreground">Nom du plan</label>
        <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Starter, Pro, Enterprise" required data-testid="input-plan-name" />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Description</label>
        <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Description du plan" data-testid="input-plan-description" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">Requêtes/jour</label>
          <Input type="number" value={form.requestsPerDay} onChange={e => setForm({ ...form, requestsPerDay: e.target.value })} required data-testid="input-plan-requests-day" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Requêtes/mois</label>
          <Input type="number" value={form.requestsPerMonth} onChange={e => setForm({ ...form, requestsPerMonth: e.target.value })} required data-testid="input-plan-requests-month" />
        </div>
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Prix mensuel (€)</label>
        <Input type="number" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} data-testid="input-plan-price" />
      </div>
      <Button type="submit" disabled={mutation.isPending} className="w-full" data-testid="button-save-plan">
        {mutation.isPending ? "Enregistrement..." : plan ? "Mettre à jour" : "Créer le plan"}
      </Button>
    </form>
  );
}

// ─── Client Form ──────────────────────────────────────────────────────────────

function ClientForm({ client, plans, onClose }: { client?: ApiClient; plans: ApiPlan[]; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: client?.name ?? "",
    email: client?.email ?? "",
    companyName: client?.companyName ?? "",
    planId: client?.planId?.toString() ?? "",
    notes: client?.notes ?? "",
  });

  const mutation = useMutation({
    mutationFn: (data: any) => client
      ? apiRequest("PUT", `/api/admin/api-clients/${client.id}`, data)
      : apiRequest("POST", "/api/admin/api-clients", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/api-clients"] });
      toast({ title: client ? "Client mis à jour" : "Client créé" });
      onClose();
    },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  return (
    <form onSubmit={e => { e.preventDefault(); mutation.mutate({ ...form, planId: form.planId ? +form.planId : null }); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">Nom</label>
          <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required data-testid="input-client-name" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Email</label>
          <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required data-testid="input-client-email" />
        </div>
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Entreprise</label>
        <Input value={form.companyName} onChange={e => setForm({ ...form, companyName: e.target.value })} data-testid="input-client-company" />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Plan API</label>
        <Select value={form.planId} onValueChange={v => setForm({ ...form, planId: v })}>
          <SelectTrigger data-testid="select-client-plan"><SelectValue placeholder="Choisir un plan" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sans plan</SelectItem>
            {plans.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name} — {parseFloat(p.price as any).toFixed(0)}€/mois</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Notes</label>
        <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Notes internes" data-testid="input-client-notes" />
      </div>
      <Button type="submit" disabled={mutation.isPending} className="w-full" data-testid="button-save-client">
        {mutation.isPending ? "Enregistrement..." : client ? "Mettre à jour" : "Créer le client"}
      </Button>
    </form>
  );
}

// ─── Key display with copy ───────────────────────────────────────────────────

function RawKeyDisplay({ rawKey }: { rawKey: string }) {
  const [visible, setVisible] = useState(false);
  const { toast } = useToast();
  const copy = () => { navigator.clipboard.writeText(rawKey); toast({ title: "Clé copiée !" }); };
  return (
    <div className="mt-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3">
      <div className="flex items-center gap-2 text-amber-400 text-sm font-semibold">
        <AlertTriangle className="w-4 h-4" />
        Sauvegardez cette clé maintenant — elle ne sera plus affichée
      </div>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-xs bg-black/30 px-3 py-2 rounded-lg font-mono text-amber-300 break-all">
          {visible ? rawKey : "•".repeat(Math.min(rawKey.length, 40))}
        </code>
        <Button variant="ghost" size="icon" onClick={() => setVisible(v => !v)} data-testid="button-toggle-key-visibility">
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </Button>
        <Button variant="ghost" size="icon" onClick={copy} data-testid="button-copy-key">
          <Copy className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── Client Keys Panel ────────────────────────────────────────────────────────

function ClientKeysPanel({ client }: { client: { client: ApiClient; plan: ApiPlan | null } }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [env, setEnv] = useState<"test" | "prod">("test");
  const [keyName, setKeyName] = useState("");
  const [newRawKey, setNewRawKey] = useState<string | null>(null);

  const { data: keys = [] } = useQuery<ApiKey[]>({
    queryKey: ["/api/admin/api-clients", client.client.id, "keys"],
    queryFn: () => apiRequest("GET", `/api/admin/api-clients/${client.client.id}/keys`).then(r => r.json()),
  });

  const createKey = useMutation({
    mutationFn: () => apiRequest("POST", `/api/admin/api-clients/${client.client.id}/keys`, { name: keyName || `Clé ${env}`, environment: env }).then(r => r.json()),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/admin/api-clients", client.client.id, "keys"] });
      setNewRawKey(data.rawKey);
      setKeyName("");
      toast({ title: "Clé API créée" });
    },
    onError: () => toast({ title: "Erreur création clé", variant: "destructive" }),
  });

  const revokeKey = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/api-keys/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/api-clients", client.client.id, "keys"] });
      toast({ title: "Clé révoquée" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Nom de la clé (optionnel)"
          value={keyName}
          onChange={e => setKeyName(e.target.value)}
          className="flex-1"
          data-testid="input-key-name"
        />
        <Select value={env} onValueChange={(v: any) => setEnv(v)}>
          <SelectTrigger className="w-32" data-testid="select-key-env">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="test">Test</SelectItem>
            <SelectItem value="prod">Production</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => createKey.mutate()} disabled={createKey.isPending} data-testid="button-create-key">
          <Plus className="w-4 h-4 mr-1" /> Générer
        </Button>
      </div>

      {newRawKey && <RawKeyDisplay rawKey={newRawKey} />}

      <div className="space-y-2">
        {keys.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm">Aucune clé API pour ce client</div>
        ) : keys.map(k => (
          <div key={k.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/50" data-testid={`row-key-${k.id}`}>
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${k.status === "active" ? "bg-green-500" : "bg-gray-500"}`} />
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{k.name}</div>
                <code className="text-xs text-muted-foreground font-mono">{k.keyPrefix}•••••••••••••</code>
              </div>
            </div>
            <div className="flex items-center gap-2 ml-2 flex-shrink-0">
              <Badge variant="outline" className={k.environment === "prod" ? "border-red-500/50 text-red-400" : "border-blue-500/50 text-blue-400"}>
                {k.environment === "prod" ? <Lock className="w-3 h-3 mr-1" /> : <Globe className="w-3 h-3 mr-1" />}
                {k.environment}
              </Badge>
              <span className="text-xs text-muted-foreground">{k.requestCount} req.</span>
              {k.status === "active" && (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-300" onClick={() => revokeKey.mutate(k.id)} data-testid={`button-revoke-key-${k.id}`}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export function ApiManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const lang = user?.language ?? "fr";
  const t = (f: string, e: string) => lang === "en" ? e : f;
  const [activeClient, setActiveClient] = useState<{ client: ApiClient; plan: ApiPlan | null } | null>(null);

  const { data: plans = [], isLoading: plansLoading } = useQuery<ApiPlan[]>({
    queryKey: ["/api/admin/api-plans"],
    queryFn: () => apiRequest("GET", "/api/admin/api-plans").then(r => r.json()),
  });

  const { data: clients = [], isLoading: clientsLoading } = useQuery<{ client: ApiClient; plan: ApiPlan | null }[]>({
    queryKey: ["/api/admin/api-clients"],
    queryFn: () => apiRequest("GET", "/api/admin/api-clients").then(r => r.json()),
  });

  const { data: stats } = useQuery({
    queryKey: ["/api/admin/api-usage/stats"],
    queryFn: () => apiRequest("GET", "/api/admin/api-usage/stats").then(r => r.json()),
    refetchInterval: 30000,
  });

  const deletePlan = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/api-plans/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/api-plans"] }); toast({ title: "Plan supprimé" }); },
  });

  const deleteClient = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/api-clients/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/api-clients"] }); toast({ title: "Client supprimé" }); },
  });

  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [editPlan, setEditPlan] = useState<ApiPlan | undefined>();
  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const [editClient, setEditClient] = useState<ApiClient | undefined>();

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("Gestion API", "API Manager")}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {t("Gérez les clients API, les plans et les clés d'accès", "Manage API clients, plans and access keys")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href="/api/docs" target="_blank" rel="noopener noreferrer" data-testid="link-api-docs">
              <Globe className="w-4 h-4 mr-1" /> Documentation API
            </a>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Requêtes aujourd'hui", value: stats?.today?.requests ?? 0, icon: Activity, color: "text-blue-400" },
          { label: "Clients actifs", value: stats?.total?.clients ?? 0, icon: Users, color: "text-green-400" },
          { label: "Clés actives", value: stats?.total?.activeKeys ?? 0, icon: Key, color: "text-yellow-400" },
          { label: "Plans disponibles", value: plans.length, icon: BarChart3, color: "text-primary" },
        ].map((s, i) => (
          <Card key={i} className="glass-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
                </div>
                <s.icon className={`w-8 h-8 ${s.color} opacity-40`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="clients">
        <TabsList>
          <TabsTrigger value="clients" data-testid="tab-clients">
            <Users className="w-4 h-4 mr-1" /> {t("Clients", "Clients")} ({clients.length})
          </TabsTrigger>
          <TabsTrigger value="plans" data-testid="tab-plans">
            <BarChart3 className="w-4 h-4 mr-1" /> {t("Plans", "Plans")} ({plans.length})
          </TabsTrigger>
          {activeClient && (
            <TabsTrigger value="keys" data-testid="tab-keys">
              <Key className="w-4 h-4 mr-1" /> Clés — {activeClient.client.name}
            </TabsTrigger>
          )}
        </TabsList>

        {/* ─── Clients Tab ─── */}
        <TabsContent value="clients" className="mt-4">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm text-muted-foreground">{clients.length} client(s) API</span>
            <Dialog open={clientDialogOpen} onOpenChange={open => { setClientDialogOpen(open); if (!open) setEditClient(undefined); }}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={() => setEditClient(undefined)} data-testid="button-new-client">
                  <Plus className="w-4 h-4 mr-1" /> Nouveau client
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{editClient ? "Modifier le client" : "Nouveau client API"}</DialogTitle></DialogHeader>
                <ClientForm
                  client={editClient}
                  plans={plans}
                  onClose={() => { setClientDialogOpen(false); setEditClient(undefined); }}
                />
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-2">
            {clientsLoading ? (
              [...Array(3)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-muted/20 animate-pulse" />)
            ) : clients.length === 0 ? (
              <Card className="glass-card">
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>Aucun client API. Créez-en un pour commencer.</p>
                </CardContent>
              </Card>
            ) : clients.map(({ client, plan }) => (
              <Card key={client.id} className="glass-card hover:border-primary/30 transition-colors cursor-pointer" data-testid={`card-client-${client.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Users className="w-4 h-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">{client.name}</div>
                        <div className="text-xs text-muted-foreground">{client.email} {client.companyName && `· ${client.companyName}`}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {plan && <Badge variant="outline" className="text-xs">{plan.name}</Badge>}
                      <Badge className={client.status === "active" ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-gray-500/20 text-gray-400"}>
                        {client.status === "active" ? <CheckCircle className="w-3 h-3 mr-1" /> : <Clock className="w-3 h-3 mr-1" />}
                        {client.status}
                      </Badge>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setActiveClient({ client, plan }); }} title="Gérer les clés" data-testid={`button-manage-keys-${client.id}`}>
                        <Key className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditClient(client); setClientDialogOpen(true); }} data-testid={`button-edit-client-${client.id}`}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-300" onClick={() => deleteClient.mutate(client.id)} data-testid={`button-delete-client-${client.id}`}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ─── Plans Tab ─── */}
        <TabsContent value="plans" className="mt-4">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm text-muted-foreground">{plans.length} plan(s) API</span>
            <Dialog open={planDialogOpen} onOpenChange={open => { setPlanDialogOpen(open); if (!open) setEditPlan(undefined); }}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={() => setEditPlan(undefined)} data-testid="button-new-plan">
                  <Plus className="w-4 h-4 mr-1" /> Nouveau plan
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{editPlan ? "Modifier le plan" : "Nouveau plan API"}</DialogTitle></DialogHeader>
                <PlanForm
                  plan={editPlan}
                  onClose={() => { setPlanDialogOpen(false); setEditPlan(undefined); }}
                />
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {plansLoading ? (
              [...Array(3)].map((_, i) => <div key={i} className="h-36 rounded-xl bg-muted/20 animate-pulse" />)
            ) : plans.length === 0 ? (
              <Card className="glass-card col-span-full">
                <CardContent className="py-12 text-center text-muted-foreground">
                  <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>Aucun plan API. Créez-en un.</p>
                </CardContent>
              </Card>
            ) : plans.map(plan => (
              <Card key={plan.id} className="glass-card hover:border-primary/30 transition-colors" data-testid={`card-plan-${plan.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{plan.name}</CardTitle>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditPlan(plan); setPlanDialogOpen(true); }} data-testid={`button-edit-plan-${plan.id}`}>
                        <Edit className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={() => deletePlan.mutate(plan.id)} data-testid={`button-delete-plan-${plan.id}`}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {plan.description && <p className="text-xs text-muted-foreground">{plan.description}</p>}
                  <div className="text-2xl font-bold text-primary">{parseFloat(plan.price as any).toFixed(0)}€<span className="text-sm font-normal text-muted-foreground">/mois</span></div>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <div className="flex justify-between"><span>Requêtes/jour</span><span className="font-medium text-foreground">{plan.requestsPerDay?.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span>Requêtes/mois</span><span className="font-medium text-foreground">{plan.requestsPerMonth?.toLocaleString()}</span></div>
                  </div>
                  <Badge className={plan.isActive ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-gray-500/20 text-gray-400"}>
                    {plan.isActive ? "Actif" : "Inactif"}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ─── Keys Tab ─── */}
        {activeClient && (
          <TabsContent value="keys" className="mt-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold">{activeClient.client.name}</h3>
                <p className="text-xs text-muted-foreground">{activeClient.client.email}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setActiveClient(null)} data-testid="button-close-keys">
                ← Retour aux clients
              </Button>
            </div>
            <ClientKeysPanel client={activeClient} />
          </TabsContent>
        )}
      </Tabs>

      {/* API Docs CTA */}
      <Card className="glass-card border-primary/20 bg-primary/5">
        <CardContent className="p-4 flex items-center justify-between gap-4">
          <div>
            <div className="font-semibold text-sm">Documentation Swagger</div>
            <p className="text-xs text-muted-foreground mt-0.5">Accédez à la documentation interactive de l'API REST</p>
          </div>
          <Button size="sm" asChild data-testid="link-swagger-docs">
            <a href="/api/docs" target="_blank" rel="noopener noreferrer">
              <Globe className="w-4 h-4 mr-1" /> Ouvrir Swagger
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
