import { Link, useLocation } from "wouter";
import { useContext, useState } from "react";
import {
  LayoutDashboard, FileText, ShoppingCart, CreditCard, RotateCcw,
  Receipt, BookOpen, List, Users, Settings, LogOut, Building2,
  Wallet, ChevronDown, Package, KeyRound, Calendar, BarChart3,
  Landmark, ShieldAlert, Calculator, ScanLine
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { AppContext } from "@/hooks/app-context";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type NavItem = {
  title: string;
  titleEn: string;
  url: string;
  icon: React.ElementType;
};

type NavGroup = {
  label: string;
  labelEn: string;
  items: NavItem[];
  collapsible?: boolean;
};

function AppSelector() {
  const { activeAppId, setApp, applications } = useContext(AppContext);
  const lang = localStorage.getItem("language") ?? "fr";
  const t = (fr: string, en: string) => lang === "en" ? en : fr;

  return (
    <div className="space-y-1">
      <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "hsl(0 0% 40%)" }}>
        {t("Application", "Application")}
      </label>
      <Select value={activeAppId?.toString() ?? "0"} onValueChange={(v) => setApp(v === "0" ? 0 : parseInt(v))}>
        <SelectTrigger className="h-8 text-xs bg-zinc-900 border-zinc-800">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="0">{t("Toutes les apps", "All Apps")}</SelectItem>
          {applications.map(app => (
            <SelectItem key={app.id} value={app.id.toString()}>{app.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function AppSidebar({ onClose }: { onClose?: () => void }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const lang = user?.language ?? "fr";
  const t = (fr: string, en: string) => lang === "en" ? en : fr;

  const groups: NavGroup[] = [
    {
      label: "Vue générale",
      labelEn: "Overview",
      items: [
        { title: "Tableau de Bord", titleEn: "Dashboard", url: "/", icon: LayoutDashboard },
        { title: "Analyses avancées", titleEn: "Advanced Analytics", url: "/analytics", icon: BarChart3 },
        { title: "Agenda", titleEn: "Agenda", url: "/agenda", icon: Calendar },
      ],
    },
    {
      label: "Ventes",
      labelEn: "Sales",
      collapsible: true,
      items: [
        { title: "Factures clients", titleEn: "Invoices", url: "/invoices", icon: FileText },
        { title: "Avoirs", titleEn: "Credit Notes", url: "/credit-notes", icon: RotateCcw },
        { title: "Clients", titleEn: "Clients", url: "/clients", icon: Users },
      ],
    },
    {
      label: "Achats",
      labelEn: "Purchases",
      collapsible: true,
      items: [
        { title: "Factures fournisseurs", titleEn: "Supplier Invoices", url: "/supplier-invoices", icon: ShoppingCart },
        { title: "Dépenses", titleEn: "Expenses", url: "/expenses", icon: Receipt },
        { title: "Scan OCR", titleEn: "OCR Scan", url: "/ocr-scan", icon: ScanLine },
        { title: "Fournisseurs", titleEn: "Suppliers", url: "/suppliers", icon: Package },
      ],
    },
    {
      label: "Trésorerie",
      labelEn: "Treasury",
      collapsible: true,
      items: [
        { title: "Paiements", titleEn: "Payments", url: "/payments", icon: CreditCard },
        { title: "Abonnements SaaS", titleEn: "SaaS Services", url: "/services", icon: Wallet },
        { title: "Open Banking", titleEn: "Open Banking", url: "/banking", icon: Landmark },
      ],
    },
    {
      label: "Comptabilité",
      labelEn: "Accounting",
      collapsible: true,
      items: [
        { title: "Module Comptabilité", titleEn: "Accounting Module", url: "/accounting", icon: BookOpen },
        { title: "Journal des écritures", titleEn: "Journal Entries", url: "/journal", icon: List },
        { title: "Plan comptable", titleEn: "Chart of Accounts", url: "/accounts", icon: List },
        { title: "URSSAF & Impôts", titleEn: "URSSAF & Taxes", url: "/urssaf", icon: Calculator },
      ],
    },
    {
      label: "Administration",
      labelEn: "Administration",
      items: [
        { title: "Utilisateurs", titleEn: "Users", url: "/users", icon: Users },
        { title: "Paramètres", titleEn: "Settings", url: "/settings", icon: Settings },
        ...(user?.role === "SUPER_ADMIN" || user?.role === "ROOT_ADMIN"
          ? [
              { title: "Applications", titleEn: "Applications", url: "/applications", icon: Building2 },
              { title: "Gestion API", titleEn: "API Manager", url: "/api-manager", icon: KeyRound },
            ]
          : []),
        ...(user?.role === "ROOT_ADMIN"
          ? [{ title: "Super Dashboard", titleEn: "Super Dashboard", url: "/root-admin", icon: ShieldAlert }]
          : []),
      ],
    },
  ];

  const toggleGroup = (label: string) => {
    setCollapsed(prev => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <aside
      className="flex flex-col h-full w-full overflow-y-auto"
      style={{ background: "hsl(0 0% 7%)", borderRight: "1px solid hsl(0 0% 14%)" }}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-6 flex-shrink-0" style={{ borderBottom: "1px solid hsl(0 0% 14%)" }}>
        <div className="flex items-center gap-3">
          <img src={`${import.meta.env.BASE_URL}logo.jpg`} alt="Logo" className="w-10 h-10 rounded-lg flex-shrink-0 object-cover shadow-lg shadow-red-600/20" />
          <div className="min-w-0">
            <div className="text-white font-bold text-base leading-tight">Budget By</div>
            <div className="text-red-500 text-[10px] font-bold tracking-[0.2em] uppercase mt-0.5 opacity-80">MyTools</div>
          </div>
        </div>
        
        {/* Mobile close button */}
        <button 
          onClick={() => onClose?.()}
          className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 text-white/50 hover:text-white transition-colors"
        >
          <ChevronDown className="w-4 h-4 rotate-90" />
        </button>
      </div>

      {/* App Selector or User badge */}
      <div className="px-5 py-4 flex-shrink-0 space-y-3" style={{ borderBottom: "1px solid hsl(0 0% 14%)" }}>
        {/* Show app selector for super/root admins */}
        {(user?.role === "SUPER_ADMIN" || user?.role === "ROOT_ADMIN") && (
          <AppSelector />
        )}
        
        {/* User badge */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-600/20 border border-red-600/30 flex items-center justify-center text-red-500 text-sm font-bold flex-shrink-0">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div className="overflow-hidden">
            <div className="text-white text-sm font-bold truncate leading-none">{user?.name}</div>
            <div className="text-[10px] truncate mt-1 font-medium" style={{ color: "hsl(0 0% 45%)" }}>{user?.email}</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto custom-scrollbar-dark">
        {groups.map((group) => {
          const isCollapsed = collapsed[group.label];
          return (
            <div key={group.label}>
              <button
                onClick={() => group.collapsible && toggleGroup(group.label)}
                className={cn(
                  "flex items-center justify-between w-full px-2 mb-1",
                  group.collapsible && "cursor-pointer"
                )}
              >
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "hsl(0 0% 40%)" }}>
                  {t(group.label, group.labelEn)}
                </span>
                {group.collapsible && (
                  <ChevronDown
                    className={cn("w-3 h-3 transition-transform", isCollapsed && "-rotate-90")}
                    style={{ color: "hsl(0 0% 40%)" }}
                  />
                )}
              </button>

              {!isCollapsed && (
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const isActive = location === item.url;
                    return (
                      <Link key={item.url} href={item.url} onClick={() => onClose?.()}>
                        <div
                          data-testid={`nav-${item.url.replace("/", "") || "home"}`}
                          className={cn(
                            "flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm font-medium cursor-pointer transition-all duration-150",
                          )}
                          style={isActive ? {
                            background: "#dc2626",
                            color: "white",
                            boxShadow: "0 4px 14px rgba(220,38,38,0.35)"
                          } : {
                            color: "hsl(0 0% 65%)",
                          }}
                          onMouseEnter={e => {
                            if (!isActive) {
                              (e.currentTarget as HTMLDivElement).style.background = "hsl(0 0% 14%)";
                              (e.currentTarget as HTMLDivElement).style.color = "white";
                            }
                          }}
                          onMouseLeave={e => {
                            if (!isActive) {
                              (e.currentTarget as HTMLDivElement).style.background = "transparent";
                              (e.currentTarget as HTMLDivElement).style.color = "hsl(0 0% 65%)";
                            }
                          }}
                        >
                          <item.icon className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate">{t(item.title, item.titleEn)}</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 pb-6 pt-3 flex-shrink-0" style={{ borderTop: "1px solid hsl(0 0% 14%)" }}>
        <button
          onClick={() => logout()}
          className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-sm transition-all duration-200 font-medium"
          style={{ color: "hsl(0 0% 50%)" }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(239, 68, 68, 0.1)";
            (e.currentTarget as HTMLButtonElement).style.color = "#ef4444";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            (e.currentTarget as HTMLButtonElement).style.color = "hsl(0 0% 50%)";
          }}
          data-testid="button-logout"
        >
          <LogOut className="w-4 h-4" />
          <span>{t("Déconnexion", "Sign Out")}</span>
        </button>
      </div>
    </aside>
  );
}
