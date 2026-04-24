import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.message || "Erreur");
      }
      setSent(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#0a0a0a] items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8">
          <img src="/logo.png" alt="Logo" className="w-9 h-9 object-contain" />
          <div>
            <div className="text-white font-bold">MyTools</div>
            <div className="text-red-500 text-[10px] font-semibold tracking-widest">BUDGET TRACKER</div>
          </div>
        </div>

        {sent ? (
          <div className="bg-[#111] border border-[#222] rounded-2xl p-8 text-center">
            <div className="w-14 h-14 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-7 h-7 text-green-400" />
            </div>
            <h1 className="text-xl font-bold text-white mb-2">Email envoyé !</h1>
            <p className="text-[#666] text-sm mb-6">
              Si <strong className="text-[#aaa]">{email}</strong> est associé à un compte, vous recevrez un lien de réinitialisation dans quelques minutes.
            </p>
            <p className="text-[#555] text-xs mb-6">Vérifiez aussi vos spams.</p>
            <Link href="/login">
              <Button variant="outline" className="border-[#333] text-[#aaa] hover:border-red-500/50">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Retour à la connexion
              </Button>
            </Link>
          </div>
        ) : (
          <div className="bg-[#111] border border-[#222] rounded-2xl p-8">
            <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center mb-5">
              <Mail className="w-6 h-6 text-red-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">Mot de passe oublié</h1>
            <p className="text-[#666] text-sm mb-7">
              Entrez votre adresse email et nous vous enverrons un lien pour réinitialiser votre mot de passe.
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-[#888] uppercase tracking-wider mb-2">
                  Adresse email
                </label>
                <Input
                  type="email"
                  placeholder="contact@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  data-testid="input-forgot-email"
                  className="h-12 bg-[#0a0a0a] border-[#222] text-white placeholder:text-[#444] focus:border-red-500"
                />
              </div>
              {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-red-600 hover:bg-red-700 text-white font-semibold"
                data-testid="button-send-reset"
              >
                {loading ? "Envoi en cours..." : "Envoyer le lien"}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <Link href="/login" className="text-sm text-[#555] hover:text-[#aaa] transition-colors flex items-center justify-center gap-1">
                <ArrowLeft className="w-3.5 h-3.5" /> Retour à la connexion
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
