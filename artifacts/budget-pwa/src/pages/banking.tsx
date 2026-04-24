import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
  import { useAuth } from "@/hooks/use-auth";
  import { apiRequest } from "@/lib/queryClient";
  import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
  import { Button } from "@/components/ui/button";
  import { Input } from "@/components/ui/input";
  import { Badge } from "@/components/ui/badge";
  import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
  import { Skeleton } from "@/components/ui/skeleton";
  import { useToast } from "@/hooks/use-toast";
  import { useState, useRef } from "react";
  import { 
    Building2, Plus, Trash2, Landmark, RefreshCw, ShieldCheck, 
    Wifi, WifiOff, Zap, ArrowDownLeft, ArrowUpRight, ChevronDown, 
    ChevronRight, Loader2, Upload, CheckCircle2, Link2, AlertTriangle,
    Paperclip, BookOpen, Files, ExternalLink
  } from "lucide-react";
  import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  } from "@/components/ui/alert-dialog";
  import { SiStripe } from "react-icons/si";
  import { loadStripe } from "@stripe/stripe-js";
  import type { BankAccount, BankTransaction } from "@shared/schema";
  import * as XLSX from 'xlsx';

  // ─── CSV / XLS PARSING UTILS ─────────────────────────────────────────────────

  type ParsedRow = { date: string; description: string; amount: number; vatRate: number };

  const VAT_OPTIONS = [
    { value: 0,   label: "Sans TVA" },
    { value: 2.1, label: "2,1 %" },
    { value: 5.5, label: "5,5 %" },
    { value: 10,  label: "10 %" },
    { value: 20,  label: "20 %" },
  ];

  function detectVatRate(desc: string, amount: number): number {
    if (amount >= 0) return 0; // recettes : TVA collectée gérée séparément
    const d = desc.toLowerCase();
    if (/supermarché|supermarche|carrefour|leclerc|intermarché|intermarche|lidl|aldi|monoprix|casino|franprix|picard/.test(d)) return 5.5;
    if (/restaurant|brasserie|café|cafe|snack|mcdo|burger|pizza|kebab|sushi|traiteur|cantine/.test(d)) return 10;
    if (/sncf|ratp|métro|metro|tramway|ter |tgv |transdev|flixbus|ouibus/.test(d)) return 10;
    if (/presse|kiosque|journal|magazine/.test(d)) return 2.1;
    return 20;
  }

  function tryDecode(buf: ArrayBuffer): string {
    try { return new TextDecoder("utf-8", { fatal: true }).decode(buf); }
    catch { return new TextDecoder("iso-8859-1").decode(buf); }
  }

  function parseCsvLine(line: string, sep: string): string[] {
    const result: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (c === sep && !inQ) { result.push(cur.trim()); cur = ""; }
      else cur += c;
    }
    result.push(cur.trim());
    return result;
  }

  function parseFrDate(s: string): string {
    if (!s) return new Date().toISOString();
    const fr = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (fr) {
      const [, d, m, y] = fr;
      const fullY = y.length === 2 ? "20" + y : y;
      const dt = new Date(`${fullY}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`);
      return isNaN(dt.getTime()) ? new Date().toISOString() : dt.toISOString();
    }
    const dt = new Date(s);
    return isNaN(dt.getTime()) ? new Date().toISOString() : dt.toISOString();
  }

  function parseFrAmount(s: string): number {
    if (!s) return 0;
    const cleaned = s.replace(/[€$£\u00A0\s]/g, "");
    // French: 1.234,56 → remove dots, replace comma
    if (/^\-?\d{1,3}(\.\d{3})*,\d{1,2}$/.test(cleaned))
      return parseFloat(cleaned.replace(/\./g, "").replace(",", "."));
    return parseFloat(cleaned.replace(",", ".")) || 0;
  }

  function parseCSVToRows(buf: ArrayBuffer): ParsedRow[] {
    const text = tryDecode(buf).replace(/^\uFEFF/, "");
    const allLines = text.split(/\r?\n/);

    // Skip metadata rows: find first line containing a date-like header
    let startLine = 0;
    const dateKeys = ["date", "dat", "opération", "operation"];
    for (let i = 0; i < Math.min(15, allLines.length); i++) {
      if (dateKeys.some(k => allLines[i].toLowerCase().includes(k))) { startLine = i; break; }
    }
    const lines = allLines.slice(startLine).filter(l => l.trim());
    if (lines.length < 2) return [];

    // Detect separator by frequency in header line
    const sepCandidates: [string, string][] = [[";", ";"], [",", ","], ["\t", "\\t"], ["|", "\\|"]];
    let sep = ";";
    let maxCount = 0;
    for (const [s, re] of sepCandidates) {
      const count = (lines[0].match(new RegExp(re, "g")) || []).length;
      if (count > maxCount) { maxCount = count; sep = s; }
    }

    const headers = parseCsvLine(lines[0], sep).map(h =>
      h.toLowerCase().replace(/['"]/g, "").trim()
    );

    const findCol = (...names: string[]): number => {
      for (const n of names) {
        const i = headers.findIndex(h => h.includes(n));
        if (i !== -1) return i;
      }
      return -1;
    };

    const iDate   = findCol("date", "dat", "dateop");
    const iLib    = findCol("libellé", "libelle", "description", "label", "désignation", "motif", "opération", "operation", "référence");
    const iMontant = findCol("montant", "amount", "valeur", "value", "somme");
    const iDebit  = findCol("débit", "debit", "sortie", "dépense");
    const iCredit = findCol("crédit", "credit", "entrée", "recette");

    const rows: ParsedRow[] = [];
    for (const line of lines.slice(1)) {
      const v = parseCsvLine(line, sep);
      if (v.length < 2) continue;

      const dateStr = (iDate >= 0 ? v[iDate] : v[0]) ?? "";
      const desc    = ((iLib >= 0 ? v[iLib] : v[1]) ?? "Transaction")
        .replace(/^["']|["']$/g, "").trim() || "Transaction";

      let amount = 0;
      if (iMontant >= 0) {
        amount = parseFrAmount(v[iMontant] ?? "");
      } else if (iDebit >= 0 || iCredit >= 0) {
        const debit  = iDebit  >= 0 ? parseFrAmount(v[iDebit]  ?? "") : 0;
        const credit = iCredit >= 0 ? parseFrAmount(v[iCredit] ?? "") : 0;
        amount = credit - Math.abs(debit);
      }

      if (!dateStr.trim() && amount === 0) continue;
      rows.push({ date: parseFrDate(dateStr), description: desc, amount, vatRate: detectVatRate(desc, amount) });
    }
    return rows;
  }

  function parseXLSXToRows(buf: ArrayBuffer): ParsedRow[] {
    const wb = XLSX.read(buf, { type: "array", cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(ws, { defval: "" }) as Record<string, unknown>[];

    const get = (row: Record<string, unknown>, ...names: string[]): string => {
      for (const n of names) {
        const key = Object.keys(row).find(k => k.toLowerCase().includes(n));
        if (key) return String(row[key]);
      }
      return "";
    };

    return jsonData.flatMap(row => {
      const dateVal = get(row, "date", "dat");
      const desc    = get(row, "libellé", "libelle", "description", "label", "désignation", "motif") || "Transaction";
      const debit   = parseFrAmount(get(row, "débit", "debit", "sortie"));
      const credit  = parseFrAmount(get(row, "crédit", "credit", "entrée"));
      const montant = parseFrAmount(get(row, "montant", "amount", "valeur"));

      const amount = montant !== 0 ? montant : credit - Math.abs(debit);

      let dateISO: string;
      if ((dateVal as unknown) instanceof Date) dateISO = (dateVal as unknown as Date).toISOString();
      else dateISO = parseFrDate(dateVal);

      if (!dateVal && amount === 0) return [];
      return [{ date: dateISO, description: desc, amount, vatRate: detectVatRate(desc, amount) }];
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────

  const FRENCH_BANKS = [
    "BNP Paribas", "Société Générale", "Crédit Agricole", "LCL",
    "La Banque Postale", "Crédit Mutuel", "Caisse d'Épargne",
    "Banque Populaire", "Boursorama", "Hello Bank", "N26", "Revolut",
    "Shine", "Qonto", "Autre",
  ];

  function formatAmount(amount: number, currency = "EUR") {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(amount / 100);
  }

  function AddBankDialog({ onClose }: { onClose: () => void }) {
    const { toast } = useToast();
    const qc = useQueryClient();
    const [form, setForm] = useState({ institutionName: "", displayName: "", last4: "" });

    const mutation = useMutation({
      mutationFn: (data: any) => apiRequest("POST", "/api/banking/accounts/manual", data),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["/api/banking/accounts"] });
        toast({ title: "Compte bancaire ajouté" });
        onClose();
      },
      onError: () => toast({ title: "Erreur lors de l'ajout", variant: "destructive" }),
    });

    return (
      <form onSubmit={e => { e.preventDefault(); mutation.mutate(form); }} className="space-y-4">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Banque *</label>
          <select
            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={form.institutionName}
            onChange={e => setForm({ ...form, institutionName: e.target.value, displayName: e.target.value })}
            required
          >
            <option value="">Sélectionner une banque</option>
            {FRENCH_BANKS.map(b => <option key={b} value={b}>🏦 {b}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Nom du compte *</label>
          <Input
            placeholder="ex: Compte courant Qonto"
            value={form.displayName}
            onChange={e => setForm({ ...form, displayName: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">4 derniers chiffres IBAN (optionnel)</label>
          <Input
            placeholder="ex: 4242"
            maxLength={4}
            value={form.last4}
            onChange={e => setForm({ ...form, last4: e.target.value.replace(/\D/g, "") })}
          />
        </div>
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Ajout..." : "Ajouter"}
          </Button>
        </div>
      </form>
    );
  }

  function TransactionsPanel({ account }: { account: BankAccount }) {
    const [open, setOpen] = useState(false);
    const { toast } = useToast();
    const qc = useQueryClient();
    const attachInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

    const { data: transactions = [], isLoading } = useQuery<BankTransaction[]>({
      queryKey: ["/api/banking/accounts", account.id, "transactions"],
      queryFn: () => apiRequest("GET", `/api/banking/accounts/${account.id}/transactions`).then(r => r.json()),
      enabled: open,
    });

    const validateMutation = useMutation({
      mutationFn: (txId: number) => apiRequest("POST", `/api/banking/transactions/${txId}/validate`),
      onSuccess: (_data, txId) => {
        toast({ title: "✓ Intégré en comptabilité", description: "Écriture comptable créée avec TVA." });
        qc.invalidateQueries({ queryKey: ["/api/banking/accounts", account.id, "transactions"] });
        qc.invalidateQueries({ queryKey: ["/api/accounting/entries"] });
      },
      onError: (err: any) => toast({ title: "Erreur", description: err.message, variant: "destructive" }),
    });

    const handleAttach = async (tx: BankTransaction, file: File) => {
      try {
        // Step 1 : demander presigned URL
        const urlRes = await apiRequest("POST", "/api/uploads/request-url", {
          name: file.name,
          size: file.size,
          contentType: file.type || "application/octet-stream",
        });
        if (!urlRes.ok) throw new Error("Impossible d'obtenir l'URL d'upload");
        const { uploadURL, objectPath } = await urlRes.json();

        // Step 2 : uploader directement
        const put = await fetch(uploadURL, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type || "application/octet-stream" },
        });
        if (!put.ok) throw new Error("Échec de l'upload");

        // Step 3 : lier à la transaction
        await apiRequest("POST", `/api/banking/transactions/${tx.id}/attachment`, {
          objectPath,
          attachmentName: file.name,
        });
        qc.invalidateQueries({ queryKey: ["/api/banking/accounts", account.id, "transactions"] });
        toast({ title: "Pièce jointe ajoutée", description: file.name });
      } catch (err: any) {
        toast({ variant: "destructive", title: "Erreur upload", description: err.message });
      }
    };

    return (
      <div className="mt-3 border-t border-border/40 pt-3">
        <button
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
          onClick={() => setOpen(o => !o)}
        >
          {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          Transactions
          {transactions.length > 0 && (
            <Badge variant="secondary" className="text-[10px] ml-auto">{transactions.length}</Badge>
          )}
        </button>
        {open && (
          <div className="mt-2 space-y-1.5 max-h-72 overflow-y-auto pr-0.5">
            {isLoading ? (
              <div className="space-y-1.5">
                {[1,2,3].map(i => <Skeleton key={i} className="h-10 rounded" />)}
              </div>
            ) : transactions.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-3">
                Aucune transaction importée.
              </p>
            ) : transactions.map(tx => {
              const vatRate = tx.vatRate ? parseFloat(tx.vatRate as string) : null;
              const vatAmt  = tx.vatAmount ? Math.abs(tx.vatAmount) / 100 : null;
              return (
                <div key={tx.id} className={`flex items-start gap-2 py-2 px-2 rounded transition-colors group ${tx.validated ? "bg-green-500/5 border border-green-500/20" : "bg-muted/20 hover:bg-muted/30"}`}>
                  {/* Icône direction */}
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${tx.amount >= 0 ? "bg-green-500/15" : "bg-red-500/15"}`}>
                    {tx.amount >= 0
                      ? <ArrowDownLeft className="w-3 h-3 text-green-400" />
                      : <ArrowUpRight className="w-3 h-3 text-red-400" />
                    }
                  </div>

                  {/* Contenu principal */}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs truncate font-medium" title={tx.description || ""}>{tx.description || "Transaction"}</div>
                    <div className="text-[10px] text-muted-foreground flex flex-wrap items-center gap-1 mt-0.5">
                      {tx.transactedAt ? new Date(tx.transactedAt).toLocaleDateString("fr-FR") : "—"}
                      {tx.category && <Badge variant="secondary" className="text-[8px] h-3 px-1 bg-primary/5 text-primary border-primary/10">{tx.category}</Badge>}
                      {vatRate && vatRate > 0 && <Badge variant="outline" className="text-[8px] h-3 px-1 text-amber-400 border-amber-400/30">TVA {vatRate}%</Badge>}
                      {tx.validated && (
                        <a href={`/accounting?entry=${tx.accountingEntryId}`} className="inline-flex items-center gap-1">
                          <Badge className="text-[8px] h-3 px-1 bg-green-600/80 text-white border-0 cursor-pointer hover:bg-green-700/80">
                            Comptabilisé <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
                          </Badge>
                        </a>
                      )}
                      {tx.attachmentName && (
                        <span className="flex items-center gap-0.5 text-blue-400">
                          <Paperclip className="w-2.5 h-2.5" />
                          {tx.attachmentName.length > 18 ? tx.attachmentName.slice(0, 15) + "…" : tx.attachmentName}
                        </span>
                      )}
                    </div>
                    {vatAmt && vatAmt > 0 && (
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        HT : {formatAmount(tx.netAmount || 0)} · TVA : {formatAmount(tx.vatAmount || 0)}
                      </div>
                    )}
                  </div>

                  {/* Droite : montant + actions */}
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <div className={`text-xs font-semibold ${tx.amount >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {tx.amount >= 0 ? "+" : ""}{formatAmount(tx.amount, tx.currency || "EUR")}
                    </div>
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {/* Bouton pièce jointe */}
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png,.webp"
                        ref={el => { attachInputRefs.current[tx.id] = el; }}
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleAttach(tx, f); e.target.value = ""; }}
                      />
                      <Button
                        size="icon" variant="ghost"
                        className={`h-6 w-6 hover:bg-blue-500/10 ${tx.attachmentName ? "text-blue-400" : "hover:text-blue-400"}`}
                        onClick={() => attachInputRefs.current[tx.id]?.click()}
                        title={tx.attachmentName ? `Remplacer: ${tx.attachmentName}` : "Ajouter une pièce jointe"}
                      >
                        <Paperclip className="h-3 w-3" />
                      </Button>
                      {/* Bouton valider comptabilité */}
                      {!tx.validated && (
                        <Button
                          size="icon" variant="ghost"
                          className="h-6 w-6 hover:bg-green-500/10 hover:text-green-400"
                          onClick={() => validateMutation.mutate(tx.id)}
                          disabled={validateMutation.isPending}
                          title="Intégrer en comptabilité (avec TVA)"
                        >
                          {validateMutation.isPending
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <BookOpen className="h-3 w-3" />
                          }
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  function BankAccountCard({ acc, onDelete, onSync, syncingId }: { acc: BankAccount; onDelete: () => void; onSync: () => void; syncingId: number | null }) {
    const isStripe = !acc.stripeAccountId.startsWith("manual_");

    return (
      <div style={{ position: "relative" }}>
        {syncingId === acc.id && (
          <div className="absolute inset-0 bg-background/60 rounded-xl flex items-center justify-center z-10">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}
        <Card className="glass-card">
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                  <Landmark className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="font-semibold text-sm">{acc.displayName}</div>
                  <div className="text-xs text-muted-foreground">{acc.institutionName}</div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge variant="outline" className="text-green-400 border-green-500/30 text-[10px]">
                  Actif
                </Badge>
                {isStripe && (
                  <Badge variant="outline" className="text-blue-400 border-blue-500/30 text-[10px]">
                    <Wifi className="w-2.5 h-2.5 mr-0.5" /> Stripe FC
                  </Badge>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-muted/30 rounded-lg p-2.5">
                <div className="text-[10px] text-muted-foreground mb-0.5">IBAN</div>
                <div className="text-sm font-medium">••••{acc.last4 || "???"}</div>
              </div>
              <div className="bg-muted/30 rounded-lg p-2.5">
                <div className="text-[10px] text-muted-foreground mb-0.5">Devise</div>
                <div className="text-sm font-medium">{acc.currency || "EUR"}</div>
              </div>
              <div className="bg-muted/30 rounded-lg p-2.5">
                <div className="text-[10px] text-muted-foreground mb-0.5">Solde</div>
                <div className="text-sm font-medium">{formatAmount(acc.balance || 0, acc.currency || "EUR")}</div>
              </div>
            </div>

            <div className="flex gap-2">
              {isStripe && (
                <Button variant="outline" className="flex-1 text-xs gap-1.5" onClick={onSync}>
                  <RefreshCw className="w-3 h-3" /> Synchroniser
                </Button>
              )}
              <Button variant="outline" size="icon" className="text-red-400 border-red-500/30" onClick={onDelete}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>

            <TransactionsPanel account={acc} />
          </CardContent>
        </Card>
      </div>
    );
  }

  export function Banking() {
    const { user } = useAuth();
    const { toast } = useToast();
    const qc = useQueryClient();
    const lang = user?.language ?? "fr";
    const t = (f: string, e: string) => lang === "en" ? e : f;
    const [manualOpen, setManualOpen] = useState(false);
    const [connectingStripe, setConnectingStripe] = useState(false);
    const [syncingId, setSyncingId] = useState<number | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [connectingBridge, setConnectingBridge] = useState(false);
    const [syncingLinxo, setSyncingLinxo] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [importDialogOpen, setImportDialogOpen] = useState(false);
    const [importPreviewRows, setImportPreviewRows] = useState<ParsedRow[]>([]);
    const [importTargetAccountId, setImportTargetAccountId] = useState<number | null>(null);

    const { data: providers } = useQuery<{stripe: boolean, bridge: boolean, linxo: boolean}>({
      queryKey: ["/api/banking/providers"],
    });

    const { data: accounts = [], isLoading, isError, refetch } = useQuery<BankAccount[]>({
      queryKey: ["/api/banking/accounts"],
    });

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);
      if (!files.length) return;
      if (accounts.length === 0) {
        toast({ title: "Erreur", description: "Veuillez d'abord créer un compte bancaire." });
        return;
      }
      const validFiles = files.filter(f => !f.name.endsWith(".pdf"));
      if (validFiles.length < files.length) {
        toast({ title: "PDF ignoré", description: "Les PDF ne sont pas supportés. Utilisez l'OCR Facture ou convertissez en CSV/Excel." });
      }
      if (!validFiles.length) return;

      setIsImporting(true);
      const allRows: ParsedRow[] = [];
      let pending = validFiles.length;

      validFiles.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const buf = e.target?.result as ArrayBuffer;
            let rows: ParsedRow[] = [];
            if (file.name.endsWith(".csv")) {
              rows = parseCSVToRows(buf);
            } else if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
              rows = parseXLSXToRows(buf);
            } else if (file.name.endsWith(".json")) {
              const text = tryDecode(buf);
              const parsed = JSON.parse(text) as any[];
              rows = parsed.map(r => {
                const desc = String(r.description || r.libelle || r.Libellé || "Transaction");
                const amount = parseFrAmount(String(r.amount || r.montant || r.Montant || "0"));
                return { date: parseFrDate(String(r.date || r.Date || "")), description: desc, amount, vatRate: detectVatRate(desc, amount) };
              });
            }
            allRows.push(...rows);
          } catch (err: any) {
            toast({ variant: "destructive", title: `Erreur: ${file.name}`, description: err.message });
          } finally {
            pending--;
            if (pending === 0) {
              setIsImporting(false);
              if (fileInputRef.current) fileInputRef.current.value = "";
              if (allRows.length === 0) {
                toast({ variant: "destructive", title: "Aucune donnée trouvée", description: "Vérifiez le format. Colonnes attendues: Date, Libellé, Montant (ou Débit/Crédit)." });
                return;
              }
              setImportPreviewRows(allRows);
              setImportTargetAccountId(accounts[0].id);
              setImportDialogOpen(true);
            }
          }
        };
        reader.readAsArrayBuffer(file);
      });
    };

    const confirmImport = async () => {
      if (!importTargetAccountId || importPreviewRows.length === 0) return;
      setIsImporting(true);
      try {
        const transactions = importPreviewRows.map(r => ({
          date: r.date,
          description: r.description,
          amount: r.amount,
          vatRate: r.vatRate > 0 ? r.vatRate : null,
        }));
        const res = await apiRequest("POST", `/api/banking/accounts/${importTargetAccountId}/import-csv`, { transactions });
        if (res.ok) {
          const target = accounts.find(a => a.id === importTargetAccountId);
          toast({ title: "Import réussi ✓", description: `${transactions.length} transactions importées dans ${target?.displayName ?? "le compte"}.` });
          qc.invalidateQueries({ queryKey: ["/api/banking/accounts"] });
          qc.invalidateQueries({ queryKey: ["/api/banking/accounts", importTargetAccountId, "transactions"] });
          setImportDialogOpen(false);
          setImportPreviewRows([]);
        } else {
          const err = await res.json().catch(() => ({})) as { message?: string };
          throw new Error(err.message || "Erreur serveur");
        }
      } catch (err: any) {
        toast({ variant: "destructive", title: "Erreur d'import", description: err.message });
      } finally {
        setIsImporting(false);
      }
    };

    const [deleteAccountId, setDeleteAccountId] = useState<number | null>(null);

    const deleteMutation = useMutation({
      mutationFn: (id: number) => apiRequest("DELETE", `/api/banking/accounts/${id}`),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["/api/banking/accounts"] });
        toast({ title: t("Compte supprimé", "Account removed") });
      },
      onError: () => toast({ title: t("Erreur lors de la suppression", "Deletion error"), variant: "destructive" }),
    });

    async function handleConnectStripe() {
      const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
      if (!publishableKey) {
        toast({ title: "Clé Stripe manquante", description: "VITE_STRIPE_PUBLISHABLE_KEY non configurée", variant: "destructive" });
        return;
      }
      setConnectingStripe(true);
      try {
        const sessionRes = await apiRequest("POST", "/api/banking/session");
        const { clientSecret } = await sessionRes.json();
        const stripe = await loadStripe(publishableKey);
        if (!stripe) throw new Error("Stripe.js non chargé");
        const result = await (stripe as any).collectFinancialConnectionsAccounts({ clientSecret });
        if (result.error) {
          toast({ title: "Connexion annulée", description: result.error.message, variant: "destructive" });
          return;
        }
        const linkedAccounts = result.financialConnectionsSession?.accounts || [];
        for (const acct of linkedAccounts) {
          await apiRequest("POST", "/api/banking/accounts/stripe", { stripeAccountId: acct.id });
        }
        await qc.invalidateQueries({ queryKey: ["/api/banking/accounts"] });
        toast({ title: t("Banque connectée !", "Bank connected!") });
      } catch (e: any) {
        toast({ title: "Erreur", description: e.message, variant: "destructive" });
      } finally {
        setConnectingStripe(false);
      }
    }

    async function handleSync(id: number) {
      setSyncingId(id);
      try {
        const res = await apiRequest("POST", `/api/banking/accounts/${id}/sync`);
        await qc.invalidateQueries({ queryKey: ["/api/banking/accounts"] });
        await qc.invalidateQueries({ queryKey: ["/api/banking/accounts", id, "transactions"] });
        toast({ title: "Synchronisé" });
      } catch (e: any) {
        toast({ title: "Erreur", description: e.message, variant: "destructive" });
      } finally {
        setSyncingId(null);
      }
    }

    async function handleConnectBridge() {
      setConnectingBridge(true);
      try {
        const res = await apiRequest("POST", "/api/banking/bridge/connect");
        const { connectUrl } = await res.json();
        window.location.href = connectUrl;
      } catch (e: any) {
        toast({ title: "Erreur Bridge", description: e.message, variant: "destructive" });
      } finally {
        setConnectingBridge(false);
      }
    }

    async function handleSyncLinxo() {
      setSyncingLinxo(true);
      try {
        const res = await apiRequest("POST", "/api/banking/linxo/sync");
        const { message } = await res.json();
        await qc.invalidateQueries({ queryKey: ["/api/banking/accounts"] });
        toast({ title: "Linxo", description: message });
      } catch (e: any) {
        toast({ title: "Erreur Linxo", description: e.message, variant: "destructive" });
      } finally {
        setSyncingLinxo(false);
      }
    }

    return (
      <div className="space-y-6 pb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Landmark className="w-6 h-6 text-primary" />
              {t("Open Banking", "Open Banking")}
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {t("Suivez vos finances automatiquement", "Connect bank accounts for automated tracking")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input type="file" accept=".csv,.xlsx,.xls,.json" multiple className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting || accounts.length === 0}
              title="Importer CSV, Excel (.xlsx/.xls) ou JSON"
              data-testid="button-import-file"
            >
              {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {t("Importer CSV / Excel", "Import CSV / Excel")}
            </Button>
            
            <div className="flex gap-1 border rounded-md p-1 bg-background/50">
              <Button 
                variant="ghost" 
                size="sm"
                className="gap-2 px-3 h-8 text-xs" 
                onClick={handleConnectStripe} 
                disabled={connectingStripe || !providers?.stripe}
                title="Stripe Financial Connections"
              >
                {connectingStripe ? <Loader2 className="w-3 h-3 animate-spin" /> : <SiStripe className="w-3 h-3 text-[#635BFF]" />}
                Stripe
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                className="gap-2 px-3 h-8 text-xs" 
                onClick={handleConnectBridge} 
                disabled={connectingBridge || !providers?.bridge}
                title="Bridge API"
              >
                {connectingBridge ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link2 className="w-3 h-3 text-blue-500" />}
                Bridge
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                className="gap-2 px-3 h-8 text-xs" 
                onClick={handleSyncLinxo} 
                disabled={syncingLinxo || !providers?.linxo}
                title="Linxo Direct Accounts"
              >
                {syncingLinxo ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3 text-green-500" />}
                Linxo
              </Button>
            </div>

            <Button variant="outline" className="gap-2" onClick={() => setManualOpen(true)}>
              <Plus className="w-4 h-4" /> {t("Manuel", "Manual")}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Link2 className="w-4 h-4 text-blue-500" /> Bridge API
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-4">
                Agrégateur bancaire européen (DSP2). Idéal pour les banques françaises et européennes.
              </p>
              <Button 
                className="w-full gap-2" 
                onClick={handleConnectBridge} 
                disabled={connectingBridge || !providers?.bridge}
                variant={providers?.bridge ? "default" : "outline"}
              >
                {connectingBridge ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {providers?.bridge ? "Connecter via Bridge" : "Bridge non configuré"}
              </Button>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-green-500" /> Linxo Connect
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-4">
                Synchronisation directe via l'API Linxo. Récupérez vos comptes et transactions en un clic.
              </p>
              <Button 
                className="w-full gap-2" 
                onClick={handleSyncLinxo} 
                disabled={syncingLinxo || !providers?.linxo}
                variant={providers?.linxo ? "default" : "outline"}
              >
                {syncingLinxo ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {providers?.linxo ? "Synchroniser Linxo" : "Linxo non configuré"}
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="glass-card bg-primary/5 border-primary/20">
          <CardContent className="p-4 flex gap-3 items-center">
            <ShieldCheck className="w-5 h-5 text-primary flex-shrink-0" />
            <div className="text-xs text-muted-foreground">
              <strong>Sécurité :</strong> Vos relevés sont analysés localement et enregistrés de manière sécurisée dans votre espace MyJantes.
            </div>
          </CardContent>
        </Card>

        {/* ── Import Preview Dialog ── */}
        <Dialog open={importDialogOpen} onOpenChange={open => { if (!open) { setImportDialogOpen(false); setImportPreviewRows([]); } }}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Files className="w-4 h-4 text-primary" />
                Aperçu de l'import — {importPreviewRows.length} transaction{importPreviewRows.length > 1 ? "s" : ""} détectée{importPreviewRows.length > 1 ? "s" : ""}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {accounts.length > 1 && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block font-medium">Compte de destination</label>
                  <select
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={importTargetAccountId ?? ""}
                    onChange={e => setImportTargetAccountId(parseInt(e.target.value))}
                    data-testid="import-account-selector"
                  >
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.displayName} ({a.institutionName})</option>)}
                  </select>
                </div>
              )}

              <div className="overflow-auto max-h-80 rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 sticky top-0">
                    <tr>
                      <th className="text-left px-2 py-2 text-muted-foreground font-medium w-24">Date</th>
                      <th className="text-left px-2 py-2 text-muted-foreground font-medium">Libellé</th>
                      <th className="text-right px-2 py-2 text-muted-foreground font-medium w-28">TTC</th>
                      <th className="text-center px-2 py-2 text-muted-foreground font-medium w-28">TVA</th>
                      <th className="text-right px-2 py-2 text-muted-foreground font-medium w-24">HT estimé</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {importPreviewRows.slice(0, 12).map((row, i) => {
                      const vatMult = row.vatRate > 0 ? (1 + row.vatRate / 100) : 1;
                      const ht = row.amount !== 0 && row.vatRate > 0 ? row.amount / vatMult : row.amount;
                      return (
                        <tr key={i} className="hover:bg-muted/20">
                          <td className="px-2 py-1.5 text-muted-foreground whitespace-nowrap">
                            {new Date(row.date).toLocaleDateString("fr-FR")}
                          </td>
                          <td className="px-2 py-1.5 max-w-[220px] truncate" title={row.description}>{row.description}</td>
                          <td className={`px-2 py-1.5 text-right font-semibold ${row.amount >= 0 ? "text-green-500" : "text-red-500"}`}>
                            {row.amount >= 0 ? "+" : ""}
                            {row.amount.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                          </td>
                          <td className="px-2 py-1 text-center">
                            <select
                              className="w-full h-6 rounded border border-input bg-background px-1 text-[11px]"
                              value={row.vatRate}
                              onChange={e => {
                                const updated = [...importPreviewRows];
                                updated[i] = { ...updated[i], vatRate: parseFloat(e.target.value) };
                                setImportPreviewRows(updated);
                              }}
                            >
                              {VAT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-1.5 text-right text-muted-foreground">
                            {row.vatRate > 0 ? ht.toLocaleString("fr-FR", { style: "currency", currency: "EUR" }) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {importPreviewRows.length > 12 && (
                  <p className="text-xs text-muted-foreground text-center py-2 border-t border-border/40">
                    … et {importPreviewRows.length - 12} autres transactions (TVA 20 % par défaut)
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p>Total : <span className="font-medium text-foreground">{importPreviewRows.length} transactions</span></p>
                  <p className="text-[11px]">La TVA est détectée automatiquement — vous pouvez la corriger ligne par ligne.</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => { setImportDialogOpen(false); setImportPreviewRows([]); }}>
                    Annuler
                  </Button>
                  <Button
                    onClick={confirmImport}
                    disabled={isImporting}
                    className="gap-2 bg-primary hover:bg-primary/90"
                    data-testid="button-confirm-import"
                  >
                    {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Importer {importPreviewRows.length} transactions
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={manualOpen} onOpenChange={setManualOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{t("Ajouter un compte", "Add Account")}</DialogTitle></DialogHeader>
            <AddBankDialog onClose={() => setManualOpen(false)} />
          </DialogContent>
        </Dialog>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2].map(i => <Skeleton key={i} className="h-52 rounded-xl" />)}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-3">
            <AlertTriangle className="w-10 h-10 text-red-400" />
            <p className="text-sm font-medium">{t("Impossible de charger les comptes bancaires", "Unable to load bank accounts")}</p>
            <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-retry-banking">{t("Réessayer", "Retry")}</Button>
          </div>
        ) : accounts.length === 0 ? (
          <Card className="glass-card"><CardContent className="p-12 text-center">
            <Landmark className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
            <h3 className="font-semibold mb-1">{t("Aucun compte connecté", "No accounts connected")}</h3>
            <Button className="mt-4 gap-2" onClick={handleConnectStripe} disabled={connectingStripe}>
              <Zap className="w-4 h-4" /> {t("Connecter ma banque", "Connect bank")}
            </Button>
          </CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {accounts.map(acc => (
              <BankAccountCard 
                key={acc.id} 
                acc={acc} 
                onDelete={() => setDeleteAccountId(acc.id)} 
                onSync={() => handleSync(acc.id)}
                syncingId={syncingId}
              />
            ))}
          </div>
        )}

        <AlertDialog open={!!deleteAccountId} onOpenChange={open => { if (!open) setDeleteAccountId(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("Confirmer la suppression", "Confirm deletion")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("Supprimer ce compte bancaire et toutes ses transactions ? Cette action est irréversible.", "Delete this bank account and all its transactions? This cannot be undone.")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("Annuler", "Cancel")}</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={() => {
                  if (deleteAccountId) deleteMutation.mutate(deleteAccountId);
                  setDeleteAccountId(null);
                }}
              >
                {t("Supprimer", "Delete")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }