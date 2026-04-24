import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import {
  ShieldAlert, Building2, Users, TrendingUp, TrendingDown, Activity,
  CheckCircle, XCircle, FileText, Receipt, ArrowUpRight, RefreshCw,
  Cpu, Mail, CreditCard, ScanLine, Landmark, Key, Globe
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const COLORS = ["#dc2626", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"];

type GlobalStats = {
  totalApps: number;
  totalUsers: number;
  totalRevenue: number;
  totalExpenses: number;
  systemStatus: { resend: boolean; stripe: boolean; mindee: boolean; gemini: boolean; plaid: boolean };
  appsStats: Array<{ app: any; revenue: number; expenses: number; expenseCount: number; invoiceCount: number; userCount: number }>;
  recentExpenses: any[];
  recentInvoices: any[];
};

function StatusDot({ ok }: { ok: boolean }) {
  return <span className={`inline-block w-2 h-2 rounded-full ${ok ? "bg-green-400" : "bg-red-400"}`} />;
}

export function RootAdmin() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading, refetch } = useQuery<GlobalStats>({
    queryKey: ["/api/admin/global-stats"],
    refetchInterval: 30000,
  });

  if (isLoading) return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-72" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );

  if (!data) return null;

  const profit = data.totalRevenue - data.totalExpenses;
  const profitMargin = data.totalRevenue > 0 ? ((profit / data.totalRevenue) * 100).toFixed(1) : "0";
  const chartData = data.appsStats.map(s => ({ name: s.app.name, revenue: s.revenue, expenses: s.expenses, profit: s.revenue - s.expenses }));

  const services = [
    { name: "Resend (Email)", icon: Mail, ok: data.systemStatus.resend },
    { name: "Stripe", icon: CreditCard, ok: data.systemStatus.stripe },
    { name: "Mindee (OCR)", icon: ScanLine, ok: data.systemStatus.mindee },
    { name: "Gemini AI", icon: Cpu, ok: data.systemStatus.gemini },
    { name: "Plaid (Banking)", icon: Landmark, ok: data.systemStatus.plaid },
  ];

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2" data-testid="text-root-admin-title">
            <ShieldAlert className="w-6 h-6 text-primary" />
            Super Dashboard ROOT
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">Visibilité totale sur toutes les applications</p>
        </div>
        <Button variant="outline" onClick={() => refetch()} className="gap-2 self-start" data-testid="button-refresh-stats">
          <RefreshCw className="w-4 h-4" />
          Actualiser
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1"><Building2 className="w-4 h-4 text-blue-400" /><span className="text-xs text-muted-foreground">Applications</span></div>
            <div className="text-2xl font-bold" data-testid="stat-total-apps">{data.totalApps}</div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1"><Users className="w-4 h-4 text-purple-400" /><span className="text-xs text-muted-foreground">Utilisateurs</span></div>
            <div className="text-2xl font-bold" data-testid="stat-total-users">{data.totalUsers}</div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1"><TrendingUp className="w-4 h-4 text-green-400" /><span className="text-xs text-muted-foreground">Revenus totaux</span></div>
            <div className="text-2xl font-bold text-green-400" data-testid="stat-total-revenue">{data.totalRevenue.toFixed(0)} €</div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1"><Activity className="w-4 h-4 text-primary" /><span className="text-xs text-muted-foreground">Bénéfice net</span></div>
            <div className={`text-2xl font-bold ${profit >= 0 ? "text-green-400" : "text-red-400"}`} data-testid="stat-profit">{profit.toFixed(0)} €</div>
            <div className="text-xs text-muted-foreground">Marge : {profitMargin}%</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="glass-card lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Performance par application</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="name" stroke="#666" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#666" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `${v}€`} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} formatter={(v: number) => `${v.toFixed(2)} €`} />
                  <Bar dataKey="revenue" name="Revenus" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="Dépenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Cpu className="w-4 h-4 text-primary" />
              Statut des services
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {services.map(s => (
              <div key={s.name} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                <div className="flex items-center gap-2">
                  <s.icon className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-sm">{s.name}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <StatusDot ok={s.ok} />
                  <span className={`text-xs ${s.ok ? "text-green-400" : "text-red-400"}`}>{s.ok ? "Actif" : "Inactif"}</span>
                </div>
              </div>
            ))}
            <div className="pt-1">
              <Link href="/api-manager">
                <Button variant="outline" className="w-full text-xs gap-1.5 mt-1">
                  <Key className="w-3 h-3" /> Gérer les clés API
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              Applications ({data.appsStats.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.appsStats.map((s, i) => (
              <div key={s.app.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors" data-testid={`row-app-${s.app.id}`}>
                <div className="flex items-center gap-2.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <div>
                    <div className="text-sm font-medium">{s.app.name}</div>
                    <div className="text-[11px] text-muted-foreground">{s.userCount} user{s.userCount !== 1 ? "s" : ""} · {s.invoiceCount} factures · {s.expenseCount} dépenses</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-bold ${(s.revenue - s.expenses) >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {(s.revenue - s.expenses) >= 0 ? "+" : ""}{(s.revenue - s.expenses).toFixed(0)} €
                  </div>
                  <div className="text-[10px] text-muted-foreground">{s.revenue.toFixed(0)} € CA</div>
                </div>
              </div>
            ))}
            {data.appsStats.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Aucune application</p>}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Receipt className="w-4 h-4 text-primary" />
                Dernières dépenses
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {data.recentExpenses.slice(0, 5).map(e => (
                <div key={e.id} className="flex justify-between items-center text-sm py-1 border-b border-border/20 last:border-0">
                  <div>
                    <div className="font-medium truncate max-w-[180px]">{e.description || e.supplierName || "—"}</div>
                    <div className="text-[10px] text-muted-foreground">{e.createdAt ? format(new Date(e.createdAt), "dd/MM/yy", { locale: fr }) : ""} · {e.category}</div>
                  </div>
                  <Badge variant="outline" className="text-red-400 border-red-500/30 text-[10px]">{parseFloat(e.total || "0").toFixed(0)} €</Badge>
                </div>
              ))}
              {data.recentExpenses.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Aucune dépense</p>}
              <Link href="/expenses"><Button variant="outline" className="w-full text-xs mt-2">Voir toutes les dépenses</Button></Link>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                Dernières factures
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {data.recentInvoices.slice(0, 5).map(inv => (
                <div key={inv.id} className="flex justify-between items-center text-sm py-1 border-b border-border/20 last:border-0">
                  <div>
                    <div className="font-medium">{inv.number || `#${inv.id}`}</div>
                    <div className="text-[10px] text-muted-foreground">{inv.clientName} · {inv.status}</div>
                  </div>
                  <Badge variant="outline" className="text-green-400 border-green-500/30 text-[10px]">{parseFloat(inv.total || "0").toFixed(0)} €</Badge>
                </div>
              ))}
              {data.recentInvoices.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Aucune facture</p>}
              <Link href="/invoices"><Button variant="outline" className="w-full text-xs mt-2">Voir toutes les factures</Button></Link>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="glass-card border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><Globe className="w-4 h-4 text-primary" />Accès rapides ROOT_ADMIN</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Applications", href: "/applications", icon: Building2 },
              { label: "Utilisateurs", href: "/users", icon: Users },
              { label: "API Manager", href: "/api-manager", icon: Key },
              { label: "Analyses", href: "/analytics", icon: Activity },
            ].map(item => (
              <Link key={item.href} href={item.href}>
                <Button variant="outline" className="w-full gap-2 justify-start" data-testid={`link-quick-${item.label.toLowerCase()}`}>
                  <item.icon className="w-4 h-4 text-primary" />
                  {item.label}
                </Button>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
