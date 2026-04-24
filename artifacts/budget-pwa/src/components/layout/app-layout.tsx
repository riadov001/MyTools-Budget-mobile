import { ReactNode, useState } from "react";
import { AppSidebar } from "./app-sidebar";
import { useAuth } from "@/hooks/use-auth";
import { useAppContext } from "@/hooks/use-app-context";
import { useQuery } from "@tanstack/react-query";
import { Menu, Building2, ChevronDown, Check, LayoutDashboard, TrendingUp, Receipt, Wallet, ArrowRight, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Application } from "@shared/schema";

function AppSelector() {
  const { activeApp, activeAppId, setApp, applications } = useAppContext();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 border-red-200 dark:border-red-900/40 text-sm max-w-[220px] h-9"
          data-testid="button-app-selector"
        >
          <Building2 className="w-4 h-4 text-red-600 flex-shrink-0" />
          <span className="truncate font-semibold">
            {activeApp ? activeApp.name : "Choisir un SaaS"}
          </span>
          <ChevronDown className="w-3 h-3 flex-shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wide">
          Applications SaaS disponibles
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {applications.length === 0 && (
          <div className="text-sm text-muted-foreground px-2 py-3 text-center">Aucune application</div>
        )}
          {applications.map(app => (
          <DropdownMenuItem
            key={app.id}
            onClick={() => setApp(app.id)}
            className="gap-2 cursor-pointer py-3"
            data-testid={`app-option-${app.id}`}
          >
            <div className="w-8 h-8 rounded-lg bg-red-600/10 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-4 h-4 text-red-600" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-sm truncate">{app.name}</div>
              {app.description && (
                <div className="text-[10px] text-muted-foreground truncate leading-tight mt-0.5">{app.description}</div>
              )}
            </div>
            {activeAppId === app.id && <Check className="w-4 h-4 text-green-500 flex-shrink-0" />}
          </DropdownMenuItem>
        ))}
        {activeAppId && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setApp(null)}
              className="gap-2 cursor-pointer text-muted-foreground text-xs"
            >
              Changer d'application
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NoAppSelected() {
  const { applications, setApp } = useAppContext();
  const { user, logout } = useAuth();

  return (
    <div className="flex-1 flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-red-600/10 border border-red-600/20 flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Sélectionnez un SaaS</h2>
          <p className="text-muted-foreground text-sm">
            En tant que Super Admin, choisissez l'application dont vous souhaitez gérer les données comptables et financières.
          </p>
        </div>

        {/* App cards */}
        <div className="grid grid-cols-1 gap-3 mb-8">
          {applications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm border border-border/50 rounded-xl">
              Aucune application disponible.
            </div>
          ) : applications.map(app => (
            <button
              key={app.id}
              onClick={() => setApp(app.id)}
              className="w-full flex items-center gap-3 p-4 rounded-xl border border-border hover:border-red-400 bg-card hover:bg-red-50 dark:hover:bg-red-900/10 transition-all text-left group"
              data-testid={`select-app-${app.id}`}
            >
              <div className="w-10 h-10 rounded-lg bg-red-600/10 group-hover:bg-red-600/20 flex items-center justify-center flex-shrink-0 transition-colors">
                <Building2 className="w-5 h-5 text-red-600" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-sm sm:text-base truncate">{app.name}</div>
                {app.description && (
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">{app.description}</div>
                )}
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-md">
                    <TrendingUp className="w-3 h-3" /> Revenus
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-md">
                    <Receipt className="w-3 h-3" /> Dépenses
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-md">
                    <Wallet className="w-3 h-3" /> SaaS
                  </span>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-red-600 group-hover:translate-x-1 transition-all flex-shrink-0" />
            </button>
          ))}
        </div>

        {/* Footer info */}
        <div className="text-center">
          <p className="text-xs text-muted-foreground mb-3">
            Connecté en tant que <span className="font-semibold text-foreground">{user?.name}</span> · Super Administrateur
          </p>
          <button
            onClick={() => logout()}
            className="text-xs text-muted-foreground hover:text-red-500 transition-colors underline"
          >
            Se déconnecter
          </button>
        </div>
      </div>
    </div>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { needsAppSelection, activeApp } = useAppContext();
  const lang = user?.language ?? "fr";
  const t = (fr: string, en: string) => lang === "en" ? en : fr;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isSuperAdmin = user?.role === "SUPER_ADMIN" || user?.role === "ROOT_ADMIN";

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — always visible */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 transform transition-all duration-300 ease-in-out
        lg:relative lg:translate-x-0 lg:flex-shrink-0
        ${sidebarOpen ? "translate-x-0 shadow-2xl shadow-black/50" : "-translate-x-full lg:translate-x-0"}
      `}>
        <AppSidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Topbar */}
        <header className="h-16 flex items-center justify-between px-4 sm:px-6 border-b border-border/50 bg-card/50 backdrop-blur-md sticky top-0 z-30 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden w-10 h-10 flex items-center justify-center rounded-xl bg-primary/5 hover:bg-primary/10 text-primary transition-colors flex-shrink-0"
              data-testid="button-open-sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 min-w-0">
              {/* App selector — always visible for Super Admin */}
              {isSuperAdmin && <div className="max-w-[180px] sm:max-w-none"><AppSelector /></div>}

              {!isSuperAdmin && (
                <div className="text-xs font-medium text-muted-foreground truncate hidden sm:block">
                  {new Date().toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US", {
                    weekday: "short", day: "numeric", month: "short"
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            {isSuperAdmin && activeApp && (
              <Badge variant="outline" className="hidden md:flex items-center gap-1.5 bg-primary/5 border-primary/20 text-primary py-1">
                <LayoutDashboard className="w-3 h-3" />
                {activeApp.name}
              </Badge>
            )}
            <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-green-500/10 border border-green-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
              <span className="text-[10px] font-bold text-green-600 uppercase tracking-tight hidden xs:block">{t("En ligne", "Live")}</span>
            </div>
          </div>
        </header>

        {/* Page content OR app selection screen */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar bg-muted/5">
          {needsAppSelection ? (
            <NoAppSelected />
          ) : (
            <main className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto w-full animate-in fade-in duration-500">
              {children}
            </main>
          )}
        </div>
      </div>
    </div>
  );
}
