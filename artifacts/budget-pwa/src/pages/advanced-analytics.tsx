import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import {
  TrendingUp, TrendingDown, Building2, DollarSign,
  BarChart3, PieChart as PieIcon, Activity, AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

const COLORS = ["#dc2626", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316", "#6366f1", "#14b8a6"];

type AdvancedData = {
  global: {
    totalRevenue: number;
    totalExpenses: number;
    profit: number;
    activeServices: number;
    appCount: number;
    expensesByMonth: { month: string; amount: number }[];
    revenueByMonth: { month: string; amount: number }[];
    revenueVsExpenses: { month: string; revenue: number; expenses: number }[];
    expensesByCategory: { category: string; amount: number }[];
  };
  perApp: {
    appId: number;
    appName: string;
    revenue: number;
    expenses: number;
    profit: number;
    activeServices: number;
    monthlySvcCost: number;
    invoiceCount: number;
    expenseCount: number;
    paymentCount: number;
    expensesByMonth: { month: string; amount: number }[];
    revenueByMonth: { month: string; amount: number }[];
  }[];
};

export function AdvancedAnalytics() {
  const { user } = useAuth();
  const lang = user?.language ?? "fr";
  const t = (f: string, e: string) => lang === "en" ? e : f;

  const { data, isLoading, isError, refetch } = useQuery<AdvancedData>({ queryKey: ["/api/analytics/advanced"] });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
        <AlertTriangle className="w-10 h-10 text-red-400" />
        <p className="text-sm font-medium">{t("Impossible de charger les analyses", "Unable to load analytics")}</p>
        <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-retry-analytics">{t("Réessayer", "Retry")}</Button>
      </div>
    );
  }

  const d = data ?? { global: { totalRevenue: 0, totalExpenses: 0, profit: 0, activeServices: 0, appCount: 0, expensesByMonth: [], revenueByMonth: [], revenueVsExpenses: [], expensesByCategory: [] }, perApp: [] };

  const profitMargin = d.global.totalRevenue > 0 ? ((d.global.profit / d.global.totalRevenue) * 100) : 0;

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2" data-testid="text-analytics-title">
            <BarChart3 className="w-6 h-6 text-primary" />
            {t("Analyses Avancées", "Advanced Analytics")}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {t("Vue consolidée multi-applications", "Consolidated multi-application view")}
          </p>
        </div>
        <Link href="/">
          <Badge variant="outline" className="cursor-pointer hover:bg-muted/50 transition-colors" data-testid="link-back-dashboard">
            {t("Retour au tableau de bord", "Back to dashboard")}
          </Badge>
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <span className="text-xs text-muted-foreground font-medium">{t("Revenus totaux", "Total Revenue")}</span>
            </div>
            <div className="text-xl font-bold text-green-500">{d.global.totalRevenue.toFixed(0)} €</div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="w-4 h-4 text-red-500" />
              <span className="text-xs text-muted-foreground font-medium">{t("Dépenses totales", "Total Expenses")}</span>
            </div>
            <div className="text-xl font-bold text-red-500">{d.global.totalExpenses.toFixed(0)} €</div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground font-medium">{t("Bénéfice net", "Net Profit")}</span>
            </div>
            <div className={`text-xl font-bold ${d.global.profit >= 0 ? "text-green-500" : "text-red-500"}`}>{d.global.profit.toFixed(0)} €</div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-muted-foreground font-medium">{t("Marge", "Margin")}</span>
            </div>
            <div className={`text-xl font-bold ${profitMargin >= 0 ? "text-green-500" : "text-red-500"}`}>{profitMargin.toFixed(1)}%</div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="w-4 h-4 text-purple-400" />
              <span className="text-xs text-muted-foreground font-medium">{t("Applications", "Applications")}</span>
            </div>
            <div className="text-xl font-bold">{d.global.appCount}</div>
            <div className="text-xs text-muted-foreground">{d.global.activeServices} {t("services actifs", "active services")}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              {t("Revenus vs Dépenses", "Revenue vs Expenses")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={d.global.revenueVsExpenses}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="month" stroke="#666" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#666" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `${v}€`} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} formatter={(v: number) => `${v.toFixed(2)} €`} />
                  <Legend />
                  <Area type="monotone" dataKey="revenue" name={t("Revenus", "Revenue")} stroke="#10b981" fill="url(#colorRevenue)" strokeWidth={2} />
                  <Area type="monotone" dataKey="expenses" name={t("Dépenses", "Expenses")} stroke="#ef4444" fill="url(#colorExpenses)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-primary" />
              {t("Dépenses par catégorie", "Expenses by Category")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full flex flex-col">
              {d.global.expensesByCategory.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height="70%">
                    <PieChart>
                      <Pie data={d.global.expensesByCategory} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3} dataKey="amount" nameKey="category" stroke="none">
                        {d.global.expensesByCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} formatter={(v: number) => `${v.toFixed(2)} €`} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="grid grid-cols-2 gap-1 mt-2">
                    {d.global.expensesByCategory.map((e, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-xs">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="truncate text-muted-foreground">{e.category}</span>
                        <span className="ml-auto font-medium">{e.amount.toFixed(0)}€</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-40">
                  <PieIcon className="w-8 h-8 mb-1" />
                  <p className="text-xs">{t("Aucune donnée", "No data")}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("Tendance des dépenses mensuelles", "Monthly Expense Trend")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.global.expensesByMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="month" stroke="#666" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#666" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `${v}€`} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} formatter={(v: number) => `${v.toFixed(2)} €`} />
                  <Bar dataKey="amount" name={t("Dépenses", "Expenses")} fill="#dc2626" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("Tendance des revenus mensuels", "Monthly Revenue Trend")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.global.revenueByMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="month" stroke="#666" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#666" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `${v}€`} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} formatter={(v: number) => `${v.toFixed(2)} €`} />
                  <Bar dataKey="amount" name={t("Revenus", "Revenue")} fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {d.perApp.length > 0 && (
        <>
          <h2 className="text-lg font-bold flex items-center gap-2 pt-2">
            <Building2 className="w-5 h-5 text-primary" />
            {t("Par Application", "Per Application")}
          </h2>

          {d.perApp.length > 1 && (
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t("Comparaison des applications", "Application Comparison")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={d.perApp}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="appName" stroke="#666" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#666" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `${v}€`} />
                      <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} formatter={(v: number) => `${v.toFixed(2)} €`} />
                      <Legend />
                      <Bar dataKey="revenue" name={t("Revenus", "Revenue")} fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expenses" name={t("Dépenses", "Expenses")} fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {d.perApp.map((app, idx) => (
              <Card key={app.appId} className="glass-card" data-testid={`card-app-analytics-${app.appId}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                      {app.appName}
                    </CardTitle>
                    <Badge variant="outline" className={app.profit >= 0 ? "text-green-500 border-green-500/30" : "text-red-500 border-red-500/30"}>
                      {app.profit >= 0 ? "+" : ""}{app.profit.toFixed(0)} €
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div>
                      <div className="text-xs text-muted-foreground">{t("Revenus", "Revenue")}</div>
                      <div className="font-bold text-green-500">{app.revenue.toFixed(0)} €</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">{t("Dépenses", "Expenses")}</div>
                      <div className="font-bold text-red-500">{app.expenses.toFixed(0)} €</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">{t("Services", "Services")}</div>
                      <div className="font-bold">{app.activeServices}</div>
                      <div className="text-[10px] text-muted-foreground">{app.monthlySvcCost.toFixed(0)} €/mois</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-4 text-xs">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <span className="font-medium text-foreground">{app.invoiceCount}</span> {t("factures", "invoices")}
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <span className="font-medium text-foreground">{app.expenseCount}</span> {t("dépenses", "expenses")}
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <span className="font-medium text-foreground">{app.paymentCount}</span> {t("paiements", "payments")}
                    </div>
                  </div>
                  <div className="h-32 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={app.expensesByMonth}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis dataKey="month" stroke="#666" fontSize={9} tickLine={false} axisLine={false} />
                        <YAxis stroke="#666" fontSize={9} tickLine={false} axisLine={false} hide />
                        <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }} formatter={(v: number) => `${v.toFixed(2)} €`} />
                        <Line type="monotone" dataKey="amount" stroke={COLORS[idx % COLORS.length]} strokeWidth={2} dot={{ r: 2 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
