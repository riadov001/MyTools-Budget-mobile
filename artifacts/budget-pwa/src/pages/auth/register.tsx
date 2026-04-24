import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";

export function Register() {
  const { register, isLoading } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    register({ name, email, password });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <img src="/logo.png" alt="Logo" className="w-10 h-10 object-contain" />
          <div>
            <div className="text-white font-bold text-lg">MyTools</div>
            <div className="text-red-500 text-xs font-semibold tracking-widest">BUDGET TRACKER</div>
          </div>
        </div>

        <div className="bg-[#111111] border border-[#1e1e1e] rounded-2xl p-8 shadow-2xl">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white">Créer un compte</h1>
            <p className="text-[#666] text-sm mt-1">Rejoignez la plateforme comptable expert</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-[#888] uppercase tracking-wider mb-2">Nom complet</label>
              <Input
                placeholder="Jean Dupont"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                data-testid="input-name"
                className="h-12 bg-[#0d0d0d] border-[#222] text-white placeholder:text-[#444] focus:border-red-500 focus:ring-red-500/20"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#888] uppercase tracking-wider mb-2">Email</label>
              <Input
                type="email"
                placeholder="nom@exemple.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                data-testid="input-email"
                className="h-12 bg-[#0d0d0d] border-[#222] text-white placeholder:text-[#444] focus:border-red-500 focus:ring-red-500/20"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#888] uppercase tracking-wider mb-2">Mot de passe</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                data-testid="input-password"
                className="h-12 bg-[#0d0d0d] border-[#222] text-white placeholder:text-[#444] focus:border-red-500 focus:ring-red-500/20"
              />
            </div>
            <Button
              type="submit"
              className="w-full h-12 bg-red-600 hover:bg-red-700 text-white font-semibold text-base rounded-lg transition-all duration-200 shadow-lg shadow-red-900/30"
              disabled={isLoading}
              data-testid="button-register"
            >
              {isLoading ? "Création..." : "Créer un compte"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-[#555]">
            Vous avez déjà un compte ?{" "}
            <Link href="/login" className="text-red-500 font-medium hover:text-red-400 transition-colors">
              Se connecter
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
