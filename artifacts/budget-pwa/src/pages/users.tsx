import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useApplications } from "@/hooks/use-applications";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Shield, ShieldAlert, User as UserIcon, Key, Building2, X, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { Redirect } from "wouter";
import type { User, Application } from "@shared/schema";

type UserWithoutPassword = Omit<User, "password">;

function RoleBadge({ role }: { role: string }) {
  if (role === "ROOT_ADMIN") return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 font-normal gap-1"><ShieldAlert className="w-3 h-3" />Root Admin</Badge>;
  if (role === "SUPER_ADMIN") return <Badge className="bg-destructive/10 text-destructive border-destructive/20 font-normal gap-1"><ShieldAlert className="w-3 h-3" />Super Admin</Badge>;
  if (role === "ADMIN") return <Badge className="bg-primary/10 text-primary border-primary/20 font-normal gap-1"><Shield className="w-3 h-3" />Admin</Badge>;
  return <Badge variant="secondary" className="font-normal gap-1"><UserIcon className="w-3 h-3" />Utilisateur</Badge>;
}

function UserFormDialog({
  user,
  applications,
  onClose,
  currentUserRole,
}: {
  user?: UserWithoutPassword;
  applications: Application[];
  onClose: () => void;
  currentUserRole: string;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [form, setForm] = useState({
    name: user?.name ?? "",
    email: user?.email ?? "",
    password: "",
    role: user?.role ?? "USER",
    applicationId: user?.applicationId ? String(user.applicationId) : "",
  });

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      if (user) {
        const res = await apiRequest("PUT", `/api/users/${user.id}`, data);
        return res.json();
      } else {
        const res = await apiRequest("POST", "/api/users", data);
        return res.json();
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: user ? "Utilisateur mis à jour" : "Utilisateur créé" });
      onClose();
    },
    onError: async (err: any) => {
      let msg = "Erreur serveur";
      try { const d = await err?.response?.json?.(); msg = d?.message ?? msg; } catch {}
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = {
      name: form.name,
      email: form.email,
      role: form.role,
      applicationId: form.applicationId ? parseInt(form.applicationId) : undefined,
    };
    if (form.password) payload.password = form.password;
    if (!user && !form.password) {
      toast({ title: "Erreur", description: "Le mot de passe est requis", variant: "destructive" });
      return;
    }
    mutation.mutate(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Nom</label>
          <Input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Prénom Nom" data-testid="input-user-name" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Email</label>
          <Input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="email@exemple.com" data-testid="input-user-email" />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
          {user ? "Nouveau mot de passe (laisser vide pour ne pas changer)" : "Mot de passe"}
        </label>
        <Input
          type="password"
          value={form.password}
          onChange={e => setForm({ ...form, password: e.target.value })}
          placeholder={user ? "••••••••" : "Minimum 6 caractères"}
          required={!user}
          data-testid="input-user-password"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Rôle</label>
          <Select value={form.role} onValueChange={v => setForm({ ...form, role: v })}>
            <SelectTrigger data-testid="select-user-role"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="USER">Utilisateur</SelectItem>
              <SelectItem value="ADMIN">Admin</SelectItem>
              <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
              {currentUserRole === "ROOT_ADMIN" && (
                <SelectItem value="ROOT_ADMIN">Root Admin</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Application principale</label>
          <Select value={form.applicationId} onValueChange={v => setForm({ ...form, applicationId: v })}>
            <SelectTrigger data-testid="select-user-app"><SelectValue placeholder="Choisir..." /></SelectTrigger>
            <SelectContent>
              {applications.map(a => (
                <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex gap-2 justify-end pt-2">
        <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
        <Button type="submit" disabled={mutation.isPending} className="bg-primary hover:bg-primary/90" data-testid="button-save-user">
          {mutation.isPending ? "Sauvegarde..." : user ? "Mettre à jour" : "Créer l'utilisateur"}
        </Button>
      </div>
    </form>
  );
}

function AppAssignmentPanel({ user, applications }: { user: UserWithoutPassword; applications: Application[] }) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: links = [] } = useQuery<any[]>({
    queryKey: [`/api/users/${user.id}/applications`],
  });

  const assignedIds = new Set(links.map((l: any) => l.applicationId));

  const addMutation = useMutation({
    mutationFn: async (appId: number) => {
      const res = await apiRequest("POST", `/api/users/${user.id}/applications`, { applicationId: appId });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/users/${user.id}/applications`] });
      qc.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Application assignée" });
    },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: async (appId: number) => {
      await apiRequest("DELETE", `/api/users/${user.id}/applications/${appId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/users/${user.id}/applications`] });
      qc.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Application retirée" });
    },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  return (
    <div className="mt-4 space-y-3">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-1.5">
        <Building2 className="w-3.5 h-3.5" /> Applications assignées
      </p>
      <div className="flex flex-wrap gap-2">
        {applications.map(app => {
          const assigned = assignedIds.has(app.id);
          return (
            <button
              key={app.id}
              type="button"
              onClick={() => assigned ? removeMutation.mutate(app.id) : addMutation.mutate(app.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                assigned
                  ? "bg-primary/15 border-primary/30 text-primary hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive"
                  : "bg-muted/40 border-border/50 text-muted-foreground hover:bg-primary/10 hover:border-primary/20 hover:text-primary"
              }`}
              data-testid={`toggle-app-${app.id}`}
            >
              {assigned ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
              {app.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Users() {
  const { user: me } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: applications = [] } = useApplications();

  if (me?.role !== "ROOT_ADMIN" && me?.role !== "SUPER_ADMIN" && me?.role !== "ADMIN") {
    return <Redirect to="/" />;
  }

  const isSuperAdmin = me?.role === "SUPER_ADMIN" || me?.role === "ROOT_ADMIN";

  const { data: users = [], isLoading } = useQuery<UserWithoutPassword[]>({
    queryKey: ["/api/users"],
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserWithoutPassword | undefined>();
  const [expandedApps, setExpandedApps] = useState<Set<number>>(new Set());

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/users/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Utilisateur supprimé" });
    },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  const toggleExpand = (id: number) => {
    setExpandedApps(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Gestion des utilisateurs</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {users.length} utilisateur{users.length !== 1 ? "s" : ""}
            {isSuperAdmin ? " — toutes applications" : ""}
          </p>
        </div>
        {isSuperAdmin && (
          <Button onClick={() => setCreateOpen(true)} className="bg-primary hover:bg-primary/90" data-testid="button-create-user">
            <Plus className="w-4 h-4 mr-2" /> Nouvel utilisateur
          </Button>
        )}
      </div>

      <Card className="glass-card border-border/50 overflow-hidden">
        <Table>
          <TableHeader className="bg-accent/30">
            <TableRow className="border-border/50 hover:bg-transparent">
              <TableHead className="font-medium text-foreground">Utilisateur</TableHead>
              <TableHead className="font-medium text-foreground">Email</TableHead>
              <TableHead className="font-medium text-foreground">Rôle</TableHead>
              <TableHead className="font-medium text-foreground">Application principale</TableHead>
              <TableHead className="font-medium text-foreground">Créé le</TableHead>
              {isSuperAdmin && <TableHead className="font-medium text-foreground text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Chargement...</TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <div className="flex flex-col items-center justify-center opacity-50">
                    <UserIcon className="w-12 h-12 mb-3" />
                    <p className="text-lg font-medium">Aucun utilisateur</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              users.map(u => (
                <>
                  <TableRow key={u.id} className="border-border/50 hover:bg-accent/20 transition-colors" data-testid={`row-user-${u.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center font-bold text-xs shrink-0">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium">{u.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{u.email}</TableCell>
                    <TableCell><RoleBadge role={u.role} /></TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {applications.find(a => a.id === u.applicationId)?.name ?? (u.applicationId ? `App #${u.applicationId}` : "—")}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {u.createdAt ? format(new Date(u.createdAt), "dd MMM yyyy") : "—"}
                    </TableCell>
                    {isSuperAdmin && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => toggleExpand(u.id)}
                            title="Gérer les applications"
                            data-testid={`button-apps-${u.id}`}
                          >
                            <Building2 className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
                            {expandedApps.has(u.id) ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </Button>
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => setEditUser(u)}
                            title="Modifier"
                            data-testid={`button-edit-${u.id}`}
                          >
                            <Edit className="w-3.5 h-3.5 text-muted-foreground" />
                          </Button>
                          {u.id !== me?.id && (
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => { if (confirm(`Supprimer ${u.name} ?`)) deleteMutation.mutate(u.id); }}
                              title="Supprimer"
                              data-testid={`button-delete-${u.id}`}
                            >
                              <Trash2 className="w-3.5 h-3.5 text-destructive/70" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                  {isSuperAdmin && expandedApps.has(u.id) && (
                    <TableRow key={`apps-${u.id}`} className="border-border/50 bg-muted/20">
                      <TableCell colSpan={6} className="px-6 py-3">
                        <AppAssignmentPanel user={u} applications={applications} />
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-4 h-4" /> Créer un utilisateur
            </DialogTitle>
          </DialogHeader>
          <UserFormDialog applications={applications} onClose={() => setCreateOpen(false)} currentUserRole={me?.role ?? ""} />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editUser} onOpenChange={o => { if (!o) setEditUser(undefined); }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-4 h-4" /> Modifier {editUser?.name}
            </DialogTitle>
          </DialogHeader>
          {editUser && (
            <UserFormDialog user={editUser} applications={applications} onClose={() => setEditUser(undefined)} currentUserRole={me?.role ?? ""} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
