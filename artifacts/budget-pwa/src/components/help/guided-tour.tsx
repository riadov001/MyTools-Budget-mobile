import { useEffect, useState, useCallback, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "wouter";
import { ChevronLeft, ChevronRight, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export type TourStep = {
  selector: string;
  title: string;
  body: string;
  navigateTo?: string;
};

type Rect = { top: number; left: number; width: number; height: number };

const PADDING = 8;

function getRect(selector: string): Rect | null {
  const el = document.querySelector(selector) as HTMLElement | null;
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return {
    top: Math.max(0, r.top - PADDING),
    left: Math.max(0, r.left - PADDING),
    width: r.width + PADDING * 2,
    height: r.height + PADDING * 2,
  };
}

export function GuidedTour({
  steps,
  open,
  onClose,
  onComplete,
}: {
  steps: TourStep[];
  open: boolean;
  onClose: () => void;
  onComplete?: () => void;
}) {
  const [, setLocation] = useLocation();
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const step = steps[index];

  const measure = useCallback(() => {
    if (!step) return;
    const r = getRect(step.selector);
    setRect(r);
    if (!r && retryCount < 20) {
      setRetryCount((c) => c + 1);
    }
  }, [step, retryCount]);

  useLayoutEffect(() => {
    if (!open) return;
    setRetryCount(0);
    if (step?.navigateTo) {
      setLocation(step.navigateTo);
    }
    const id = window.setTimeout(measure, 80);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, open]);

  useEffect(() => {
    if (!open || rect || retryCount === 0) return;
    const id = window.setTimeout(measure, 100);
    return () => window.clearTimeout(id);
  }, [retryCount, rect, open, measure]);

  useEffect(() => {
    if (!open) return;
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [open, measure]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIndex((i) => Math.min(i + 1, steps.length - 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, steps.length]);

  if (!open || !step) return null;

  const isLast = index === steps.length - 1;
  const isFirst = index === 0;

  const cardWidth = 360;
  const cardEstHeight = 220;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let cardLeft = vw / 2 - cardWidth / 2;
  let cardTop = vh / 2 - cardEstHeight / 2;
  if (rect) {
    const spaceRight = vw - (rect.left + rect.width);
    const spaceBelow = vh - (rect.top + rect.height);
    if (spaceRight >= cardWidth + 20) {
      cardLeft = rect.left + rect.width + 16;
      cardTop = Math.max(16, Math.min(vh - cardEstHeight - 16, rect.top));
    } else if (spaceBelow >= cardEstHeight + 20) {
      cardTop = rect.top + rect.height + 16;
      cardLeft = Math.max(16, Math.min(vw - cardWidth - 16, rect.left));
    } else if (rect.left >= cardWidth + 20) {
      cardLeft = rect.left - cardWidth - 16;
      cardTop = Math.max(16, Math.min(vh - cardEstHeight - 16, rect.top));
    } else {
      cardTop = Math.max(16, rect.top - cardEstHeight - 16);
      cardLeft = Math.max(16, Math.min(vw - cardWidth - 16, rect.left));
    }
  }

  const handleClose = () => {
    onClose();
  };

  const handleComplete = () => {
    onComplete?.();
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999]" data-testid="guided-tour-overlay">
      {/* Backdrop with cutout */}
      {rect ? (
        <>
          {/* Top */}
          <div
            className="absolute bg-black/70 backdrop-blur-[2px] transition-all duration-200"
            style={{ top: 0, left: 0, right: 0, height: rect.top }}
            onClick={handleClose}
          />
          {/* Bottom */}
          <div
            className="absolute bg-black/70 backdrop-blur-[2px] transition-all duration-200"
            style={{ top: rect.top + rect.height, left: 0, right: 0, bottom: 0 }}
            onClick={handleClose}
          />
          {/* Left */}
          <div
            className="absolute bg-black/70 backdrop-blur-[2px] transition-all duration-200"
            style={{ top: rect.top, left: 0, width: rect.left, height: rect.height }}
            onClick={handleClose}
          />
          {/* Right */}
          <div
            className="absolute bg-black/70 backdrop-blur-[2px] transition-all duration-200"
            style={{ top: rect.top, left: rect.left + rect.width, right: 0, height: rect.height }}
            onClick={handleClose}
          />
          {/* Highlight ring */}
          <div
            className="absolute pointer-events-none rounded-lg transition-all duration-200"
            style={{
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
              boxShadow: "0 0 0 3px #dc2626, 0 0 30px rgba(220, 38, 38, 0.6)",
            }}
          />
        </>
      ) : (
        <div
          className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
          onClick={handleClose}
        />
      )}

      {/* Card */}
      <div
        className="absolute bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl p-5 transition-all duration-200"
        style={{
          width: cardWidth,
          top: cardTop,
          left: cardLeft,
        }}
        data-testid="guided-tour-card"
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-600/20 border border-red-600/30 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-red-500" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                Étape {index + 1} / {steps.length}
              </div>
              <h3 className="text-white font-bold text-base leading-tight">{step.title}</h3>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-zinc-500 hover:text-white transition-colors"
            data-testid="guided-tour-close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-zinc-300 leading-relaxed mb-4">{step.body}</p>

        {/* Progress dots */}
        <div className="flex gap-1 mb-4">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all ${
                i === index ? "bg-red-600" : i < index ? "bg-red-600/40" : "bg-zinc-700"
              }`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={isFirst}
            className="text-zinc-400 hover:text-white"
            data-testid="guided-tour-prev"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Précédent
          </Button>
          {isLast ? (
            <Button
              size="sm"
              onClick={handleComplete}
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="guided-tour-finish"
            >
              Terminer
              <Sparkles className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => setIndex((i) => Math.min(steps.length - 1, i + 1))}
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="guided-tour-next"
            >
              Suivant
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export const DEFAULT_TOUR_STEPS: TourStep[] = [
  {
    selector: "[data-testid='nav-home']",
    title: "Tableau de Bord",
    body: "Votre vue d'ensemble quotidienne : chiffre d'affaires, dépenses, trésorerie et alertes en un coup d'œil.",
    navigateTo: "/",
  },
  {
    selector: "[data-testid='nav-invoices']",
    title: "Factures clients",
    body: "Créez vos factures de vente, envoyez-les par email et suivez les paiements automatiquement.",
  },
  {
    selector: "[data-testid='nav-ocr-scan']",
    title: "Scan OCR intelligent",
    body: "Photographiez ou importez une facture papier : l'IA extrait fournisseur, montants et TVA en quelques secondes.",
  },
  {
    selector: "[data-testid='nav-payments']",
    title: "Paiements & lettrage",
    body: "Enregistrez encaissements et décaissements. Le lettrage automatique relie chaque paiement à sa facture.",
  },
  {
    selector: "[data-testid='nav-accounting']",
    title: "Comptabilité partie double",
    body: "Bilan, compte de résultat et grand livre générés automatiquement. Niveau professionnel équivalent QuickBooks/Xero.",
  },
  {
    selector: "[data-testid='nav-analytics']",
    title: "Analyses avancées",
    body: "Allez plus loin : top clients, répartition des dépenses, comparaisons année-sur-année, exports PDF/Excel.",
  },
  {
    selector: "[data-testid='nav-help']",
    title: "Centre d'aide",
    body: "Vous pouvez toujours revenir ici pour la documentation complète, le glossaire comptable et la FAQ. Bonne route !",
  },
];

export const TOUR_STORAGE_KEY = "mytools-tour-completed-v1";

export function shouldAutoStartTour(): boolean {
  try {
    return localStorage.getItem(TOUR_STORAGE_KEY) !== "1";
  } catch {
    return false;
  }
}

export function markTourCompleted(): void {
  try {
    localStorage.setItem(TOUR_STORAGE_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function resetTourState(): void {
  try {
    localStorage.removeItem(TOUR_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
