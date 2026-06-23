"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";
      const endpoint = tab === "login" ? "/auth/login" : "/auth/register";
      const body = tab === "login"
        ? { email, password }
        : { email, name, password };

      const res = await fetch(BASE + endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Error");

      localStorage.setItem("conteo_token", data.token);
      localStorage.setItem("conteo_user", JSON.stringify(data.user));
      router.push("/auditar");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto mt-10">
      <div className="border border-[#e5e7eb] p-8">
        <h1 className="text-xl font-bold mb-1">Unirte a la auditoría</h1>
        <p className="text-sm text-[#6b7280] mb-6">
          Ayuda a revisar los formularios E-14 de la segunda vuelta 2026
        </p>

        <div className="flex border-b border-[#e5e7eb] mb-6">
          {(["login", "register"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t
                  ? "border-[#0a0a0a] text-[#0a0a0a]"
                  : "border-transparent text-[#6b7280] hover:text-[#0a0a0a]"
              }`}
            >
              {t === "login" ? "Ingresar" : "Registrarse"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {tab === "register" && (
            <div>
              <label className="block text-sm font-medium mb-1">Nombre</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Tu nombre completo"
                required
                className="w-full border border-[#e5e7eb] px-3 py-2 text-sm focus:outline-none focus:border-[#0a0a0a]"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
              className="w-full border border-[#e5e7eb] px-3 py-2 text-sm focus:outline-none focus:border-[#0a0a0a]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={8}
              className="w-full border border-[#e5e7eb] px-3 py-2 text-sm focus:outline-none focus:border-[#0a0a0a]"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#0a0a0a] text-white py-2.5 text-sm font-medium hover:bg-[#374151] transition-colors disabled:opacity-50"
          >
            {loading ? "Procesando..." : tab === "login" ? "Ingresar" : "Crear cuenta"}
          </button>
        </form>

        <p className="mt-4 text-xs text-[#9ca3af] text-center">
          Proyecto de auditoría ciudadana open source · Colombia 2026
        </p>
      </div>
    </div>
  );
}
