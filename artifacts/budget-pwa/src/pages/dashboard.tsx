import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import {
  TrendingUp, TrendingDown, FileText, Receipt, CreditCard,
  AlertTriangle, Download, Wallet, ArrowUpRight, ArrowDownRight,
  Server, Mail, FileSpreadsheet, CheckCircle, Clock
} from "lucide-react";
import { format } from "date-fns";
import { fr as frLocale, enUS } from "date-fns/locale";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import type { Expense } from "@shared/schema";

const COLORS = ["#dc2626", "#ef4444", "#f87171", "#fca5a5", "#b91c1c", "#7f1d1d", "#fee2e2", "#fecaca"];
const STATUS_COLORS = { paid: "#22c55e", unpaid: "#eab308", overdue: "#ef4444" };

type DashboardData = {
  monthlyTotal: number;
  yearlyTotal: number;
  activeServices: number;
  upcomingPayments: any[];
  expensesByMonth: { month: string; amount: number }[];
  expensesByCategory: { category: string; amount: number }[];
  expensesByPaymentMethod: { method: string; amount: number }[];
  expensesByApp: { appName: string; amount: number }[];
  burnRate: number;
  projection12Months: number;
  totalRevenue: number;
  totalExpenses: number;
  totalPaid: number;
  totalOutbound: number;
  expensesPaid: number;
  expensesUnpaid: number;
  expensesOverdue: number;
  pendingInvoices: number;
  overdueInvoices: number;
  invoiceCount: number;
  expenseCount: number;
};

function KpiCard({ label, value, sub, icon: Icon, trend, color = "text-foreground", link }: {
  label: string; value: string; sub?: string; icon: React.ElementType;
  trend?: "up" | "down"; color?: string; link?: string;
}) {
  const inner = (
    <Card className="glass-card group cursor-pointer">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${color} group-hover:scale-105 transition-transform origin-left`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 ml-3">
            <Icon className="w-5 h-5 text-primary" />
          </div>
        </div>
        {trend && (
          <div className={`flex items-center gap-1 mt-2 text-xs ${trend === "up" ? "text-green-500" : "text-red-500"}`}>
            {trend === "up" ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            <span>{trend === "up" ? "En hausse" : "En baisse"}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
  return link ? <Link href={link}>{inner}</Link> : inner;
}

export function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const lang = user?.language ?? "fr";
  const t = (f: string, e: string) => lang === "en" ? e : f;
  const locale = lang === "fr" ? frLocale : enUS;
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery<DashboardData>({ queryKey: ["/api/analytics/dashboard"] });
  const { data: expenses = [] } = useQuery<Expense[]>({ queryKey: ["/api/expenses"] });

  const handleExportPDF = async () => {
    const token = localStorage.getItem("token");
    const res = await fetch("/api/export/pdf", { 
      headers: { 
        Authorization: `Bearer ${token}`,
        "x-app-id": user?.applicationId?.toString() ?? "" 
      } 
    });
    if (!res.ok) { toast({ title: t("Erreur PDF", "PDF Error"), variant: "destructive" }); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `rapport-${format(new Date(), "yyyy-MM-dd")}.pdf`;
    document.body.appendChild(a); a.click(); URL.revokeObjectURL(url);
    toast({ title: t("PDF généré", "PDF generated") });
  };

  const handleExportExcel = async () => {
    const token = localStorage.getItem("token");
    const res = await fetch("/api/export/excel", { 
      headers: { 
        Authorization: `Bearer ${token}`,
        "x-app-id": user?.applicationId?.toString() ?? ""
      } 
    });
    if (!res.ok) { toast({ title: t("Erreur Excel", "Excel Error"), variant: "destructive" }); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `export-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
    document.body.appendChild(a); a.click(); URL.revokeObjectURL(url);
    toast({ title: t("Export Excel généré", "Excel export generated") });
  };

  const handleSendEmail = async () => {
    setIsSendingEmail(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/email/report", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: "{}",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      toast({ title: json.message ?? t("Rapport envoyé !", "Report sent!") });
    } catch (err: any) {
      toast({ title: err?.message ?? t("Erreur envoi email", "Email error"), variant: "destructive" });
    } finally {
      setIsSendingEmail(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="h-72 lg:col-span-2 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
        <AlertTriangle className="w-10 h-10 text-red-400" />
        <p className="text-sm font-medium">{t("Impossible de charger le tableau de bord", "Unable to load dashboard")}</p>
        <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-retry-dashboard">{t("Réessayer", "Retry")}</Button>
      </div>
    );
  }

  const d = data ?? {
    monthlyTotal: 0, yearlyTotal: 0, activeServices: 0, upcomingPayments: [],
    expensesByMonth: [], expensesByCategory: [], expensesByPaymentMethod: [], expensesByApp: [],
    burnRate: 0, projection12Months: 0, totalRevenue: 0, totalExpenses: 0,
    totalPaid: 0, totalOutbound: 0, expensesPaid: 0, expensesUnpaid: 0, expensesOverdue: 0,
    pendingInvoices: 0, overdueInvoices: 0, invoiceCount: 0, expenseCount: 0,
  };

  const infraExpenses = expenses.filter(e => e.category === "Infrastructure");
  const infraTotal = infraExpenses.reduce((s, e) => s + parseFloat(e.total as any), 0);

  const expenseStatusData = [
    { name: t("Payées", "Paid"),       value: d.expensesPaid,   color: STATUS_COLORS.paid },
    { name: t("À payer", "Unpaid"),    value: d.expensesUnpaid,  color: STATUS_COLORS.unpaid },
    { name: t("En retard", "Overdue"), value: d.expensesOverdue, color: STATUS_COLORS.overdue },
  ].filter(e => e.value > 0);

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">{t("Tableau de Bord", "Dashboard")}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {t("Vue consolidée de votre activité financière", "Consolidated view of your financial activity")}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap self-start">
          <Button onClick={handleExportExcel} variant="outline" size="sm" className="gap-2" data-testid="button-export-excel">
            <FileSpreadsheet className="w-4 h-4 text-green-500" />
            {t("Excel", "Excel")}
          </Button>
          <Button onClick={handleExportPDF} variant="outline" size="sm" className="gap-2" data-testid="button-export-pdf">
            <Download className="w-4 h-4" />
            {t("PDF", "PDF")}
          </Button>
          <Button onClick={handleSendEmail} variant="outline" size="sm" className="gap-2" disabled={isSendingEmail} data-testid="button-send-email-report">
            <Mail className="w-4 h-4 text-blue-400" />
            {isSendingEmail ? t("Envoi...", "Sending...") : t("Rapport email", "Email report")}
          </Button>
        </div>
      </div>

      {/* Alertes */}
      {d.overdueInvoices > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{d.overdueInvoices} {t("facture(s) client en retard", "overdue client invoice(s)")}</span>
          <Link href="/invoices" className="ml-auto underline text-xs">{t("Voir", "View")}</Link>
        </div>
      )}
      {d.expensesOverdue > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{t("Dépenses en retard :", "Overdue expenses:")} <strong>{d.expensesOverdue.toFixed(2)} €</strong></span>
          <Link href="/expenses" className="ml-auto underline text-xs">{t("Voir", "View")}</Link>
        </div>
      )}

      {/* KPIs Financiers */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">{t("Finances", "Finances")}</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label={t("Revenus encaissés", "Revenue collected")} value={`${d.totalRevenue.toFixed(0)} €`} icon={TrendingUp} color="text-green-500" trend="up" link="/invoices" />
          <KpiCard label={t("Dépenses totales", "Total expenses")} value={`${d.totalExpenses.toFixed(0)} €`} sub={`${d.expenseCount} dépense${d.expenseCount > 1 ? "s" : ""}`} icon={Receipt} color="text-red-500" link="/expenses" />
          <KpiCard label={t("Factures en attente", "Pending invoices")} value={d.pendingInvoices.toString()} icon={FileText} link="/invoices" />
          <KpiCard label={t("Solde net", "Net balance")} value={`${(d.totalRevenue - d.totalExpenses).toFixed(0)} €`} icon={Wallet} color={(d.totalRevenue - d.totalExpenses) >= 0 ? "text-green-500" : "text-red-500"} link="/payments" />
        </div>
      </div>

      {/* KPIs Statut Dépenses */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">{t("Statut des Dépenses", "Expense Status")}</h2>
        <div className="grid grid-cols-3 gap-3">
          <Card className="glass-card border-green-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span className="text-xs text-muted-foreground font-medium">{t("Payées", "Paid")}</span>
              </div>
              <div className="text-xl font-bold text-green-500">{d.expensesPaid.toFixed(2)} €</div>
            </CardContent>
          </Card>
          <Card className="glass-card border-yellow-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                <span className="text-xs text-muted-foreground font-medium">{t("À payer", "Unpaid")}</span>
              </div>
              <div className="text-xl font-bold text-yellow-500">{d.expensesUnpaid.toFixed(2)} €</div>
            </CardContent>
          </Card>
          <Card className="glass-card border-red-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <span className="text-xs text-muted-foreground font-medium">{t("En retard", "Overdue")}</span>
              </div>
              <div className="text-xl font-bold text-red-500">{d.expensesOverdue.toFixed(2)} €</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* KPIs Abonnements */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">{t("Abonnements SaaS", "SaaS Subscriptions")}</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label={t("Coût mensuel", "Monthly cost")} value={`${d.monthlyTotal.toFixed(0)} €`} icon={CreditCard} link="/services" />
          <KpiCard label={t("Projection annuelle", "Annual projection")} value={`${d.projection12Months.toFixed(0)} €`} icon={TrendingUp} link="/services" />
          <KpiCard label={t("Services actifs", "Active services")} value={d.activeServices.toString()} icon={Wallet} link="/services" />
          <KpiCard label={t("Paiements proches", "Upcoming payments")} value={d.upcomingPayments.length.toString()} icon={AlertTriangle} color={d.upcomingPayments.length > 0 ? "text-yellow-500" : "text-foreground"} link="/services" />
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="glass-card lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("Dépenses par mois", "Monthly expenses")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={d.expensesByMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="month" stroke="#666" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#666" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `${v}€`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                    formatter={(v: number) => [`${v.toFixed(2)} €`, t("Montant", "Amount")]}
                  />
                  <Line type="monotone" dataKey="amount" stroke="#dc2626" strokeWidth={2.5} dot={{ r: 4, fill: "#dc2626" }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {/* Statut dépenses donut */}
          <Card className="glass-card">
            <CardHeader className="pb-1">
              <CardTitle className="text-sm">{t("Statut dépenses", "Expense status")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-40 w-full flex flex-col justify-center">
                {expenseStatusData.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height="70%">
                      <PieChart>
                        <Pie data={expenseStatusData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={3} dataKey="value" stroke="none">
                          {expenseStatusData.map((e, i) => <Cell key={i} fill={e.color} />)}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} formatter={(v: number) => `${v.toFixed(2)} €`} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-1 mt-1">
                      {expenseStatusData.map((e, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: e.color }} />
                            <span className="text-muted-foreground">{e.name}</span>
                          </div>
                          <span className="font-medium">{e.value.toFixed(0)} €</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-40">
                    <Receipt className="w-8 h-8 mb-1" />
                    <p className="text-xs">{t("Aucune dépense", "No expenses")}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Catégories donut */}
          <Card className="glass-card">
            <CardHeader className="pb-1">
              <CardTitle className="text-sm">{t("Par catégorie", "By category")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-40 w-full flex flex-col justify-center">
                {d.expensesByCategory.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height="65%">
                      <PieChart>
                        <Pie data={d.expensesByCategory} cx="50%" cy="50%" innerRadius={30} outerRadius={50} paddingAngle={3} dataKey="amount" nameKey="category" stroke="none">
                          {d.expensesByCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} formatter={(v: number) => `${v.toFixed(2)} €`} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="grid grid-cols-2 gap-1 mt-1">
                      {d.expensesByCategory.slice(0, 4).map((e, i) => (
                        <div key={i} className="flex items-center gap-1 text-xs">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          <span className="truncate text-muted-foreground">{e.category}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-40">
                    <Receipt className="w-8 h-8 mb-1" />
                    <p className="text-xs">{t("Aucune dépense", "No expenses")}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Infrastructure Expenses Breakdown */}
      {infraExpenses.length > 0 && (
        <Card className="glass-card border-border/50" data-testid="card-infra-expenses">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Server className="w-4 h-4 text-primary" />
                {t("Dépenses Infrastructure", "Infrastructure Expenses")}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge className="bg-primary/10 text-primary border-primary/20">
                  {infraTotal.toFixed(2)} € / mois
                </Badge>
                <Link href="/expenses"><span className="text-xs text-primary hover:underline cursor-pointer">{t("Tout voir", "See all")}</span></Link>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {infraExpenses.map((exp) => {
                const notes = exp.notes ?? "";
                const variablePart = notes.match(/Variable\s*:\s*([^|]+)/i)?.[1]?.trim();
                return (
                  <div key={exp.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors" data-testid={`row-infra-expense-${exp.id}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Server className="w-4 h-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">{exp.description}</div>
                        <div className="text-xs text-muted-foreground">{exp.supplierName}</div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <div className="font-bold text-sm">{parseFloat(exp.total as any).toFixed(2)} €</div>
                      {variablePart && (
                        <div className="text-xs text-amber-400">+ {variablePart}</div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20 mt-1">
                <span className="font-bold text-sm">{t("Total fixe mensuel", "Monthly fixed total")}</span>
                <span className="font-bold text-primary">{infraTotal.toFixed(2)} €</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upcoming payments */}
      {d.upcomingPayments.length > 0 && (
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{t("Échéances à venir", "Upcoming due dates")}</CardTitle>
              <Link href="/services"><span className="text-xs text-primary hover:underline cursor-pointer">{t("Tout voir", "See all")}</span></Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {d.upcomingPayments.slice(0, 5).map((s: any) => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <CreditCard className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{s.name}</div>
                      <div className="text-xs text-muted-foreground">{s.provider}</div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <div className="font-bold text-sm">{parseFloat(s.cost).toFixed(2)} {s.currency}</div>
                    <div className="text-xs text-muted-foreground">{format(new Date(s.nextBillingDate), "dd MMM", { locale })}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
