import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { Eye, EyeOff } from "lucide-react";

export function Login() {
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login({ email, password });
  };

  return (
    <div className="min-h-screen flex bg-[#0a0a0a]">
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-[#111111] border-r border-[#1e1e1e] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-red-900/20 via-transparent to-transparent pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <img src={`${import.meta.env.BASE_URL}logo.jpg`} alt="Logo" className="w-10 h-10 object-cover rounded-lg" />
            <div>
              <div className="text-white font-bold text-lg">Budget By</div>
              <div className="text-red-500 text-xs font-semibold tracking-widest">MYTOOLS</div>
            </div>
          </div>
        </div>
        <div className="relative z-10 space-y-6">
          <h2 className="text-4xl font-bold text-white leading-tight">
            Gérez vos finances<br />
            <span className="text-red-500">avec précision</span>
          </h2>
          <p className="text-[#888] text-lg max-w-sm">
            Plateforme comptable complète — Factures, dépenses, journal, plan comptable et suivi SaaS.
          </p>
          <div className="flex flex-col gap-3">
            {[
              "Facturation clients & fournisseurs",
              "Comptabilité en partie double",
              "Suivi des abonnements SaaS",
              "Connexion bancaire Open Banking",
              "Rapports financiers PDF",
              "Scanner IA de documents",
            ].map(f => (
              <div key={f} className="flex items-center gap-2 text-sm text-[#aaa]">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                {f}
              </div>
            ))}
          </div>
        </div>
        <div className="relative z-10 text-xs text-[#444]">© 2026 Budget By MyTools</div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12">
        <div className="flex items-center gap-3 mb-8 lg:hidden">
          <img src={`${import.meta.env.BASE_URL}logo.jpg`} alt="Logo" className="w-10 h-10 object-cover rounded-lg" />
          <div>
            <div className="text-white font-bold text-lg">Budget By</div>
            <div className="text-red-500 text-xs font-semibold tracking-widest">MYTOOLS</div>
          </div>
        </div>

        <div className="w-full max-w-md">
          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-white">Connexion</h1>
            <p className="text-[#666] text-sm mt-1">Accédez à votre espace de gestion comptable</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-[#888] uppercase tracking-wider mb-2">Email</label>
              <Input
                type="email"
                placeholder="contact@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                data-testid="input-email"
                className="h-12 bg-[#111] border-[#222] text-white placeholder:text-[#444] focus:border-red-500 focus:ring-red-500/20"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-[#888] uppercase tracking-wider">Mot de passe</label>
                <Link href="/forgot-password" className="text-xs text-red-500 hover:text-red-400 transition-colors" data-testid="link-forgot-password">
                  Mot de passe oublié ?
                </Link>
              </div>
              <div className="relative">
                <Input
                  type={showPw ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  data-testid="input-password"
                  className="h-12 bg-[#111] border-[#222] text-white placeholder:text-[#444] focus:border-red-500 focus:ring-red-500/20 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555] hover:text-[#aaa] transition-colors"
                  tabIndex={-1}
                  data-testid="button-toggle-password"
                >
                  {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <Button
              type="submit"
              className="w-full h-12 bg-red-600 hover:bg-red-700 text-white font-semibold text-base rounded-lg transition-all duration-200 shadow-lg shadow-red-900/30"
              disabled={isLoading}
              data-testid="button-login"
            >
              {isLoading ? "Connexion..." : "Se connecter"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-[#555]">
            Vous n'avez pas de compte ?{" "}
            <Link href="/register" className="text-red-500 font-medium hover:text-red-400 transition-colors">
              S'inscrire
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
