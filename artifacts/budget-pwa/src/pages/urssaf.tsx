import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExternalLink, Calculator, Calendar, TrendingUp, AlertTriangle, CheckCircle, Building2, Receipt } from "lucide-react";
import type { Invoice, Expense } from "@shared/schema";

type RegimeKey = "micro_bic" | "micro_bnc" | "micro_service" | "sasu" | "eurl";

const REGIMES: Record<RegimeKey, { label: string; rate: number; plafond: number; description: string }> = {
  micro_bic:     { label: "Micro-entreprise BIC (vente)",        rate: 12.3,  plafond: 188700, description: "Vente de marchandises, taux 12.3%" },
  micro_bnc:     { label: "Micro-entreprise BNC (libéral)",      rate: 21.2,  plafond: 77700,  description: "Professions libérales, taux 21.2%" },
  micro_service: { label: "Micro-entreprise BIC (service)",      rate: 21.2,  plafond: 77700,  description: "Prestations de services, taux 21.2%" },
  sasu:          { label: "SASU (dirigeant assimilé salarié)",    rate: 0,     plafond: 0,      description: "Cotisations sur salaire, variable" },
  eurl:          { label: "EURL (gérant non salarié)",           rate: 0,     plafond: 0,      description: "Cotisations sur rémunération + bénéfices" },
};

const TVA_RATES = [
  { rate: 20, label: "20% — Taux normal" },
  { rate: 10, label: "10% — Taux intermédiaire" },
  { rate: 5.5, label: "5.5% — Taux réduit" },
  { rate: 2.1, label: "2.1% — Taux super-réduit" },
];

const ECHEANCES_MICRO_MENSUEL = [
  { mois: "Janvier 2026", echeance: "31/01/2026", periode: "T4 2025" },
  { mois: "Février 2026", echeance: "28/02/2026", periode: "Janv 2026" },
  { mois: "Mars 2026", echeance: "31/03/2026", periode: "Févr 2026" },
  { mois: "Avril 2026", echeance: "30/04/2026", periode: "Mars 2026" },
  { mois: "Mai 2026", echeance: "31/05/2026", periode: "Avr 2026" },
  { mois: "Juin 2026", echeance: "30/06/2026", periode: "Mai 2026" },
  { mois: "Juillet 2026", echeance: "31/07/2026", periode: "Juin 2026" },
  { mois: "Août 2026", echeance: "31/08/2026", periode: "Juil 2026" },
  { mois: "Septembre 2026", echeance: "30/09/2026", periode: "Août 2026" },
  { mois: "Octobre 2026", echeance: "31/10/2026", periode: "Sept 2026" },
  { mois: "Novembre 2026", echeance: "30/11/2026", periode: "Oct 2026" },
  { mois: "Décembre 2026", echeance: "31/12/2026", periode: "Nov 2026" },
];

export function Urssaf() {
  const { user } = useAuth();
  const lang = user?.language ?? "fr";
  const t = (f: string, e: string) => lang === "en" ? e : f;

  const [ca, setCa] = useState("");
  const [regime, setRegime] = useState<RegimeKey>("micro_service");
  const [tvaRate, setTvaRate] = useState(20);

  const { data: invoices = [] } = useQuery<Invoice[]>({ queryKey: ["/api/invoices"] });
  const { data: expenses = [] } = useQuery<Expense[]>({ queryKey: ["/api/expenses"] });

  const caNum = parseFloat(ca) || 0;
  const sel = REGIMES[regime];
  const cotisations = regime.startsWith("micro") ? (caNum * sel.rate) / 100 : 0;
  const resteAPayer = caNum - cotisations;
  const depassePlafond = sel.plafond > 0 && caNum > sel.plafond;

  const currentYear = new Date().getFullYear();
  const tvaTotale = useMemo(() => {
    const collectee = invoices
      .filter(i => i.status === "paid")
      .reduce((sum, i) => sum + (parseFloat(i.taxAmount as string || "0")), 0);
    const deductible = expenses
      .filter(e => e.status === "paid")
      .reduce((sum, e) => sum + (parseFloat(e.taxAmount as string || "0")), 0);
    return { collectee, deductible, net: collectee - deductible };
  }, [invoices, expenses]);

  const caAnnuel = useMemo(() => {
    return invoices
      .filter(i => i.status === "paid" && new Date(i.issuedDate).getFullYear() === currentYear)
      .reduce((sum, i) => sum + parseFloat(i.total as string || "0"), 0);
  }, [invoices, currentYear]);

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-urssaf-title">
          <Building2 className="w-6 h-6 text-primary" />
          {t("URSSAF & Impôts", "URSSAF & Taxes")}
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          {t("Calculateur de cotisations, suivi TVA et calendrier des échéances", "Contribution calculator, VAT tracking and deadline calendar")}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="glass-card border-blue-500/20">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">CA {currentYear}</div>
            <div className="text-xl font-bold text-blue-400" data-testid="stat-ca-annuel">{caAnnuel.toFixed(0)} €</div>
            <div className="text-[10px] text-muted-foreground">Factures encaissées</div>
          </CardContent>
        </Card>
        <Card className="glass-card border-orange-500/20">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">TVA collectée</div>
            <div className="text-xl font-bold text-orange-400" data-testid="stat-tva-collectee">{tvaTotale.collectee.toFixed(0)} €</div>
            <div className="text-[10px] text-muted-foreground">Sur factures payées</div>
          </CardContent>
        </Card>
        <Card className="glass-card border-green-500/20">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">TVA nette à reverser</div>
            <div className={`text-xl font-bold ${tvaTotale.net >= 0 ? "text-green-400" : "text-red-400"}`} data-testid="stat-tva-net">
              {tvaTotale.net.toFixed(0)} €
            </div>
            <div className="text-[10px] text-muted-foreground">Collectée − Déductible</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="calcul">
        <TabsList className="grid grid-cols-3 w-full max-w-lg">
          <TabsTrigger value="calcul"><Calculator className="w-3.5 h-3.5 mr-1.5" />Calculateur</TabsTrigger>
          <TabsTrigger value="tva"><Receipt className="w-3.5 h-3.5 mr-1.5" />TVA</TabsTrigger>
          <TabsTrigger value="echeances"><Calendar className="w-3.5 h-3.5 mr-1.5" />Échéances</TabsTrigger>
        </TabsList>

        <TabsContent value="calcul" className="space-y-4 mt-4">
          <Card className="glass-card">
            <CardHeader className="pb-2"><CardTitle className="text-base">Calculateur URSSAF {currentYear}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Régime fiscal</label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={regime}
                  onChange={e => setRegime(e.target.value as RegimeKey)}
                  data-testid="select-regime"
                >
                  {Object.entries(REGIMES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <p className="text-xs text-muted-foreground mt-1">{sel.description}</p>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Chiffre d'affaires annuel (€)</label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="ex: 50000"
                    value={ca}
                    onChange={e => setCa(e.target.value)}
                    data-testid="input-ca"
                  />
                  <Button variant="outline" onClick={() => setCa(caAnnuel.toFixed(0))} className="whitespace-nowrap text-xs">
                    Utiliser mon CA
                  </Button>
                </div>
              </div>

              {depassePlafond && (
                <div className="flex items-start gap-2 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg text-sm text-orange-400">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong>Plafond dépassé !</strong> Votre CA ({caNum.toFixed(0)} €) dépasse le plafond du régime micro ({sel.plafond.toLocaleString("fr-FR")} €). Consultez un expert-comptable.
                  </div>
                </div>
              )}

              {caNum > 0 && regime.startsWith("micro") && (
                <div className="bg-muted/30 rounded-xl p-4 space-y-3">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">CA annuel</div>
                      <div className="text-lg font-bold">{caNum.toFixed(0)} €</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Cotisations ({sel.rate}%)</div>
                      <div className="text-lg font-bold text-red-400">{cotisations.toFixed(0)} €</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Reste net</div>
                      <div className="text-lg font-bold text-green-400">{resteAPayer.toFixed(0)} €</div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground text-center">
                    Cotisations mensuelles estimées : <strong className="text-foreground">{(cotisations / 12).toFixed(0)} €</strong> / mois
                  </div>
                </div>
              )}

              {(regime === "sasu" || regime === "eurl") && (
                <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg text-sm text-blue-300">
                  <p className="font-medium mb-2">Calcul spécifique {regime.toUpperCase()}</p>
                  <p>Les cotisations pour ce régime dépendent de votre rémunération et dividendes. Consultez votre expert-comptable ou utilisez le simulateur officiel.</p>
                  <a href="https://mon-entreprise.urssaf.fr" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-2 text-blue-400 hover:text-blue-300">
                    Simulateur URSSAF officiel <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tva" className="space-y-4 mt-4">
          <Card className="glass-card">
            <CardHeader className="pb-2"><CardTitle className="text-base">Suivi TVA {currentYear}</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-muted/30 rounded-xl p-4 text-center">
                    <div className="text-xs text-muted-foreground mb-1">TVA collectée</div>
                    <div className="text-xl font-bold text-orange-400">{tvaTotale.collectee.toFixed(2)} €</div>
                    <div className="text-[10px] text-muted-foreground mt-1">Sur {invoices.filter(i => i.status === "paid").length} factures</div>
                  </div>
                  <div className="bg-muted/30 rounded-xl p-4 text-center">
                    <div className="text-xs text-muted-foreground mb-1">TVA déductible</div>
                    <div className="text-xl font-bold text-blue-400">{tvaTotale.deductible.toFixed(2)} €</div>
                    <div className="text-[10px] text-muted-foreground mt-1">Sur {expenses.filter(e => e.status === "paid").length} dépenses</div>
                  </div>
                  <div className="bg-muted/30 rounded-xl p-4 text-center">
                    <div className="text-xs text-muted-foreground mb-1">TVA nette à reverser</div>
                    <div className={`text-xl font-bold ${tvaTotale.net >= 0 ? "text-green-400" : "text-red-400"}`}>{tvaTotale.net.toFixed(2)} €</div>
                    <div className="text-[10px] text-muted-foreground mt-1">{tvaTotale.net >= 0 ? "À payer à l'administration" : "Crédit de TVA"}</div>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">Taux de TVA applicables</div>
                  <div className="grid grid-cols-2 gap-2">
                    {TVA_RATES.map(r => (
                      <div key={r.rate} className="flex items-center justify-between bg-muted/20 rounded-lg px-3 py-2">
                        <span className="text-sm">{r.label}</span>
                        <Badge variant="outline" className="text-[10px]">{r.rate}%</Badge>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap pt-2">
                  <a href="https://www.impots.gouv.fr/professionnel/la-tva" target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" className="text-xs gap-1.5">
                      <ExternalLink className="w-3 h-3" /> impots.gouv.fr — TVA
                    </Button>
                  </a>
                  <a href="https://www.impots.gouv.fr/professionnel/declarer-et-payer-la-tva" target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" className="text-xs gap-1.5">
                      <ExternalLink className="w-3 h-3" /> Déclarer la TVA en ligne
                    </Button>
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="echeances" className="space-y-4 mt-4">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                <span>Calendrier URSSAF {currentYear}</span>
                <Badge variant="outline" className="text-xs">Micro-entrepreneur mensuel</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {ECHEANCES_MICRO_MENSUEL.map((e, i) => {
                  const isPast = new Date(e.echeance.split("/").reverse().join("-")) < new Date();
                  return (
                    <div key={i} className={`flex items-center justify-between p-2.5 rounded-lg transition-colors ${isPast ? "bg-muted/10 opacity-50" : "bg-muted/30"}`}>
                      <div className="flex items-center gap-2.5">
                        {isPast
                          ? <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                          : <Calendar className="w-4 h-4 text-primary flex-shrink-0" />}
                        <div>
                          <div className="text-sm font-medium">{e.mois}</div>
                          <div className="text-[10px] text-muted-foreground">Période : {e.periode}</div>
                        </div>
                      </div>
                      <Badge variant="outline" className={`text-[10px] ${isPast ? "text-muted-foreground" : "text-primary border-primary/30"}`}>
                        {isPast ? "Passé" : e.echeance}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="pb-2"><CardTitle className="text-base">Liens officiels</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { label: "autoentrepreneur.urssaf.fr", url: "https://www.autoentrepreneur.urssaf.fr", desc: "Déclaration CA et paiement" },
                  { label: "impots.gouv.fr", url: "https://www.impots.gouv.fr", desc: "Déclaration TVA, IS, IR" },
                  { label: "mon-entreprise.urssaf.fr", url: "https://mon-entreprise.urssaf.fr", desc: "Simulateur de charges" },
                  { label: "inpi.fr", url: "https://www.inpi.fr", desc: "Registre du commerce (RNE)" },
                  { label: "net-entreprises.fr", url: "https://www.net-entreprises.fr", desc: "DSN et cotisations sociales" },
                  { label: "chorus-pro.gouv.fr", url: "https://chorus-pro.gouv.fr", desc: "Factures clients publics" },
                ].map(link => (
                  <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors group">
                    <div>
                      <div className="text-sm font-medium text-primary group-hover:underline">{link.label}</div>
                      <div className="text-[10px] text-muted-foreground">{link.desc}</div>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
