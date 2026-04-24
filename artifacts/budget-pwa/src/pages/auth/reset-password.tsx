import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, useLocation } from "wouter";
import { Eye, EyeOff, Lock, CheckCircle, AlertTriangle } from "lucide-react";

export function ResetPassword() {
  const [location] = useLocation();
  const token = new URLSearchParams(window.location.search).get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError("Les mots de passe ne correspondent pas."); return; }
    if (password.length < 6) { setError("Le mot de passe doit contenir au moins 6 caractères."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message || "Erreur");
      setDone(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!token) return (
    <div className="min-h-screen flex bg-[#0a0a0a] items-center justify-center p-6">
      <div className="w-full max-w-md bg-[#111] border border-[#222] rounded-2xl p-8 text-center">
        <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <h1 className="text-xl font-bold text-white mb-2">Lien invalide</h1>
        <p className="text-[#666] text-sm mb-6">Ce lien de réinitialisation est invalide ou a expiré.</p>
        <Link href="/forgot-password"><Button className="bg-red-600 hover:bg-red-700">Demander un nouveau lien</Button></Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#0a0a0a] items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8">
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Logo" className="w-9 h-9 object-contain" />
          <div>
            <div className="text-white font-bold">MyTools</div>
            <div className="text-red-500 text-[10px] font-semibold tracking-widest">BUDGET TRACKER</div>
          </div>
        </div>

        {done ? (
          <div className="bg-[#111] border border-[#222] rounded-2xl p-8 text-center">
            <div className="w-14 h-14 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-7 h-7 text-green-400" />
            </div>
            <h1 className="text-xl font-bold text-white mb-2">Mot de passe réinitialisé !</h1>
            <p className="text-[#666] text-sm mb-6">Votre mot de passe a été mis à jour avec succès.</p>
            <Link href="/login">
              <Button className="bg-red-600 hover:bg-red-700">Se connecter</Button>
            </Link>
          </div>
        ) : (
          <div className="bg-[#111] border border-[#222] rounded-2xl p-8">
            <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center mb-5">
              <Lock className="w-6 h-6 text-red-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">Nouveau mot de passe</h1>
            <p className="text-[#666] text-sm mb-7">Choisissez un mot de passe fort d'au moins 6 caractères.</p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-[#888] uppercase tracking-wider mb-2">Nouveau mot de passe</label>
                <div className="relative">
                  <Input
                    type={showPw ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    data-testid="input-new-password"
                    className="h-12 bg-[#0a0a0a] border-[#222] text-white placeholder:text-[#444] focus:border-red-500 pr-12"
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555] hover:text-[#aaa]" tabIndex={-1}>
                    {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#888] uppercase tracking-wider mb-2">Confirmer le mot de passe</label>
                <Input
                  type={showPw ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  data-testid="input-confirm-password"
                  className="h-12 bg-[#0a0a0a] border-[#222] text-white placeholder:text-[#444] focus:border-red-500"
                />
              </div>
              {password && confirm && (
                <p className={`text-xs ${password === confirm ? "text-green-400" : "text-red-400"}`}>
                  {password === confirm ? "✓ Les mots de passe correspondent" : "✗ Les mots de passe ne correspondent pas"}
                </p>
              )}
              {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-red-600 hover:bg-red-700 text-white font-semibold"
                data-testid="button-reset-password"
              >
                {loading ? "Réinitialisation..." : "Réinitialiser le mot de passe"}
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
