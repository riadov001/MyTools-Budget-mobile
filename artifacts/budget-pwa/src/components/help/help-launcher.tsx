import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { HelpCircle, Sparkles, BookOpen, X } from "lucide-react";
import {
  GuidedTour, DEFAULT_TOUR_STEPS, markTourCompleted, shouldAutoStartTour,
} from "./guided-tour";

export function HelpLauncher() {
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);

  useEffect(() => {
    if (shouldAutoStartTour()) {
      const id = window.setTimeout(() => setTourOpen(true), 1200);
      return () => window.clearTimeout(id);
    }
  }, []);

  return (
    <>
      {/* Floating button */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3" data-testid="help-launcher">
        {open && (
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl p-2 w-60 animate-in fade-in slide-in-from-bottom-2 duration-150">
            <button
              onClick={() => {
                setOpen(false);
                setTourOpen(true);
              }}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg hover:bg-red-600/15 transition-colors text-left group"
              data-testid="launcher-tour"
            >
              <div className="w-8 h-8 rounded-lg bg-red-600/20 border border-red-600/30 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-red-500" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-sm text-white">Visite guidée</div>
                <div className="text-[10px] text-zinc-400">Tour interactif des modules</div>
              </div>
            </button>
            <button
              onClick={() => {
                setOpen(false);
                setLocation("/help");
              }}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg hover:bg-red-600/15 transition-colors text-left group"
              data-testid="launcher-help"
            >
              <div className="w-8 h-8 rounded-lg bg-red-600/20 border border-red-600/30 flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-4 h-4 text-red-500" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-sm text-white">Centre d'aide</div>
                <div className="text-[10px] text-zinc-400">Documentation, FAQ, glossaire</div>
              </div>
            </button>
          </div>
        )}

        <button
          onClick={() => setOpen((v) => !v)}
          className="w-12 h-12 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-xl shadow-red-600/40 flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
          aria-label="Aide"
          data-testid="button-help-launcher"
        >
          {open ? <X className="w-5 h-5" /> : <HelpCircle className="w-5 h-5" />}
        </button>
      </div>

      <GuidedTour
        steps={DEFAULT_TOUR_STEPS}
        open={tourOpen}
        onClose={() => setTourOpen(false)}
        onComplete={markTourCompleted}
      />
    </>
  );
}
