import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calendar, ChevronLeft, ChevronRight, FileText, Receipt,
  CreditCard, Wallet, ShoppingCart, AlertTriangle, Clock, CheckCircle
} from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, isToday, isBefore, isAfter } from "date-fns";
import { fr as frLocale, enUS } from "date-fns/locale";
import { Link } from "wouter";

type AgendaEvent = {
  id: string;
  title: string;
  date: string;
  type: "invoice" | "supplier_invoice" | "expense" | "service" | "payment";
  amount: number;
  status: string;
  direction?: string;
  entityId: number;
};

const TYPE_CONFIG: Record<string, { label: string; labelEn: string; icon: React.ElementType; color: string; bgColor: string; link: string }> = {
  invoice: { label: "Facture client", labelEn: "Client Invoice", icon: FileText, color: "text-blue-400", bgColor: "bg-blue-500/10", link: "/invoices" },
  supplier_invoice: { label: "Facture fournisseur", labelEn: "Supplier Invoice", icon: ShoppingCart, color: "text-orange-400", bgColor: "bg-orange-500/10", link: "/supplier-invoices" },
  expense: { label: "Dépense", labelEn: "Expense", icon: Receipt, color: "text-red-400", bgColor: "bg-red-500/10", link: "/expenses" },
  service: { label: "Abonnement", labelEn: "Service", icon: Wallet, color: "text-purple-400", bgColor: "bg-purple-500/10", link: "/services" },
  payment: { label: "Paiement", labelEn: "Payment", icon: CreditCard, color: "text-green-400", bgColor: "bg-green-500/10", link: "/payments" },
};

const STATUS_ICONS: Record<string, { icon: React.ElementType; color: string }> = {
  paid: { icon: CheckCircle, color: "text-green-500" },
  completed: { icon: CheckCircle, color: "text-green-500" },
  active: { icon: Clock, color: "text-blue-400" },
  overdue: { icon: AlertTriangle, color: "text-red-500" },
  unpaid: { icon: Clock, color: "text-yellow-500" },
  pending: { icon: Clock, color: "text-yellow-500" },
  sent: { icon: Clock, color: "text-blue-400" },
  draft: { icon: Clock, color: "text-gray-400" },
};

export function Agenda() {
  const { user } = useAuth();
  const lang = user?.language ?? "fr";
  const t = (f: string, e: string) => lang === "en" ? e : f;
  const locale = lang === "fr" ? frLocale : enUS;

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [filterType, setFilterType] = useState<string>("all");

  const { data: events = [], isLoading } = useQuery<AgendaEvent[]>({ queryKey: ["/api/agenda"] });

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const startDay = monthStart.getDay();
  const paddingDays = startDay === 0 ? 6 : startDay - 1;

  const filteredEvents = useMemo(() => {
    return events.filter(e => filterType === "all" || e.type === filterType);
  }, [events, filterType]);

  const eventsForDate = (date: Date) =>
    filteredEvents.filter(e => isSameDay(new Date(e.date), date));

  const selectedEvents = selectedDate
    ? eventsForDate(selectedDate)
    : filteredEvents.filter(e => isSameMonth(new Date(e.date), currentMonth));

  const upcomingEvents = filteredEvents
    .filter(e => isAfter(new Date(e.date), new Date()) || isToday(new Date(e.date)))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 10);

  const overdueEvents = filteredEvents.filter(e => {
    const d = new Date(e.date);
    return isBefore(d, new Date()) && !isToday(d) && (e.status === "unpaid" || e.status === "overdue" || e.status === "pending" || e.status === "sent");
  });

  const totalUpcoming = upcomingEvents.reduce((s, e) => s + e.amount, 0);
  const totalOverdue = overdueEvents.reduce((s, e) => s + e.amount, 0);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="h-96 lg:col-span-2 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-agenda-title">
            <Calendar className="w-6 h-6 text-primary" />
            {t("Agenda", "Agenda")}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {t("Échéances, paiements et événements à venir", "Upcoming deadlines, payments, and events")}
          </p>
        </div>
      </div>

      {overdueEvents.length > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm" data-testid="alert-overdue-events">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{overdueEvents.length} {t("élément(s) en retard", "overdue item(s)")} — <strong>{totalOverdue.toFixed(2)} €</strong></span>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground font-medium">{t("Événements ce mois", "Events this month")}</div>
            <div className="text-xl font-bold mt-1">{filteredEvents.filter(e => isSameMonth(new Date(e.date), currentMonth)).length}</div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground font-medium">{t("À venir", "Upcoming")}</div>
            <div className="text-xl font-bold mt-1 text-blue-400">{upcomingEvents.length}</div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground font-medium">{t("Montant à venir", "Upcoming amount")}</div>
            <div className="text-xl font-bold mt-1 text-primary">{totalUpcoming.toFixed(0)} €</div>
          </CardContent>
        </Card>
        <Card className="glass-card border-red-500/20">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground font-medium">{t("En retard", "Overdue")}</div>
            <div className="text-xl font-bold mt-1 text-red-500">{totalOverdue.toFixed(0)} €</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {[
          { key: "all", label: t("Tous", "All") },
          { key: "invoice", label: t("Factures", "Invoices") },
          { key: "supplier_invoice", label: t("Fourn.", "Suppliers") },
          { key: "expense", label: t("Dépenses", "Expenses") },
          { key: "service", label: t("Abonnements", "Services") },
          { key: "payment", label: t("Paiements", "Payments") },
        ].map(f => (
          <Button key={f.key} variant={filterType === f.key ? "default" : "outline"} size="sm"
            onClick={() => setFilterType(f.key)} className={filterType === f.key ? "bg-primary" : ""}
            data-testid={`button-filter-${f.key}`}>
            {f.label}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="glass-card lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} data-testid="button-prev-month">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <CardTitle className="text-base capitalize">
                {format(currentMonth, "MMMM yyyy", { locale })}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} data-testid="button-next-month">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-px mb-1">
              {(lang === "fr"
                ? ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]
                : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
              ).map(d => (
                <div key={d} className="text-center text-xs text-muted-foreground font-medium py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-px">
              {Array.from({ length: paddingDays }).map((_, i) => (
                <div key={`pad-${i}`} className="h-14 sm:h-20" />
              ))}
              {days.map(day => {
                const dayEvents = eventsForDate(day);
                const hasOverdue = dayEvents.some(e => e.status === "overdue" || e.status === "unpaid");
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => setSelectedDate(isSelected ? null : day)}
                    className={`h-14 sm:h-20 rounded-lg p-1 text-left transition-all relative group ${
                      isSelected ? "bg-primary/20 ring-1 ring-primary" :
                      isToday(day) ? "bg-primary/5 ring-1 ring-primary/30" :
                      "hover:bg-muted/30"
                    }`}
                    data-testid={`calendar-day-${format(day, "yyyy-MM-dd")}`}
                  >
                    <span className={`text-xs font-medium ${isToday(day) ? "text-primary font-bold" : ""}`}>
                      {format(day, "d")}
                    </span>
                    {dayEvents.length > 0 && (
                      <div className="flex flex-wrap gap-0.5 mt-0.5">
                        {dayEvents.slice(0, 3).map(ev => {
                          const cfg = TYPE_CONFIG[ev.type];
                          return (
                            <div key={ev.id} className={`w-1.5 h-1.5 rounded-full ${
                              hasOverdue && (ev.status === "overdue" || ev.status === "unpaid") ? "bg-red-500" : ""
                            }`} style={{ backgroundColor: hasOverdue && (ev.status === "overdue" || ev.status === "unpaid") ? undefined : cfg ? undefined : "#6b7280" }}>
                              {cfg && !(hasOverdue && (ev.status === "overdue" || ev.status === "unpaid")) && (
                                <div className={`w-1.5 h-1.5 rounded-full`} style={{
                                  backgroundColor: ev.type === "invoice" ? "#60a5fa" : ev.type === "supplier_invoice" ? "#fb923c" : ev.type === "expense" ? "#f87171" : ev.type === "service" ? "#a78bfa" : "#4ade80"
                                }} />
                              )}
                            </div>
                          );
                        })}
                        {dayEvents.length > 3 && (
                          <span className="text-[8px] text-muted-foreground">+{dayEvents.length - 3}</span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                {selectedDate
                  ? format(selectedDate, "dd MMMM yyyy", { locale })
                  : t("À venir", "Upcoming")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar">
                {(selectedDate ? selectedEvents : upcomingEvents).length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    {t("Aucun événement", "No events")}
                  </div>
                ) : (
                  (selectedDate ? selectedEvents : upcomingEvents).map(ev => {
                    const cfg = TYPE_CONFIG[ev.type] || TYPE_CONFIG.expense;
                    const Icon = cfg.icon;
                    const statusCfg = STATUS_ICONS[ev.status] || STATUS_ICONS.pending;
                    const StatusIcon = statusCfg.icon;
                    return (
                      <Link key={ev.id} href={cfg.link}>
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer" data-testid={`agenda-event-${ev.id}`}>
                          <div className={`w-9 h-9 rounded-lg ${cfg.bgColor} flex items-center justify-center flex-shrink-0`}>
                            <Icon className={`w-4 h-4 ${cfg.color}`} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate">{ev.title}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-muted-foreground">{format(new Date(ev.date), "dd MMM", { locale })}</span>
                              <StatusIcon className={`w-3 h-3 ${statusCfg.color}`} />
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="font-bold text-sm">{ev.amount.toFixed(2)} €</div>
                            <Badge variant="outline" className={`text-[10px] ${cfg.color} border-current/20`}>
                              {t(cfg.label, cfg.labelEn)}
                            </Badge>
                          </div>
                        </div>
                      </Link>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
