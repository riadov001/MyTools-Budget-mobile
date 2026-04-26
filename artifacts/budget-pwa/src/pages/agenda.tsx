import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AttachmentButton } from "@/components/AttachmentButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Calendar, ChevronLeft, ChevronRight, FileText, Receipt,
  CreditCard, Wallet, ShoppingCart, AlertTriangle, Clock, CheckCircle,
  CalendarPlus, Upload, Trash2, Edit3, Link2, BadgeCheck,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, isToday, isBefore, isAfter } from "date-fns";
import { fr as frLocale, enUS } from "date-fns/locale";
import { Link } from "wouter";

type AgendaEvent = {
  id: string;
  title: string;
  date: string;
  type: "invoice" | "supplier_invoice" | "expense" | "service" | "payment" | "appointment";
  amount: number;
  status: string;
  direction?: string;
  entityId: number;
};

type Appointment = {
  id: number;
  title: string;
  description: string | null;
  location: string | null;
  startDate: string;
  endDate: string | null;
  source: "manual" | "ical" | "google";
  externalUid: string | null;
  amount: string | null;
  direction: "income" | "expense";
  status: "pending" | "paid" | "validated" | "overdue" | "cancelled";
  paidAt: string | null;
  notes: string | null;
};

const TYPE_CONFIG: Record<string, { label: string; labelEn: string; icon: React.ElementType; color: string; bgColor: string; link: string }> = {
  invoice: { label: "Facture client", labelEn: "Client Invoice", icon: FileText, color: "text-blue-400", bgColor: "bg-blue-500/10", link: "/invoices" },
  supplier_invoice: { label: "Facture fournisseur", labelEn: "Supplier Invoice", icon: ShoppingCart, color: "text-orange-400", bgColor: "bg-orange-500/10", link: "/supplier-invoices" },
  expense: { label: "Dépense", labelEn: "Expense", icon: Receipt, color: "text-red-400", bgColor: "bg-red-500/10", link: "/expenses" },
  service: { label: "Abonnement", labelEn: "Service", icon: Wallet, color: "text-purple-400", bgColor: "bg-purple-500/10", link: "/services" },
  payment: { label: "Paiement", labelEn: "Payment", icon: CreditCard, color: "text-green-400", bgColor: "bg-green-500/10", link: "/payments" },
  appointment: { label: "Rendez-vous", labelEn: "Appointment", icon: Calendar, color: "text-pink-400", bgColor: "bg-pink-500/10", link: "/agenda" },
};

const STATUS_ICONS: Record<string, { icon: React.ElementType; color: string }> = {
  paid: { icon: CheckCircle, color: "text-green-500" },
  validated: { icon: BadgeCheck, color: "text-emerald-500" },
  completed: { icon: CheckCircle, color: "text-green-500" },
  active: { icon: Clock, color: "text-blue-400" },
  overdue: { icon: AlertTriangle, color: "text-red-500" },
  unpaid: { icon: Clock, color: "text-yellow-500" },
  pending: { icon: Clock, color: "text-yellow-500" },
  sent: { icon: Clock, color: "text-blue-400" },
  draft: { icon: Clock, color: "text-gray-400" },
  cancelled: { icon: AlertTriangle, color: "text-gray-500" },
};

function toLocalInput(d: string | Date | null): string {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

export function Agenda() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const lang = user?.language ?? "fr";
  const t = (f: string, e: string) => lang === "en" ? e : f;
  const locale = lang === "fr" ? frLocale : enUS;

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [appointmentDialogOpen, setAppointmentDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [editingAppt, setEditingAppt] = useState<Appointment | null>(null);

  const { data: events = [], isLoading } = useQuery<AgendaEvent[]>({ queryKey: ["/api/agenda"] });
  const { data: appointments = [] } = useQuery<Appointment[]>({ queryKey: ["/api/appointments"] });

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

  const upcomingAppts = useMemo(
    () => [...appointments]
      .filter(a => a.status !== "cancelled")
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()),
    [appointments]
  );

  // ─── Mutations ─────────────────────────────────────────────────────────
  const saveAppt = useMutation({
    mutationFn: (data: any) => editingAppt
      ? apiRequest("PATCH", `/api/appointments/${editingAppt.id}`, data)
      : apiRequest("POST", "/api/appointments", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/appointments"] });
      qc.invalidateQueries({ queryKey: ["/api/agenda"] });
      qc.invalidateQueries({ queryKey: ["/api/analytics/dashboard"] });
      toast({ title: t("Enregistré", "Saved") });
      setAppointmentDialogOpen(false);
      setEditingAppt(null);
    },
    onError: (e: any) => toast({ title: t("Erreur", "Error"), description: e?.message, variant: "destructive" }),
  });

  const deleteAppt = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/appointments/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/appointments"] });
      qc.invalidateQueries({ queryKey: ["/api/agenda"] });
      qc.invalidateQueries({ queryKey: ["/api/analytics/dashboard"] });
      toast({ title: t("Supprimé", "Deleted") });
    },
  });

  const importIcal = useMutation({
    mutationFn: async (data: any) => {
      const r = await apiRequest("POST", "/api/appointments/import", data);
      return r.json();
    },
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ["/api/appointments"] });
      qc.invalidateQueries({ queryKey: ["/api/agenda"] });
      toast({
        title: t("Import iCal terminé", "iCal import done"),
        description: t(`${r.created} créés, ${r.updated} mis à jour`, `${r.created} created, ${r.updated} updated`),
      });
      setImportDialogOpen(false);
    },
    onError: (e: any) => toast({ title: t("Erreur d'import", "Import error"), description: e?.message, variant: "destructive" }),
  });

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
            {t("Échéances, paiements, rendez-vous", "Deadlines, payments, appointments")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)} data-testid="button-import-ical">
            <Upload className="w-4 h-4 mr-1.5" />
            {t("Importer iCal", "Import iCal")}
          </Button>
          <Button size="sm" onClick={() => { setEditingAppt(null); setAppointmentDialogOpen(true); }} data-testid="button-new-appointment">
            <CalendarPlus className="w-4 h-4 mr-1.5" />
            {t("Nouveau RDV", "New event")}
          </Button>
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
          { key: "appointment", label: t("Rendez-vous", "Appointments") },
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
                        {dayEvents.slice(0, 3).map(ev => (
                          <div key={ev.id} className="w-1.5 h-1.5 rounded-full" style={{
                            backgroundColor: hasOverdue && (ev.status === "overdue" || ev.status === "unpaid")
                              ? "#ef4444"
                              : ev.type === "invoice" ? "#60a5fa"
                              : ev.type === "supplier_invoice" ? "#fb923c"
                              : ev.type === "expense" ? "#f87171"
                              : ev.type === "service" ? "#a78bfa"
                              : ev.type === "appointment" ? "#f472b6"
                              : "#4ade80"
                          }} />
                        ))}
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
                    const isAppt = ev.type === "appointment";
                    const appt = isAppt ? appointments.find(a => a.id === ev.entityId) : undefined;
                    const node = (
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer" data-testid={`agenda-event-${ev.id}`}>
                        <div className={`w-9 h-9 rounded-lg ${cfg.bgColor} flex items-center justify-center flex-shrink-0`}>
                          <Icon className={`w-4 h-4 ${cfg.color}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">{ev.title}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground">{format(new Date(ev.date), "dd MMM HH:mm", { locale })}</span>
                            <StatusIcon className={`w-3 h-3 ${statusCfg.color}`} />
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className={`font-bold text-sm ${isAppt && ev.direction === "inbound" ? "text-green-500" : isAppt && ev.direction === "outbound" ? "text-red-500" : ""}`}>
                            {isAppt && ev.direction === "inbound" ? "+" : isAppt && ev.direction === "outbound" ? "−" : ""}{ev.amount.toFixed(2)} €
                          </div>
                          <Badge variant="outline" className={`text-[10px] ${cfg.color} border-current/20`}>
                            {t(cfg.label, cfg.labelEn)}
                          </Badge>
                        </div>
                      </div>
                    );
                    return isAppt && appt ? (
                      <div key={ev.id} onClick={() => { setEditingAppt(appt); setAppointmentDialogOpen(true); }}>
                        {node}
                      </div>
                    ) : (
                      <Link key={ev.id} href={cfg.link}>{node}</Link>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>

          {upcomingAppts.length > 0 && (
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-pink-400" />
                  {t("Tous les rendez-vous", "All appointments")} ({appointments.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5 max-h-[300px] overflow-y-auto custom-scrollbar">
                  {upcomingAppts.map(ap => (
                    <div key={ap.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/10 hover:bg-muted/30 transition-colors" data-testid={`appt-row-${ap.id}`}>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium truncate flex items-center gap-1.5">
                          {ap.source === "ical" && <Link2 className="w-3 h-3 text-cyan-400" />}
                          {ap.title}
                        </div>
                        <div className="text-[10px] text-muted-foreground">{format(new Date(ap.startDate), "dd MMM HH:mm", { locale })}{ap.amount ? ` · ${ap.amount} €` : ""}</div>
                      </div>
                      <Badge variant="outline" className={`text-[9px] ${
                        ap.status === "paid" ? "text-green-500 border-green-500/30"
                        : ap.status === "validated" ? "text-emerald-500 border-emerald-500/30"
                        : ap.status === "overdue" ? "text-red-500 border-red-500/30"
                        : ap.status === "cancelled" ? "text-gray-500 border-gray-500/30"
                        : "text-yellow-500 border-yellow-500/30"
                      }`}>
                        {ap.status === "paid" ? t("Payé", "Paid")
                          : ap.status === "validated" ? t("Validé", "Validated")
                          : ap.status === "overdue" ? t("Retard", "Overdue")
                          : ap.status === "cancelled" ? t("Annulé", "Cancelled")
                          : t("À faire", "Pending")}
                      </Badge>
                      <AttachmentButton
                        linkEndpoint={`/api/appointments/${ap.id}/attachment`}
                        currentPath={(ap as any).attachmentPath}
                        currentName={(ap as any).attachmentName}
                        onUploaded={() => qc.invalidateQueries({ queryKey: ["/api/appointments"] })}
                        size="icon"
                        variant="ghost"
                      />
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditingAppt(ap); setAppointmentDialogOpen(true); }} data-testid={`button-edit-appt-${ap.id}`}>
                        <Edit3 className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => deleteAppt.mutate(ap.id)} data-testid={`button-delete-appt-${ap.id}`}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <AppointmentDialog
        open={appointmentDialogOpen}
        onOpenChange={(o) => { setAppointmentDialogOpen(o); if (!o) setEditingAppt(null); }}
        appointment={editingAppt}
        onSave={(data) => saveAppt.mutate(data)}
        saving={saveAppt.isPending}
        t={t}
      />

      <ImportIcalDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImport={(data) => importIcal.mutate(data)}
        importing={importIcal.isPending}
        t={t}
      />
    </div>
  );
}

// ─── Appointment dialog ────────────────────────────────────────────────────
function AppointmentDialog({
  open, onOpenChange, appointment, onSave, saving, t,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  appointment: Appointment | null;
  onSave: (data: any) => void;
  saving: boolean;
  t: (f: string, e: string) => string;
}) {
  const [form, setForm] = useState<any>({});

  useMemo(() => {
    if (open) {
      setForm({
        title: appointment?.title || "",
        description: appointment?.description || "",
        location: appointment?.location || "",
        startDate: toLocalInput(appointment?.startDate || new Date()),
        endDate: appointment?.endDate ? toLocalInput(appointment.endDate) : "",
        amount: appointment?.amount || "",
        direction: appointment?.direction || "income",
        status: appointment?.status || "pending",
        notes: appointment?.notes || "",
      });
    }
  }, [open, appointment]);

  const submit = () => {
    if (!form.title?.trim()) return;
    if (!form.startDate) return;
    const payload: any = {
      title: form.title.trim(),
      description: form.description || null,
      location: form.location || null,
      startDate: new Date(form.startDate).toISOString(),
      endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
      direction: form.direction,
      status: form.status,
      notes: form.notes || null,
    };
    if (form.amount && String(form.amount).trim() !== "") payload.amount = String(form.amount);
    else payload.amount = null;
    onSave(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{appointment ? t("Modifier rendez-vous", "Edit appointment") : t("Nouveau rendez-vous", "New appointment")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="appt-title">{t("Titre", "Title")} *</Label>
            <Input id="appt-title" value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} data-testid="input-appt-title" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="appt-start">{t("Début", "Start")} *</Label>
              <Input id="appt-start" type="datetime-local" value={form.startDate || ""} onChange={(e) => setForm({ ...form, startDate: e.target.value })} data-testid="input-appt-start" />
            </div>
            <div>
              <Label htmlFor="appt-end">{t("Fin (optionnel)", "End (optional)")}</Label>
              <Input id="appt-end" type="datetime-local" value={form.endDate || ""} onChange={(e) => setForm({ ...form, endDate: e.target.value })} data-testid="input-appt-end" />
            </div>
          </div>
          <div>
            <Label htmlFor="appt-loc">{t("Lieu", "Location")}</Label>
            <Input id="appt-loc" value={form.location || ""} onChange={(e) => setForm({ ...form, location: e.target.value })} data-testid="input-appt-location" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label htmlFor="appt-amount">{t("Montant (€)", "Amount (€)")}</Label>
              <Input id="appt-amount" type="number" step="0.01" value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: e.target.value })} data-testid="input-appt-amount" />
            </div>
            <div>
              <Label>{t("Sens", "Direction")}</Label>
              <Select value={form.direction} onValueChange={(v) => setForm({ ...form, direction: v })}>
                <SelectTrigger data-testid="select-appt-direction"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">{t("Revenu", "Income")}</SelectItem>
                  <SelectItem value="expense">{t("Dépense", "Expense")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("Statut", "Status")}</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger data-testid="select-appt-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">{t("À faire", "Pending")}</SelectItem>
                  <SelectItem value="validated">{t("Validé (sans montant)", "Validated (no amount)")}</SelectItem>
                  <SelectItem value="paid">{t("Payé", "Paid")}</SelectItem>
                  <SelectItem value="overdue">{t("En retard", "Overdue")}</SelectItem>
                  <SelectItem value="cancelled">{t("Annulé", "Cancelled")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="appt-notes">{t("Notes", "Notes")}</Label>
            <Textarea id="appt-notes" rows={2} value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} data-testid="textarea-appt-notes" />
          </div>
          <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground space-y-1">
            <p>
              <BadgeCheck className="inline w-3.5 h-3.5 mr-1 text-emerald-500" />
              <strong>{t("Validé", "Validated")}</strong> — {t("RDV terminé sans impact financier (montant vide ou 0).", "Done appointment with no financial impact (amount empty or 0).")}
            </p>
            <p>
              <CheckCircle className="inline w-3.5 h-3.5 mr-1 text-green-500" />
              <strong>{t("Payé", "Paid")}</strong> — {t("Le montant s'ajoute automatiquement au CA ou aux dépenses.", "Amount is automatically added to revenue or expenses.")}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("Annuler", "Cancel")}</Button>
          <Button onClick={submit} disabled={saving} data-testid="button-save-appointment">
            {saving ? t("Enregistrement...", "Saving...") : t("Enregistrer", "Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── iCal import dialog ────────────────────────────────────────────────────
function ImportIcalDialog({
  open, onOpenChange, onImport, importing, t,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onImport: (data: any) => void;
  importing: boolean;
  t: (f: string, e: string) => string;
}) {
  const [mode, setMode] = useState<"url" | "file">("url");
  const [url, setUrl] = useState("");
  const [icsText, setIcsText] = useState("");
  const [direction, setDirection] = useState<"income" | "expense">("income");
  const [defaultAmount, setDefaultAmount] = useState("");

  const handleFile = async (file: File) => {
    const text = await file.text();
    setIcsText(text);
  };

  const submit = () => {
    const payload: any = { defaultDirection: direction };
    if (defaultAmount && defaultAmount.trim() !== "") payload.defaultAmount = defaultAmount;
    if (mode === "url") {
      if (!url.trim()) return;
      payload.url = url.trim();
    } else {
      if (!icsText.trim()) return;
      payload.ics = icsText;
    }
    onImport(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("Importer un calendrier (iCal)", "Import calendar (iCal)")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Button variant={mode === "url" ? "default" : "outline"} size="sm" onClick={() => setMode("url")} data-testid="button-mode-url">URL</Button>
            <Button variant={mode === "file" ? "default" : "outline"} size="sm" onClick={() => setMode("file")} data-testid="button-mode-file">{t("Fichier .ics", ".ics file")}</Button>
          </div>
          {mode === "url" ? (
            <div>
              <Label htmlFor="ical-url">{t("URL iCal (Google, Outlook, etc.)", "iCal URL (Google, Outlook, etc.)")}</Label>
              <Input id="ical-url" placeholder="https://calendar.google.com/calendar/ical/.../basic.ics" value={url} onChange={(e) => setUrl(e.target.value)} data-testid="input-ical-url" />
            </div>
          ) : (
            <div>
              <Label htmlFor="ical-file">{t("Fichier .ics", ".ics file")}</Label>
              <Input id="ical-file" type="file" accept=".ics,text/calendar" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} data-testid="input-ical-file" />
              {icsText && <p className="text-xs text-muted-foreground mt-1">{icsText.length} {t("caractères chargés", "chars loaded")}</p>}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>{t("Sens par défaut", "Default direction")}</Label>
              <Select value={direction} onValueChange={(v: any) => setDirection(v)}>
                <SelectTrigger data-testid="select-import-direction"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">{t("Revenu", "Income")}</SelectItem>
                  <SelectItem value="expense">{t("Dépense", "Expense")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="ical-amount">{t("Montant par défaut (optionnel)", "Default amount (optional)")}</Label>
              <Input id="ical-amount" type="number" step="0.01" value={defaultAmount} onChange={(e) => setDefaultAmount(e.target.value)} data-testid="input-import-amount" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("Tous les RDV importés seront créés en statut « À faire ». Modifie chaque montant individuellement après import si besoin.", "All imported events will be created as Pending. Edit each amount individually after import if needed.")}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("Annuler", "Cancel")}</Button>
          <Button onClick={submit} disabled={importing} data-testid="button-confirm-import">
            {importing ? t("Import en cours...", "Importing...") : t("Importer", "Import")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
