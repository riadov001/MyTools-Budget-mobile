import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Upload, AlertCircle, Loader2, X,
  FileSpreadsheet, Landmark, ArrowRight, FileText, Trash2, CheckCircle, Info,
} from "lucide-react";
import { getAuthToken, getActiveAppId, apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

type ImportTransaction = {
  date: string;
  description: string;
  amount: number;
  suggestedCategory: string;
};

type ImportResult =
  | {
      kind: "bank_statement";
      headers: string[];
      totalRows: number;
      parsedCount: number;
      transactions: ImportTransaction[];
    }
  | {
      kind: "generic";
      headers: string[];
      rows: any[][];
      totalRows: number;
    };

type BankAccount = { id: number; name?: string; displayName?: string; institutionName?: string; bankName?: string };

const BANK_CATEGORIES = [
  "Ventes", "Salaires/Virements", "Remboursement", "Entrée d'argent",
  "Loyer", "Énergie", "Télécom", "Charges sociales", "Bureau",
  "Infrastructure", "Logiciels", "Restauration", "Transport", "Voyage",
  "Assurance", "Frais bancaires", "Prélèvement", "Dépense Divers",
];

const ACCEPT_ATTR = ".csv,.tsv,.txt,.xls,.xlsx,.xlsm,.ods,text/csv,text/plain,text/tab-separated-values,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.oasis.opendocument.spreadsheet";

const buildAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {};
  const token = getAuthToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const appId = getActiveAppId();
  if (appId && appId !== "0") headers["X-App-Id"] = appId;
  return headers;
};

async function uploadToImport(file: File): Promise<ImportResult> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/import/file", {
    method: "POST",
    headers: buildAuthHeaders(),
    body: formData,
  });
  if (!res.ok) {
    const text = await res.text();
    let msg: string;
    try { msg = (JSON.parse(text) as { message?: string }).message ?? text; }
    catch { msg = text; }
    throw new Error(msg || `Erreur ${res.status}`);
  }
  return res.json() as Promise<ImportResult>;
}

const accountLabel = (a: BankAccount) => a.displayName || a.name || a.institutionName || a.bankName || `Compte ${a.id}`;

export default function ImportsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [editableTx, setEditableTx] = useState<ImportTransaction[]>([]);
  const [accountId, setAccountId] = useState<string>("");

  const { data: accounts = [] } = useQuery<BankAccount[]>({
    queryKey: ["/api/banking/accounts"],
  });

  const parseMutation = useMutation({
    mutationFn: uploadToImport,
    onSuccess: (data) => {
      setResult(data);
      if (data.kind === "bank_statement") {
        setEditableTx(data.transactions);
        toast({
          title: "Relevé bancaire détecté",
          description: `${data.parsedCount} transaction${data.parsedCount > 1 ? "s" : ""} prête${data.parsedCount > 1 ? "s" : ""} à importer`,
        });
      } else {
        toast({
          title: "Fichier analysé",
          description: `${data.totalRows} ligne${data.totalRows > 1 ? "s" : ""} détectée${data.totalRows > 1 ? "s" : ""} — pas un relevé bancaire reconnu`,
        });
      }
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Erreur d'import", description: err.message });
    },
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!accountId) throw new Error("Sélectionnez un compte bancaire");
      if (editableTx.length === 0) throw new Error("Aucune transaction à importer");
      const res = await apiRequest("POST", `/api/banking/accounts/${accountId}/import-csv`, {
        transactions: editableTx.map(t => ({
          date: t.date,
          description: t.description,
          amount: t.amount,
        })),
      });
      return res.json();
    },
    onSuccess: (data: any[]) => {
      toast({
        title: "Import réussi",
        description: `${data.length} transaction${data.length > 1 ? "s" : ""} importée${data.length > 1 ? "s" : ""}. Validez-les depuis l'écran Banque pour les faire passer en comptabilité.`,
      });
      qc.invalidateQueries({ queryKey: ["/api/banking/accounts"] });
      handleClear();
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Erreur import", description: err.message });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ variant: "destructive", title: "Fichier trop volumineux", description: "Maximum 10 MB" });
      return;
    }
    setSelectedFile(file);
    setResult(null);
    setEditableTx([]);
    parseMutation.reset();
    parseMutation.mutate(file);
  };

  const handleClear = () => {
    setSelectedFile(null);
    setResult(null);
    setEditableTx([]);
    parseMutation.reset();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const dt = new DataTransfer();
    dt.items.add(file);
    if (fileInputRef.current) fileInputRef.current.files = dt.files;
    handleFileChange({ currentTarget: { files: dt.files } } as React.ChangeEvent<HTMLInputElement>);
  };

  const updateTx = (idx: number, patch: Partial<ImportTransaction>) => {
    setEditableTx(prev => prev.map((t, i) => i === idx ? { ...t, ...patch } : t));
  };

  const removeTx = (idx: number) => {
    setEditableTx(prev => prev.filter((_, i) => i !== idx));
  };

  const totalIn = editableTx.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalOut = editableTx.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-1">
            <FileSpreadsheet className="w-7 h-7 text-emerald-600" />
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Importer un fichier</h1>
          </div>
          <p className="text-zinc-500 dark:text-zinc-400">
            Importez vos relevés bancaires (CSV, Excel, TXT) — détection et catégorisation automatiques.
          </p>
        </div>

        {/* How-to */}
        <Card className="border-emerald-200 dark:border-emerald-900 bg-emerald-50/30 dark:bg-emerald-950/20">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-1.5 text-sm text-zinc-700 dark:text-zinc-300">
                <p className="font-medium">Comment ça marche</p>
                <ol className="list-decimal list-inside space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                  <li>Téléchargez l'export de votre banque (CSV, Excel ou TXT)</li>
                  <li>Le système détecte automatiquement les transactions et propose une catégorie</li>
                  <li>Modifiez ce dont vous avez besoin (date, libellé, montant, catégorie)</li>
                  <li>Choisissez le compte de destination et lancez l'import</li>
                  <li>Validez ensuite chaque transaction depuis l'écran <Link href="/banking" className="text-emerald-600 hover:underline">Banque</Link> pour les passer en comptabilité</li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main card */}
        <Card className="border-zinc-200 dark:border-zinc-800" data-testid="import-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Upload className="w-4 h-4" />
              Sélectionner un fichier
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* Dropzone */}
            {!selectedFile && (
              <div
                data-testid="import-dropzone"
                className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl p-10 text-center cursor-pointer hover:border-emerald-500 dark:hover:border-emerald-500 transition-colors"
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
              >
                <input
                  ref={fileInputRef}
                  data-testid="import-file-input"
                  type="file"
                  accept={ACCEPT_ATTR}
                  onChange={handleFileChange}
                  className="hidden"
                />
                <FileSpreadsheet className="w-12 h-12 mx-auto text-zinc-400 mb-3" />
                <p className="font-medium text-zinc-700 dark:text-zinc-300">
                  Cliquez ou glissez un fichier ici
                </p>
                <p className="text-xs text-zinc-400 mt-1">CSV, TSV, TXT, XLS, XLSX, ODS — max 10 MB</p>
              </div>
            )}

            {/* Parsing */}
            {selectedFile && parseMutation.isPending && (
              <div className="flex items-center gap-3 p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Analyse en cours…</p>
                  <p className="text-xs text-zinc-500">{selectedFile.name}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={handleClear}>
                  <X className="w-3 h-3" />
                </Button>
              </div>
            )}

            {/* Error */}
            {parseMutation.isError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-red-700 dark:text-red-300">{parseMutation.error?.message}</p>
                  <Button variant="outline" size="sm" className="mt-2" onClick={handleClear}>
                    Réessayer
                  </Button>
                </div>
              </div>
            )}

            {/* Bank statement preview */}
            {result?.kind === "bank_statement" && (
              <div className="space-y-3" data-testid="bank-statement-preview">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <div>
                      <span className="text-sm font-medium">Relevé bancaire détecté</span>
                      <span className="text-xs text-zinc-500 ml-2">({editableTx.length} ligne{editableTx.length > 1 ? "s" : ""})</span>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleClear}>
                    <X className="w-3 h-3 mr-1" /> Annuler
                  </Button>
                </div>

                {/* Summary + account selector */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg">
                  <div>
                    <Label className="text-xs text-zinc-500">Compte de destination</Label>
                    {accounts.length === 0 ? (
                      <Link href="/banking">
                        <Button variant="outline" size="sm" className="w-full mt-1 text-xs" data-testid="link-create-account">
                          Créer un compte d'abord
                          <ArrowRight className="w-3 h-3 ml-1" />
                        </Button>
                      </Link>
                    ) : (
                      <Select value={accountId} onValueChange={setAccountId}>
                        <SelectTrigger className="mt-1" data-testid="select-import-account">
                          <SelectValue placeholder="Sélectionner un compte" />
                        </SelectTrigger>
                        <SelectContent>
                          {accounts.map(a => (
                            <SelectItem key={a.id} value={String(a.id)}>
                              {accountLabel(a)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div className="flex flex-col justify-center">
                    <span className="text-xs text-zinc-500">Total entrées</span>
                    <span className="text-sm font-semibold text-emerald-600">
                      +{totalIn.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                    </span>
                  </div>
                  <div className="flex flex-col justify-center">
                    <span className="text-xs text-zinc-500">Total sorties</span>
                    <span className="text-sm font-semibold text-rose-600">
                      −{totalOut.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                    </span>
                  </div>
                </div>

                {/* Transactions table */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="max-h-[28rem] overflow-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-zinc-50 dark:bg-zinc-900/50 sticky top-0">
                        <tr>
                          <th className="text-left p-2 font-medium">Date</th>
                          <th className="text-left p-2 font-medium">Libellé</th>
                          <th className="text-right p-2 font-medium">Montant</th>
                          <th className="text-left p-2 font-medium">Catégorie</th>
                          <th className="w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {editableTx.map((tx, idx) => (
                          <tr key={idx} className="border-t border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30" data-testid={`import-tx-${idx}`}>
                            <td className="p-2 whitespace-nowrap">
                              <input
                                type="date"
                                value={tx.date}
                                onChange={(e) => updateTx(idx, { date: e.target.value })}
                                className="bg-transparent border-0 text-xs w-32"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                value={tx.description}
                                onChange={(e) => updateTx(idx, { description: e.target.value })}
                                className="bg-transparent border-0 text-xs w-full"
                              />
                            </td>
                            <td className={cn("p-2 text-right font-mono", tx.amount > 0 ? "text-emerald-600" : "text-rose-600")}>
                              <input
                                type="number"
                                step="0.01"
                                value={tx.amount}
                                onChange={(e) => updateTx(idx, { amount: parseFloat(e.target.value) || 0 })}
                                className="bg-transparent border-0 text-xs w-24 text-right"
                              />
                            </td>
                            <td className="p-2">
                              <select
                                value={tx.suggestedCategory}
                                onChange={(e) => updateTx(idx, { suggestedCategory: e.target.value })}
                                className="bg-transparent border border-zinc-200 dark:border-zinc-700 rounded px-1 py-0.5 text-xs"
                              >
                                {BANK_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </td>
                            <td className="p-2">
                              <button
                                onClick={() => removeTx(idx)}
                                className="text-zinc-400 hover:text-rose-500"
                                data-testid={`remove-tx-${idx}`}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <Button
                  data-testid="import-confirm-btn"
                  onClick={() => importMutation.mutate()}
                  disabled={importMutation.isPending || !accountId || editableTx.length === 0}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {importMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Import en cours…</>
                  ) : (
                    <><Landmark className="w-4 h-4 mr-2" />Importer {editableTx.length} transaction{editableTx.length > 1 ? "s" : ""}</>
                  )}
                </Button>

                <p className="text-xs text-zinc-500 text-center">
                  Une fois importées, validez-les depuis <Link href="/banking" className="text-emerald-600 hover:underline">l'écran Banque</Link> pour les faire passer en comptabilité.
                </p>
              </div>
            )}

            {/* Generic file preview */}
            {result?.kind === "generic" && (
              <div className="space-y-3" data-testid="generic-preview">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-zinc-500" />
                    <span className="text-sm font-medium">Fichier détecté ({result.totalRows} lignes)</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleClear}>
                    <X className="w-3 h-3 mr-1" /> Annuler
                  </Button>
                </div>
                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Ce fichier ne ressemble pas à un relevé bancaire (colonnes date / libellé / montant non détectées). Aperçu ci-dessous :
                  </p>
                </div>
                <div className="border rounded-lg overflow-auto max-h-64">
                  <table className="w-full text-xs">
                    <thead className="bg-zinc-50 dark:bg-zinc-900/50">
                      <tr>
                        {result.headers.map((h, i) => (
                          <th key={i} className="text-left p-2 font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.rows.slice(0, 50).map((row, i) => (
                        <tr key={i} className="border-t border-zinc-100 dark:border-zinc-800">
                          {row.map((cell, j) => (
                            <td key={j} className="p-2 truncate max-w-[150px]">{String(cell ?? "")}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </CardContent>
        </Card>

      </div>
    </div>
  );
}
