import { useState } from "react";
import { useApplications, useCreateApplication } from "@/hooks/use-applications";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Building2, Users, Globe } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Badge } from "@/components/ui/badge";

export function Applications() {
  const { user } = useAuth();
  
  if (user?.role !== "SUPER_ADMIN" && user?.role !== "ROOT_ADMIN") {
    return <Redirect to="/" />;
  }

  const { data: apps, isLoading } = useApplications();
  const createMutation = useCreateApplication();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({ name, description }, {
      onSuccess: () => {
        setIsDialogOpen(false);
        setName("");
        setDescription("");
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Gestion des SaaS (Multi-tenant)</h1>
          <p className="text-muted-foreground text-sm font-medium">Isolation des données et gestion des instances</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-red-600 hover:bg-red-700">
              <Plus className="w-4 h-4 mr-2" />
              Nouveau SaaS
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Créer une nouvelle instance SaaS</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nom du SaaS</label>
                <Input required value={name} onChange={e => setName(e.target.value)} placeholder="Ex: MyJantes Pro" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Description</label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Description optionnelle..." className="resize-none h-24" />
              </div>
              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Annuler</Button>
                <Button type="submit" disabled={createMutation.isPending} className="bg-red-600 hover:bg-red-700">
                  Créer l'instance
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <p>Chargement...</p>
        ) : apps?.length === 0 ? (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            Aucun SaaS trouvé.
          </div>
        ) : (
          apps?.map((app) => (
            <Card key={app.id} className="glass-card border-l-4 border-l-red-600">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{app.name}</CardTitle>
                  <Globe className="w-4 h-4 text-muted-foreground opacity-50" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">{app.description || "Aucune description"}</p>
                <div className="flex items-center justify-between pt-4 border-t border-border/50">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Users className="w-3.5 h-3.5" /> <span>Instance isolée</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-tighter">ID: {app.id}</Badge>
                </div>
                <div className="text-[10px] text-muted-foreground mt-2">
                  Créé le : {app.createdAt ? format(new Date(app.createdAt), 'dd MMM yyyy') : '-'}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
