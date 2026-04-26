import { useMemo, useState } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Search, Sparkles, ArrowRight, BookOpen, Compass,
  HelpCircle, GraduationCap, ChevronRight, CheckCircle2, Lightbulb,
} from "lucide-react";
import {
  MODULES, GROUPS, GLOSSARY, FAQ, QUICK_START,
  type Lang, type ModuleEntry, type ModuleGroup,
} from "@/lib/modules-catalog";
import {
  GuidedTour, DEFAULT_TOUR_STEPS, markTourCompleted, resetTourState,
} from "@/components/help/guided-tour";

type Tab = "start" | "modules" | "glossary" | "faq";

function tt(s: { fr: string; en: string }, lang: Lang): string {
  return lang === "en" ? s.en : s.fr;
}

export function Help() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const lang: Lang = (user?.language as Lang) ?? "fr";
  const t = (fr: string, en: string) => (lang === "en" ? en : fr);

  const [tab, setTab] = useState<Tab>("start");
  const [search, setSearch] = useState("");
  const [tourOpen, setTourOpen] = useState(false);
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [activeGroup, setActiveGroup] = useState<ModuleGroup | "all">("all");

  const role = user?.role ?? "USER";

  const visibleModules = useMemo(() => {
    return MODULES.filter((m) => {
      if (m.group === "help") return false;
      if (m.roles && !m.roles.includes(role as any)) return false;
      return true;
    });
  }, [role]);

  const filteredModules = useMemo(() => {
    let list = visibleModules;
    if (activeGroup !== "all") {
      list = list.filter((m) => m.group === activeGroup);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((m) => {
        const haystack = [
          tt(m.title, lang), tt(m.tagline, lang), tt(m.description, lang),
          ...m.features.map((f) => tt(f, lang)),
        ].join(" ").toLowerCase();
        return haystack.includes(q);
      });
    }
    return list;
  }, [visibleModules, activeGroup, search, lang]);

  const filteredGlossary = useMemo(() => {
    if (!search.trim()) return GLOSSARY;
    const q = search.toLowerCase();
    return GLOSSARY.filter((g) => {
      return [tt(g.term, lang), tt(g.definition, lang)].join(" ").toLowerCase().includes(q);
    });
  }, [search, lang]);

  const filteredFaq = useMemo(() => {
    if (!search.trim()) return FAQ;
    const q = search.toLowerCase();
    return FAQ.filter((f) => {
      return [tt(f.question, lang), tt(f.answer, lang)].join(" ").toLowerCase().includes(q);
    });
  }, [search, lang]);

  const startTour = () => {
    setTourOpen(true);
  };

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "start", label: t("Démarrer", "Get Started"), icon: Compass },
    { id: "modules", label: t("Modules", "Modules"), icon: BookOpen },
    { id: "glossary", label: t("Glossaire", "Glossary"), icon: GraduationCap },
    { id: "faq", label: t("FAQ", "FAQ"), icon: HelpCircle },
  ];

  return (
    <div className="space-y-6" data-testid="help-page">
      {/* Hero header */}
      <div className="rounded-2xl bg-gradient-to-br from-red-600/10 via-red-600/5 to-transparent border border-red-600/20 p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-600/30 flex items-center justify-center">
                <HelpCircle className="w-5 h-5 text-red-500" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                {t("Centre d'aide", "Help Center")}
              </h1>
            </div>
            <p className="text-sm sm:text-base text-muted-foreground max-w-2xl">
              {t(
                "Découvrez chaque module, suivez la visite guidée interactive, consultez le glossaire comptable et les questions fréquentes.",
                "Discover every module, follow the interactive guided tour, browse the accounting glossary and FAQ.",
              )}
            </p>
          </div>
          <Button
            size="lg"
            onClick={startTour}
            className="bg-red-600 hover:bg-red-700 text-white font-semibold shadow-lg shadow-red-600/30 flex-shrink-0"
            data-testid="button-start-tour"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            {t("Lancer la visite guidée", "Start guided tour")}
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder={t("Rechercher un module, un terme, une question…", "Search a module, term, question…")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-11"
          data-testid="input-help-search"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 sm:gap-2 border-b border-border/50 overflow-x-auto custom-scrollbar pb-px">
        {tabs.map((tb) => {
          const active = tab === tb.id;
          const Icon = tb.icon;
          return (
            <button
              key={tb.id}
              onClick={() => setTab(tb.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors flex-shrink-0 ${
                active
                  ? "border-red-600 text-red-600"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`tab-${tb.id}`}
            >
              <Icon className="w-4 h-4" />
              {tb.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {tab === "start" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-5 border-border/50">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center mb-3">
                <Lightbulb className="w-5 h-5 text-blue-500" />
              </div>
              <h3 className="font-bold text-base mb-1">{t("Pour qui ?", "Who is it for?")}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t(
                  "Indépendants, TPE/PME, comptables et SaaS qui veulent piloter ventes, achats et comptabilité au même endroit.",
                  "Freelancers, SMBs, accountants and SaaS who want to manage sales, purchases and accounting in one place.",
                )}
              </p>
            </Card>
            <Card className="p-5 border-border/50">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center mb-3">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              </div>
              <h3 className="font-bold text-base mb-1">{t("Ce qu'il fait", "What it does")}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t(
                  "Facturation, scan IA des dépenses, comptabilité partie double, suivi de trésorerie, déclarations fiscales.",
                  "Invoicing, AI expense scanning, double-entry accounting, cash tracking, tax filings.",
                )}
              </p>
            </Card>
            <Card className="p-5 border-border/50">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center mb-3">
                <Sparkles className="w-5 h-5 text-purple-500" />
              </div>
              <h3 className="font-bold text-base mb-1">{t("Niveau pro", "Pro grade")}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t(
                  "Architecture comptable équivalente QuickBooks/Xero/YNAB, avec gestion multi-entreprises.",
                  "QuickBooks/Xero/YNAB-grade accounting architecture, with multi-business support.",
                )}
              </p>
            </Card>
          </div>

          <Card className="p-6 border-border/50">
            <div className="flex items-center gap-2 mb-4">
              <Compass className="w-5 h-5 text-red-500" />
              <h2 className="text-xl font-bold">{t("Démarrage en 5 étapes", "5-step quick start")}</h2>
            </div>
            <div className="space-y-3">
              {QUICK_START.map((step) => (
                <div
                  key={step.step}
                  className="flex items-start gap-4 p-4 rounded-xl border border-border/50 hover:border-red-600/40 hover:bg-red-600/5 transition-colors"
                >
                  <div className="w-9 h-9 rounded-full bg-red-600 text-white font-bold flex items-center justify-center flex-shrink-0">
                    {step.step}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-sm sm:text-base mb-1">{tt(step.title, lang)}</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {tt(step.description, lang)}
                    </p>
                  </div>
                  {step.route && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setLocation(step.route!)}
                      className="flex-shrink-0 text-red-600 hover:text-red-700 hover:bg-red-600/10"
                      data-testid={`quickstart-go-${step.step}`}
                    >
                      {t("Y aller", "Go")}
                      <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6 border-border/50 bg-gradient-to-br from-red-600/5 to-transparent">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-red-600/20 border border-red-600/30 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-6 h-6 text-red-500" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-base mb-1">{t("Visite guidée interactive", "Interactive guided tour")}</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  {t(
                    "Un tour de 7 étapes qui met en surbrillance chaque module clé directement dans l'interface.",
                    "A 7-step tour that highlights each key module directly in the interface.",
                  )}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={startTour} className="bg-red-600 hover:bg-red-700 text-white">
                    <Sparkles className="w-4 h-4 mr-2" />
                    {t("Démarrer maintenant", "Start now")}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      resetTourState();
                      startTour();
                    }}
                  >
                    {t("Réinitialiser & rejouer", "Reset & replay")}
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {tab === "modules" && (
        <div className="space-y-4">
          {/* Group filter chips */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveGroup("all")}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                activeGroup === "all"
                  ? "bg-red-600 text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
              data-testid="filter-all"
            >
              {t("Tous", "All")} ({visibleModules.length})
            </button>
            {GROUPS.filter((g) => g.id !== "help").map((g) => {
              const count = visibleModules.filter((m) => m.group === g.id).length;
              if (count === 0) return null;
              return (
                <button
                  key={g.id}
                  onClick={() => setActiveGroup(g.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    activeGroup === g.id
                      ? "bg-red-600 text-white"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                  data-testid={`filter-${g.id}`}
                >
                  {tt(g.label, lang)} ({count})
                </button>
              );
            })}
          </div>

          {filteredModules.length === 0 ? (
            <Card className="p-12 text-center border-border/50">
              <Search className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">{t("Aucun résultat.", "No results.")}</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredModules.map((m) => (
                <ModuleCard
                  key={m.route}
                  module={m}
                  lang={lang}
                  expanded={expandedModule === m.route}
                  onToggle={() => setExpandedModule(expandedModule === m.route ? null : m.route)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "glossary" && (
        <Card className="p-6 border-border/50">
          <div className="flex items-center gap-2 mb-4">
            <GraduationCap className="w-5 h-5 text-red-500" />
            <h2 className="text-xl font-bold">{t("Glossaire comptable", "Accounting Glossary")}</h2>
          </div>
          {filteredGlossary.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">{t("Aucun résultat.", "No results.")}</p>
          ) : (
            <Accordion type="multiple" className="space-y-1">
              {filteredGlossary.map((g, i) => (
                <AccordionItem key={i} value={`gloss-${i}`} className="border-border/50">
                  <AccordionTrigger className="text-left font-semibold hover:no-underline" data-testid={`glossary-${i}`}>
                    {tt(g.term, lang)}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                    {tt(g.definition, lang)}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </Card>
      )}

      {tab === "faq" && (
        <Card className="p-6 border-border/50">
          <div className="flex items-center gap-2 mb-4">
            <HelpCircle className="w-5 h-5 text-red-500" />
            <h2 className="text-xl font-bold">{t("Questions fréquentes", "Frequently Asked Questions")}</h2>
          </div>
          {filteredFaq.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">{t("Aucun résultat.", "No results.")}</p>
          ) : (
            <Accordion type="multiple" className="space-y-1">
              {filteredFaq.map((f, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="border-border/50">
                  <AccordionTrigger className="text-left font-semibold hover:no-underline" data-testid={`faq-${i}`}>
                    {tt(f.question, lang)}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                    {tt(f.answer, lang)}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </Card>
      )}

      <GuidedTour
        steps={DEFAULT_TOUR_STEPS}
        open={tourOpen}
        onClose={() => setTourOpen(false)}
        onComplete={markTourCompleted}
      />
    </div>
  );
}

function ModuleCard({
  module: m,
  lang,
  expanded,
  onToggle,
}: {
  module: ModuleEntry;
  lang: Lang;
  expanded: boolean;
  onToggle: () => void;
}) {
  const Icon = m.icon;
  const t = (fr: string, en: string) => (lang === "en" ? en : fr);

  return (
    <Card
      className={`p-5 border-border/50 transition-all ${expanded ? "border-red-600/40 shadow-lg shadow-red-600/5" : "hover:border-red-600/30"}`}
      data-testid={`module-card-${m.route.replace("/", "") || "home"}`}
    >
      <button
        onClick={onToggle}
        className="w-full text-left"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-600/10 border border-red-600/20 flex items-center justify-center flex-shrink-0">
            <Icon className="w-5 h-5 text-red-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-base">{tt(m.title, lang)}</h3>
              {m.isNew && (
                <Badge className="bg-green-500/15 text-green-600 hover:bg-green-500/20 border-green-500/30 text-[10px]">
                  NEW
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{tt(m.tagline, lang)}</p>
          </div>
          <ChevronRight
            className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`}
          />
        </div>
      </button>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-border/50 space-y-4">
          <p className="text-sm text-foreground leading-relaxed">{tt(m.description, lang)}</p>

          <div>
            <h4 className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-2">
              {t("Fonctionnalités", "Features")}
            </h4>
            <ul className="space-y-1.5">
              {m.features.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">{tt(f, lang)}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-2">
              {t("Comment l'utiliser", "How to use")}
            </h4>
            <ol className="space-y-1.5">
              {m.howTo.map((h, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="w-5 h-5 rounded-full bg-red-600/15 text-red-600 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-muted-foreground">{tt(h, lang)}</span>
                </li>
              ))}
            </ol>
          </div>

          <Link href={m.route}>
            <Button className="w-full bg-red-600 hover:bg-red-700 text-white" data-testid={`module-open-${m.route.replace("/", "") || "home"}`}>
              {t("Ouvrir le module", "Open module")}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      )}
    </Card>
  );
}
