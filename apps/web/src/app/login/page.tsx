"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [method, setMethod] = useState<"google" | "email">("google");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  async function signInWithGoogle() {
    setLoading(true);
    setError("");
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  async function signInWithEmail() {
    if (!email.trim()) return;
    setLoading(true);
    setError("");
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (err) {
      setError(err.message);
      setLoading(false);
    } else {
      setSent(true);
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto mt-16">
      <div className="border border-[#e5e7eb] p-8">
        <h1 className="text-xl font-bold mb-1">Unirte a la auditoría</h1>
        <p className="text-sm text-[#6b7280] mb-6">
          Ayuda a revisar los 121,951 formularios E-14 de la segunda vuelta presidencial 2026.
        </p>

        {/* Method tabs */}
        <div className="flex border border-[#e5e7eb] mb-6 text-xs">
          <button
            onClick={() => { setMethod("google"); setError(""); setSent(false); }}
            className={`flex-1 py-2 font-medium transition-colors ${method === "google" ? "bg-[#0a0a0a] text-white" : "text-[#6b7280] hover:bg-[#f9fafb]"}`}
          >
            Continuar con Google
          </button>
          <button
            onClick={() => { setMethod("email"); setError(""); setSent(false); }}
            className={`flex-1 py-2 font-medium transition-colors ${method === "email" ? "bg-[#0a0a0a] text-white" : "text-[#6b7280] hover:bg-[#f9fafb]"}`}
          >
            Link por email
          </button>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 mb-4">
            {error}
          </p>
        )}

        {method === "google" && (
          <div>
            <button
              onClick={signInWithGoogle}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 border border-[#e5e7eb] px-4 py-3 text-sm font-medium hover:bg-[#f9fafb] transition-colors disabled:opacity-50"
            >
              <GoogleIcon />
              {loading ? "Redirigiendo a Google..." : "Continuar con Google"}
            </button>
            <p className="text-xs text-[#9ca3af] mt-3 text-center">
              Si ves un error de Google OAuth, usa el método <button onClick={() => setMethod("email")} className="underline text-blue-600">Link por email</button>
            </p>
          </div>
        )}

        {method === "email" && !sent && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-[#6b7280] mb-1">Tu correo electrónico</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && void signInWithEmail()}
                placeholder="tu@correo.com"
                className="w-full border border-[#e5e7eb] px-3 py-2 text-sm focus:outline-none focus:border-[#0a0a0a]"
              />
            </div>
            <button
              onClick={() => void signInWithEmail()}
              disabled={loading || !email.trim()}
              className="w-full bg-[#0a0a0a] text-white py-2.5 text-sm font-medium hover:bg-[#374151] disabled:opacity-50 transition-colors"
            >
              {loading ? "Enviando..." : "Enviar link de acceso"}
            </button>
            <p className="text-xs text-[#9ca3af]">
              Te enviaremos un link de un solo uso a tu correo. No necesitas contraseña.
            </p>
          </div>
        )}

        {method === "email" && sent && (
          <div className="border border-green-200 bg-green-50 p-5 text-center">
            <div className="text-2xl mb-2">✉</div>
            <p className="font-semibold text-green-800 text-sm">Link enviado a {email}</p>
            <p className="text-xs text-green-700 mt-1">
              Revisa tu bandeja de entrada y haz clic en el link para ingresar.
            </p>
            <button
              onClick={() => { setSent(false); setEmail(""); }}
              className="mt-3 text-xs text-green-600 underline"
            >
              Usar otro correo
            </button>
          </div>
        )}

        <div className="mt-8 border-t border-[#e5e7eb] pt-6 space-y-2 text-xs text-[#9ca3af]">
          <p>• Tu API key de IA se guarda cifrada (AES-256-GCM), nunca expuesta</p>
          <p>• Solo procesamos datos oficiales de la Registraduría Nacional</p>
          <p>• Código abierto · MIT · Colombia 2026</p>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}
