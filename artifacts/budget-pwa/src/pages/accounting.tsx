import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, getAuthToken } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BookOpen, TrendingUp, TrendingDown, FileDown, BarChart3,
  CheckCircle, Clock, AlertTriangle, RefreshCw, Euro,
  Activity, CreditCard, Receipt
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";

const fmt = (n: number | string | undefined | null) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(parseFloat(String(n || "0")));

const fmtDate = (d: Date | string | null) => d ? format(new Date(d), "dd/MM/yyyy", { locale: fr }) : "-";

const authFetch = (url: string) =>
  fetch(url, { headers: { Authorization: `Bearer ${getAuthToken() || ""}` } }).then(r => {
    if (!r.ok) throw new Error(`${r.status}`);
    return r.json();
  });

const currentYear = new Date().getFullYear();
const years = [currentYear, currentYear - 1, currentYear - 2];

// ─── OVERVIEW TAB ──────────────────────────────────────────────────────────────
function ErrorRetry({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-3">
      <AlertTriangle className="w-10 h-10 text-red-400" />
      <p className="text-sm font-medium">{message}</p>
      <button onClick={onRetry} className="text-xs px-3 py-1.5 rounded border border-border hover:bg-accent transition-colors">Réessayer</button>
    </div>
  );
}

function OverviewTab({ year }: { year: number }) {
  const { data: pnl, isLoading: pnlLoading, isError: pnlError, refetch: pnlRefetch } = useQuery<any>({
    queryKey: ["/api/accounting/pnl", year],
    queryFn: () => authFetch(`/api/accounting/pnl?year=${year}`),
  });
  const { data: tva, isLoading: tvaLoading, isError: tvaError, refetch: tvaRefetch } = useQuery<any>({
    queryKey: ["/api/accounting/tva", year, 0],
    queryFn: () => authFetch(`/api/accounting/tva?year=${year}&quarter=0`),
  });
  const { data: cashflow } = useQuery<any>({
    queryKey: ["/api/accounting/cashflow", year],
    queryFn: () => authFetch(`/api/accounting/cashflow?year=${year}`),
  });

  if (pnlLoading || tvaLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  if (pnlError || tvaError) {
    return <ErrorRetry message="Impossible de charger les données comptables" onRetry={() => { pnlRefetch(); tvaRefetch(); }} />;
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <span className="text-xs text-muted-foreground">CA HT</span>
            </div>
            <div className="text-xl font-bold text-emerald-600" data-testid="text-revenue-ht">{fmt(pnl?.revenue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="w-4 h-4 text-rose-500" />
              <span className="text-xs text-muted-foreground">Charges HT</span>
            </div>
            <div className="text-xl font-bold text-rose-500" data-testid="text-expenses-ht">{fmt(pnl?.totalExpenses)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Résultat net</span>
            </div>
            <div className={`text-xl font-bold ${(pnl?.grossProfit || 0) >= 0 ? "text-emerald-600" : "text-rose-500"}`} data-testid="text-net-profit">
              {fmt(pnl?.grossProfit)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <Euro className="w-4 h-4 text-amber-500" />
              <span className="text-xs text-muted-foreground">TVA nette</span>
            </div>
            <div className={`text-xl font-bold ${(tva?.tvaNet || 0) >= 0 ? "text-rose-500" : "text-emerald-600"}`} data-testid="text-tva-net">
              {fmt(tva?.tvaNet)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {(tva?.tvaNet || 0) >= 0 ? "à payer" : "crédit de TVA"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Résultat mensuel {year}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={pnl?.byMonth || []} barSize={10}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 15%)" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v/1000}k`} />
                <Tooltip formatter={(v: any) => fmt(v)} />
                <Bar dataKey="revenue" name="CA" fill="#10b981" radius={[3,3,0,0]} />
                <Bar dataKey="expenses" name="Charges" fill="#f43f5e" radius={[3,3,0,0]} />
                <Bar dataKey="profit" name="Résultat" fill="#3b82f6" radius={[3,3,0,0]} />
                <Legend />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Flux de trésorerie {year}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={cashflow?.byMonth || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 15%)" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v/1000}k`} />
                <Tooltip formatter={(v: any) => fmt(v)} />
                <Line type="monotone" dataKey="inbound" name="Encaissements" stroke="#10b981" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="outbound" name="Décaissements" stroke="#f43f5e" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="net" name="Net" stroke="#3b82f6" strokeWidth={2} dot={false} strokeDasharray="4 2" />
                <Legend />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Expense breakdown */}
      {pnl?.expensesByCategory && pnl.expensesByCategory.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Charges par catégorie</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pnl.expensesByCategory
                .sort((a: any, b: any) => b.amount - a.amount)
                .slice(0, 8)
                .map((item: any) => (
                  <div key={item.category} className="flex items-center gap-3">
                    <div className="w-28 text-xs text-muted-foreground truncate">{item.category}</div>
                    <div className="flex-1">
                      <Progress value={(item.amount / pnl.totalExpenses) * 100} className="h-1.5" />
                    </div>
                    <div className="w-24 text-xs text-right font-medium">{fmt(item.amount)}</div>
                    <div className="w-10 text-xs text-muted-foreground text-right">
                      {pnl.totalExpenses > 0 ? `${((item.amount / pnl.totalExpenses) * 100).toFixed(0)}%` : "-"}
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

// ─── TVA TAB ───────────────────────────────────────────────────────────────────
function TvaTab({ year }: { year: number }) {
  const [quarter, setQuarter] = useState(0);

  const { data: tva, isLoading, isError, refetch } = useQuery<any>({
    queryKey: ["/api/accounting/tva", year, quarter],
    queryFn: () => authFetch(`/api/accounting/tva?year=${year}&quarter=${quarter}`),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={String(quarter)} onValueChange={v => setQuarter(parseInt(v))}>
          <SelectTrigger className="w-40" data-testid="select-quarter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Annuel</SelectItem>
            <SelectItem value="1">T1 (Jan-Mar)</SelectItem>
            <SelectItem value="2">T2 (Avr-Jun)</SelectItem>
            <SelectItem value="3">T3 (Jul-Sep)</SelectItem>
            <SelectItem value="4">T4 (Oct-Déc)</SelectItem>
          </SelectContent>
        </Select>
        {tva && (
          <Badge variant="outline" className={tva.tvaNet >= 0 ? "border-rose-500 text-rose-500" : "border-emerald-500 text-emerald-500"}>
            {tva.status === "à_payer" ? "TVA à reverser" : "Crédit de TVA"}
          </Badge>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
      ) : isError ? (
        <ErrorRetry message="Impossible de charger les données TVA" onRetry={() => refetch()} />
      ) : tva && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground mb-1">Base imposable (CA HT)</div>
              <div className="text-xl font-bold">{fmt(tva.tvaSalesBase)}</div>
              <div className="text-xs text-muted-foreground mt-1">TVA collectée</div>
              <div className="text-lg font-semibold text-rose-500">{fmt(tva.tvaCollectee)}</div>
              <div className="text-[10px] text-muted-foreground">Taux moyen: {tva.tvaSalesBase > 0 ? `${((tva.tvaCollectee / tva.tvaSalesBase) * 100).toFixed(1)}%` : "-"}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground mb-1">Base déductible (Achats HT)</div>
              <div className="text-xl font-bold">{fmt(tva.tvaExpenseBase)}</div>
              <div className="text-xs text-muted-foreground mt-1">TVA déductible</div>
              <div className="text-lg font-semibold text-emerald-600">{fmt(tva.tvaDeductible)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground mb-1">TVA nette</div>
              <div className={`text-2xl font-bold ${tva.tvaNet >= 0 ? "text-rose-500" : "text-emerald-600"}`}>
                {fmt(Math.abs(tva.tvaNet))}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                {tva.tvaNet >= 0 ? "À reverser à l'État" : "Crédit récupérable"}
              </div>
              <div className="mt-3 p-2 rounded bg-muted text-xs">
                TVA collectée − TVA déductible = {fmt(tva.tvaCollectee)} − {fmt(tva.tvaDeductible)} = <span className="font-bold">{fmt(tva.tvaNet)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {tva?.byMonth && tva.byMonth.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">TVA mensuelle</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mois</TableHead>
                  <TableHead className="text-right">TVA collectée</TableHead>
                  <TableHead className="text-right">TVA déductible</TableHead>
                  <TableHead className="text-right">TVA nette</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tva.byMonth.map((row: any) => (
                  <TableRow key={row.month}>
                    <TableCell className="font-medium">{row.month}</TableCell>
                    <TableCell className="text-right text-rose-500">{fmt(row.collectee)}</TableCell>
                    <TableCell className="text-right text-emerald-600">{fmt(row.deductible)}</TableCell>
                    <TableCell className={`text-right font-semibold ${row.net >= 0 ? "text-rose-500" : "text-emerald-600"}`}>{fmt(row.net)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── JOURNAL TAB ──────────────────────────────────────────────────────────────
function JournalTab() {
  const { toast } = useToast();
  const [journalFilter, setJournalFilter] = useState("all");

  const { data: entries = [], isLoading, isError, refetch } = useQuery<any[]>({
    queryKey: ["/api/accounting/entries", journalFilter],
    queryFn: () => {
      const params = journalFilter !== "all" ? `?journal=${journalFilter}` : "";
      return authFetch(`/api/accounting/entries${params}`);
    },
  });

  const validateMut = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/accounting/entries/${id}/validate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/entries"] });
      toast({ title: "Écriture validée" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/accounting/entries/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/entries"] });
      toast({ title: "Écriture supprimée" });
    },
  });

  const journalLabels: Record<string, string> = {
    sales: "Ventes", purchases: "Achats", bank: "Banque", cash: "Caisse", misc: "Divers"
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={journalFilter} onValueChange={setJournalFilter}>
          <SelectTrigger className="w-40" data-testid="select-journal-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les journaux</SelectItem>
            <SelectItem value="sales">Ventes</SelectItem>
            <SelectItem value="purchases">Achats</SelectItem>
            <SelectItem value="bank">Banque</SelectItem>
            <SelectItem value="cash">Caisse</SelectItem>
            <SelectItem value="misc">Divers</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-10 rounded" />)}
        </div>
      ) : isError ? (
        <ErrorRetry message="Impossible de charger les écritures comptables" onRetry={() => refetch()} />
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
          <BookOpen className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm">Aucune écriture comptable</p>
          <p className="text-xs mt-1">Les écritures sont générées automatiquement depuis les factures et dépenses.</p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N°</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Journal</TableHead>
                  <TableHead>Libellé</TableHead>
                  <TableHead className="text-right">Débit</TableHead>
                  <TableHead className="text-right">Crédit</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry: any) => (
                  <TableRow key={entry.id} data-testid={`row-entry-${entry.id}`}>
                    <TableCell className="font-mono text-xs">{entry.entryNumber}</TableCell>
                    <TableCell className="text-sm">{fmtDate(entry.date)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{journalLabels[entry.journal] || entry.journal}</Badge>
                    </TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">{entry.description}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{fmt(entry.totalDebit)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{fmt(entry.totalCredit)}</TableCell>
                    <TableCell>
                      {entry.isValidated ? (
                        <Badge className="bg-emerald-500 text-white text-xs">
                          <CheckCircle className="w-3 h-3 mr-1" />Validé
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs border-amber-500 text-amber-500">
                          <Clock className="w-3 h-3 mr-1" />En attente
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {!entry.isValidated && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-xs"
                            data-testid={`button-validate-${entry.id}`}
                            onClick={() => validateMut.mutate(entry.id)}
                            disabled={validateMut.isPending}
                          >
                            Valider
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── FEC EXPORT TAB ───────────────────────────────────────────────────────────
function FecTab({ year }: { year: number }) {
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`/api/accounting/fec?year=${year}`, {
        headers: { Authorization: `Bearer ${token || ""}` },
      });
      if (!res.ok) throw new Error("Erreur lors de l'export");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `FEC_${year}.txt`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast({ title: `FEC ${year} téléchargé` });
    } catch {
      toast({ title: "Erreur d'export", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
              <FileDown className="w-6 h-6 text-blue-500" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Export FEC (Fichier des Écritures Comptables)</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Format réglementaire français — requis par l'article L47 A du Livre des Procédures Fiscales.
                Utilisé lors des contrôles fiscaux par l'administration.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div>• Format pipe-separé (|)</div>
                <div>• Encodage UTF-8</div>
                <div>• 18 colonnes obligatoires</div>
                <div>• Exercice : {year}</div>
                <div>• Journaux : VTE, ACH, BQ, CA</div>
                <div>• PCG : 401, 411, 512, 606, 706...</div>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t">
            <Button
              onClick={handleDownload}
              disabled={downloading}
              data-testid="button-download-fec"
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {downloading ? (
                <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Génération...</>
              ) : (
                <><FileDown className="w-4 h-4 mr-2" />Télécharger FEC {year}</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Structure du fichier FEC</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="text-xs w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-1 pr-4 font-medium">Colonne</th>
                  <th className="text-left py-1 pr-4 font-medium">Description</th>
                  <th className="text-left py-1 font-medium">Exemple</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                {[
                  ["JournalCode", "Code du journal", "VTE"],
                  ["JournalLib", "Libellé du journal", "Ventes"],
                  ["EcritureNum", "Numéro d'écriture", "00000001"],
                  ["EcritureDate", "Date de l'écriture (AAAAMMJJ)", "20260101"],
                  ["CompteNum", "Numéro de compte PCG", "411000"],
                  ["CompteLib", "Libellé du compte", "Clients"],
                  ["EcritureLib", "Libellé de l'écriture", "Facture FA-001"],
                  ["Debit", "Montant débit", "1200,00"],
                  ["Credit", "Montant crédit", "0,00"],
                ].map(([col, desc, ex]) => (
                  <tr key={col} className="border-b border-border/50">
                    <td className="py-1 pr-4 font-mono">{col}</td>
                    <td className="py-1 pr-4">{desc}</td>
                    <td className="py-1 font-mono text-blue-400">{ex}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export function Accounting() {
  const { user } = useAuth();
  const [year, setYear] = useState(currentYear);
  const [tab, setTab] = useState("overview");

  const canAccess = user?.role === "SUPER_ADMIN" || user?.role === "ROOT_ADMIN" || user?.role === "ADMIN";
  if (!canAccess) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <AlertTriangle className="w-10 h-10 mb-3 text-amber-500" />
        <p className="font-medium">Accès restreint</p>
        <p className="text-sm mt-1">La comptabilité est réservée aux administrateurs.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-primary" />
            Comptabilité
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Suivi comptable, TVA, P&L et export FEC</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(year)} onValueChange={v => setYear(parseInt(v))}>
            <SelectTrigger className="w-28" data-testid="select-year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-4 h-auto">
          <TabsTrigger value="overview" className="text-xs sm:text-sm" data-testid="tab-overview">
            <Activity className="w-4 h-4 mr-1.5" />Vue d'ensemble
          </TabsTrigger>
          <TabsTrigger value="tva" className="text-xs sm:text-sm" data-testid="tab-tva">
            <Receipt className="w-4 h-4 mr-1.5" />TVA
          </TabsTrigger>
          <TabsTrigger value="journal" className="text-xs sm:text-sm" data-testid="tab-journal">
            <BookOpen className="w-4 h-4 mr-1.5" />Journal
          </TabsTrigger>
          <TabsTrigger value="fec" className="text-xs sm:text-sm" data-testid="tab-fec">
            <FileDown className="w-4 h-4 mr-1.5" />Export FEC
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab year={year} />
        </TabsContent>

        <TabsContent value="tva" className="mt-4">
          <TvaTab year={year} />
        </TabsContent>

        <TabsContent value="journal" className="mt-4">
          <JournalTab />
        </TabsContent>

        <TabsContent value="fec" className="mt-4">
          <FecTab year={year} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
