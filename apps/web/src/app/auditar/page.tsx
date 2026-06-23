"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

interface ActaInfo {
  txId: string;
  pdfUrl: string;
  departamento: string;
  municipio: string;
  zona: string;
  mesa: string;
}

interface OcrDraft {
  tipoCopia: string;
  cepedaVotos: number | null;
  espriellaVotos: number | null;
  blancos: number | null;
  nulos: number | null;
  sumaTotal: number | null;
  e11: number | null;
  urna: number | null;
  hayEnmiendas: boolean;
  observaciones: string;
}

const EMPTY: OcrDraft = {
  tipoCopia: "DELEGADOS",
  cepedaVotos: null, espriellaVotos: null,
  blancos: null, nulos: null, sumaTotal: null,
  e11: null, urna: null,
  hayEnmiendas: false, observaciones: "",
};

export default function AuditarPage() {
  const router = useRouter();
  const { user, session, loading } = useAuth();
  const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3008/api";

  // Key states
  const [hasGeminiKey, setHasGeminiKey] = useState(false);
  const [hasAnthropicKey, setHasAnthropicKey] = useState(false);
  const [geminiKeyInput, setGeminiKeyInput] = useState("");
  const [anthropicKeyInput, setAnthropicKeyInput] = useState("");
  const [savingGemini, setSavingGemini] = useState(false);
  const [savingAnthropic, setSavingAnthropic] = useState(false);
  const [deletingGemini, setDeletingGemini] = useState(false);
  const [deletingAnthropic, setDeletingAnthropic] = useState(false);
  const [keyChecked, setKeyChecked] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<"gemini" | "anthropic">("gemini");

  // Acta state
  const [acta, setActa] = useState<ActaInfo | null>(null);
  const [draft, setDraft] = useState<OcrDraft>(EMPTY);
  const [noMore, setNoMore] = useState(false);

  // UI state
  const [claiming, setClaiming] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  const checkKeys = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const res = await fetch(`${BASE}/auth/me`, {
        headers: { authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json() as { hasGeminiKey?: boolean; hasAnthropicKey?: boolean };
        setHasGeminiKey(!!data.hasGeminiKey);
        setHasAnthropicKey(!!data.hasAnthropicKey);
        // Auto-select the available provider
        if (data.hasAnthropicKey && !data.hasGeminiKey) setSelectedProvider("anthropic");
        else setSelectedProvider("gemini");
      }
    } catch { /* ignore */ }
    finally { setKeyChecked(true); }
  }, [BASE, session?.access_token]);

  useEffect(() => {
    if (session?.access_token) void checkKeys();
  }, [session?.access_token, checkKeys]);

  const getToken = () => session?.access_token ?? "";

  async function saveKey(provider: "gemini" | "anthropic", key: string) {
    const endpoint = provider === "gemini" ? "gemini-key" : "anthropic-key";
    if (provider === "gemini") setSavingGemini(true); else setSavingAnthropic(true);
    setError("");
    try {
      const res = await fetch(`${BASE}/auth/${endpoint}`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ key: key.trim() }),
      });
      if (!res.ok) {
        const d = await res.json() as { message?: string };
        throw new Error(d.message ?? "Error al guardar la key");
      }
      if (provider === "gemini") { setHasGeminiKey(true); setGeminiKeyInput(""); setSelectedProvider("gemini"); }
      else { setHasAnthropicKey(true); setAnthropicKeyInput(""); setSelectedProvider("anthropic"); }
      setMessage(`API key de ${provider === "gemini" ? "Gemini" : "Anthropic"} guardada`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      if (provider === "gemini") setSavingGemini(false); else setSavingAnthropic(false);
    }
  }

  async function deleteKey(provider: "gemini" | "anthropic") {
    const endpoint = provider === "gemini" ? "gemini-key" : "anthropic-key";
    if (provider === "gemini") setDeletingGemini(true); else setDeletingAnthropic(true);
    setError("");
    try {
      const res = await fetch(`${BASE}/auth/${endpoint}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) {
        const d = await res.json() as { message?: string };
        throw new Error(d.message ?? "Error al eliminar la key");
      }
      if (provider === "gemini") { setHasGeminiKey(false); if (selectedProvider === "gemini") setSelectedProvider("anthropic"); }
      else { setHasAnthropicKey(false); if (selectedProvider === "anthropic") setSelectedProvider("gemini"); }
      setMessage(`API key de ${provider === "gemini" ? "Gemini" : "Anthropic"} eliminada`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      if (provider === "gemini") setDeletingGemini(false); else setDeletingAnthropic(false);
    }
  }

  async function claimActa() {
    setClaiming(true); setError(""); setMessage(""); setActa(null); setDraft(EMPTY);
    try {
      const res = await fetch(`${BASE}/e14/claim`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json() as { claimed?: boolean; message?: string } & ActaInfo;
      if (!res.ok) throw new Error(data.message ?? "Error al reclamar acta");
      if (!data.claimed) { setNoMore(true); setMessage(data.message ?? "No hay más actas"); return; }
      setActa(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setClaiming(false);
    }
  }

  async function analyzeWithAI() {
    if (!acta) return;
    setAnalyzing(true); setError("");
    try {
      const pdfRes = await fetch(acta.pdfUrl);
      const base64 = await blobToBase64(await pdfRes.blob());
      const pdfBase64 = base64.split(",")[1];

      const res = await fetch(`${BASE}/e14/analyze`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ pdfBase64, provider: selectedProvider }),
      });

      if (!res.ok) {
        const errData = await res.json() as { message?: string };
        throw new Error(errData.message ?? "Error al analizar el acta");
      }

      const parsed = await res.json() as {
        tipoCopia?: string;
        candidatos?: Array<{ nombre: string; votos: number | null }>;
        votosEnBlanco?: number | null;
        votosNulos?: number | null;
        sumaTotal?: number | null;
        nivelacion?: { totalVotantesE11?: number | null; totalVotosUrna?: number | null };
        hayEnmiendas?: boolean;
        observaciones?: string;
      };

      const cepeda = parsed.candidatos?.find((c) => c.nombre.includes("CEPEDA"))?.votos ?? null;
      const espriella = parsed.candidatos?.find((c) => c.nombre.includes("ESPRIELLA"))?.votos ?? null;

      setDraft({
        tipoCopia: parsed.tipoCopia ?? "DELEGADOS",
        cepedaVotos: cepeda, espriellaVotos: espriella,
        blancos: parsed.votosEnBlanco ?? null, nulos: parsed.votosNulos ?? null,
        sumaTotal: parsed.sumaTotal ?? null,
        e11: parsed.nivelacion?.totalVotantesE11 ?? null,
        urna: parsed.nivelacion?.totalVotosUrna ?? null,
        hayEnmiendas: parsed.hayEnmiendas ?? false,
        observaciones: parsed.observaciones ?? "",
      });
    } catch (e) {
      setError(`Error al analizar: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setAnalyzing(false);
    }
  }

  async function submitAudit() {
    if (!acta) return;
    setSubmitting(true); setError("");
    try {
      const ocrResult = {
        tipoCopia: draft.tipoCopia,
        ocrEngine: `${selectedProvider}-citizen`,
        candidatos: [
          { nombre: "IVÁN CEPEDA CASTRO", votos: draft.cepedaVotos },
          { nombre: "ABELARDO DE LA ESPRIELLA", votos: draft.espriellaVotos },
        ],
        votosEnBlanco: draft.blancos, votosNulos: draft.nulos, votosNoMarcados: null,
        sumaTotal: draft.sumaTotal, totalSufragantes: draft.urna,
        nivelacion: { totalVotantesE11: draft.e11, totalVotosUrna: draft.urna, totalVotosIncinerados: null },
        hayEnmiendas: draft.hayEnmiendas,
        enmiendaDetalle: draft.hayEnmiendas ? "Detectado por auditor ciudadano" : "",
        severidadAnomalia: "NINGUNA", observaciones: draft.observaciones,
      };
      const res = await fetch(`${BASE}/e14/submit`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ txId: acta.txId, ocrResult }),
      });
      const data = await res.json() as { message?: string };
      if (!res.ok) throw new Error(data.message);
      setMessage(data.message ?? "Auditoría guardada");
      setActa(null); setDraft(EMPTY);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSubmitting(false);
    }
  }

  function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = () => res(reader.result as string);
      reader.onerror = rej;
      reader.readAsDataURL(blob);
    });
  }

  function NumInput(label: string, key: Exclude<keyof OcrDraft, "tipoCopia" | "hayEnmiendas" | "observaciones">) {
    return (
      <div>
        <label className="block text-xs text-[#6b7280] mb-1">{label}</label>
        <input
          type="number"
          value={(draft[key] as number | null) ?? ""}
          onChange={e => setDraft(d => ({ ...d, [key]: e.target.value === "" ? null : Number(e.target.value) }))}
          className="w-full border border-[#e5e7eb] px-2 py-1.5 text-sm focus:outline-none focus:border-[#0a0a0a]"
        />
      </div>
    );
  }

  if (loading || !keyChecked) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="w-5 h-5 border-2 border-[#0a0a0a] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  const name = user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "Auditor";
  const hasAnyKey = hasGeminiKey || hasAnthropicKey;
  const hasBothKeys = hasGeminiKey && hasAnthropicKey;

  const providerLabel = selectedProvider === "gemini" ? "Google Gemini" : "Anthropic Claude";

  return (
    <div className="max-w-5xl mx-auto">

      <div className="mb-6">
        <h1 className="text-xl font-bold">Auditoría ciudadana</h1>
        <p className="text-sm text-[#6b7280] mt-0.5">
          Hola, <strong>{name}</strong> · Cada acta que auditas suma a la democracia colombiana
        </p>
      </div>

      {/* PASO 1: Configurar claves de IA */}
      {!hasAnyKey && (
        <div className="border border-[#e5e7eb] p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-[#0a0a0a] text-white flex items-center justify-center text-sm font-bold shrink-0">1</div>
            <div className="flex-1">
              <h2 className="font-semibold mb-1">Configura tu API key de IA</h2>
              <p className="text-sm text-[#6b7280] mb-5">
                Tu key se guarda encriptada en nuestros servidores (AES-256-GCM). Solo se usa para analizar actas. Puedes eliminarla cuando quieras.
              </p>

              {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

              {/* Model + cost spec */}
              <div className="grid grid-cols-2 gap-3 mb-5 text-xs">
                <div className="border border-[#e5e7eb] bg-[#f9fafb] p-3 space-y-1">
                  <div className="font-mono font-semibold text-[10px] text-[#6b7280] uppercase tracking-wide">gemini-1.5-flash</div>
                  <div className="font-bold text-sm">Google Gemini Flash</div>
                  <div className="text-[#059669] font-semibold">~$0 / acta (plan gratis)</div>
                  <div className="text-[#9ca3af]">15 req/min · 1M tokens/min · gratis para volúmenes pequeños</div>
                  <div className="text-[#6b7280]">En escala: $0.075/M tokens entrada · ~$0.0004/acta</div>
                </div>
                <div className="border border-[#e5e7eb] bg-[#f9fafb] p-3 space-y-1">
                  <div className="font-mono font-semibold text-[10px] text-[#6b7280] uppercase tracking-wide">claude-haiku-4-5-20251001</div>
                  <div className="font-bold text-sm">Anthropic Claude Haiku</div>
                  <div className="text-orange-600 font-semibold">~$0.001 USD / acta</div>
                  <div className="text-[#9ca3af]">$0.80/M tokens entrada · $4/M tokens salida</div>
                  <div className="text-[#6b7280]">Alta precisión en documentos. 100 actas ≈ $0.10 USD</div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Gemini */}
                <div className="border border-[#e5e7eb] p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold">Google Gemini Flash</span>
                    <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5">Gratis</span>
                  </div>
                  <p className="text-xs text-[#6b7280] mb-3">
                    15 req/min gratis.{" "}
                    <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener" className="underline text-blue-600">
                      Obtener key →
                    </a>
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={geminiKeyInput}
                      onChange={e => setGeminiKeyInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && void saveKey("gemini", geminiKeyInput)}
                      placeholder="AIzaSy..."
                      className="flex-1 min-w-0 border border-[#e5e7eb] px-2 py-1.5 text-sm focus:outline-none focus:border-[#0a0a0a] font-mono"
                    />
                    <button
                      onClick={() => void saveKey("gemini", geminiKeyInput)}
                      disabled={!geminiKeyInput.trim() || savingGemini}
                      className="bg-[#0a0a0a] text-white px-3 py-1.5 text-sm font-medium hover:bg-[#374151] disabled:opacity-40 shrink-0"
                    >
                      {savingGemini ? "..." : "Guardar"}
                    </button>
                  </div>
                </div>

                {/* Anthropic */}
                <div className="border border-[#e5e7eb] p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold">Anthropic Claude Haiku</span>
                    <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5">~$0.001/acta</span>
                  </div>
                  <p className="text-xs text-[#6b7280] mb-3">
                    claude-haiku-4-5 — máxima precisión.{" "}
                    <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener" className="underline text-blue-600">
                      Obtener key →
                    </a>
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={anthropicKeyInput}
                      onChange={e => setAnthropicKeyInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && void saveKey("anthropic", anthropicKeyInput)}
                      placeholder="sk-ant-api03-..."
                      className="flex-1 min-w-0 border border-[#e5e7eb] px-2 py-1.5 text-sm focus:outline-none focus:border-[#0a0a0a] font-mono"
                    />
                    <button
                      onClick={() => void saveKey("anthropic", anthropicKeyInput)}
                      disabled={!anthropicKeyInput.trim() || savingAnthropic}
                      className="bg-[#0a0a0a] text-white px-3 py-1.5 text-sm font-medium hover:bg-[#374151] disabled:opacity-40 shrink-0"
                    >
                      {savingAnthropic ? "..." : "Guardar"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Keys configuradas */}
      {hasAnyKey && !acta && (
        <div className="border border-[#e5e7eb] p-4 mb-4">
          <div className="flex flex-wrap gap-4 items-start justify-between">
            <div className="flex flex-wrap gap-3">
              {/* Gemini status */}
              {hasGeminiKey ? (
                <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-1.5">
                  <span>Gemini Flash ✓</span>
                  <button
                    onClick={() => void deleteKey("gemini")}
                    disabled={deletingGemini}
                    className="underline text-green-600 disabled:opacity-50"
                  >
                    {deletingGemini ? "..." : "Eliminar"}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="text-xs text-[#6b7280] border border-[#e5e7eb] px-3 py-1.5">Gemini Flash — sin key</div>
                  <div className="flex gap-1">
                    <input
                      type="password"
                      value={geminiKeyInput}
                      onChange={e => setGeminiKeyInput(e.target.value)}
                      placeholder="AIzaSy..."
                      className="border border-[#e5e7eb] px-2 py-1 text-xs font-mono w-36 focus:outline-none focus:border-[#0a0a0a]"
                    />
                    <button
                      onClick={() => void saveKey("gemini", geminiKeyInput)}
                      disabled={!geminiKeyInput.trim() || savingGemini}
                      className="text-xs bg-[#0a0a0a] text-white px-2 py-1 disabled:opacity-40"
                    >
                      {savingGemini ? "..." : "Agregar"}
                    </button>
                  </div>
                </div>
              )}

              {/* Anthropic status */}
              {hasAnthropicKey ? (
                <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-1.5">
                  <span>Anthropic Claude ✓</span>
                  <button
                    onClick={() => void deleteKey("anthropic")}
                    disabled={deletingAnthropic}
                    className="underline text-green-600 disabled:opacity-50"
                  >
                    {deletingAnthropic ? "..." : "Eliminar"}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="text-xs text-[#6b7280] border border-[#e5e7eb] px-3 py-1.5">Anthropic — sin key</div>
                  <div className="flex gap-1">
                    <input
                      type="password"
                      value={anthropicKeyInput}
                      onChange={e => setAnthropicKeyInput(e.target.value)}
                      placeholder="sk-ant-..."
                      className="border border-[#e5e7eb] px-2 py-1 text-xs font-mono w-36 focus:outline-none focus:border-[#0a0a0a]"
                    />
                    <button
                      onClick={() => void saveKey("anthropic", anthropicKeyInput)}
                      disabled={!anthropicKeyInput.trim() || savingAnthropic}
                      className="text-xs bg-[#0a0a0a] text-white px-2 py-1 disabled:opacity-40"
                    >
                      {savingAnthropic ? "..." : "Agregar"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Provider selector — only when both keys are present */}
            {hasBothKeys && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-[#6b7280]">Usar:</span>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="provider"
                    value="gemini"
                    checked={selectedProvider === "gemini"}
                    onChange={() => setSelectedProvider("gemini")}
                  />
                  Gemini
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="provider"
                    value="anthropic"
                    checked={selectedProvider === "anthropic"}
                    onChange={() => setSelectedProvider("anthropic")}
                  />
                  Claude
                </label>
              </div>
            )}
          </div>
          {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
        </div>
      )}

      {/* Mensajes globales */}
      {message && !acta && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 px-4 py-2 mb-4">{message}</p>
      )}

      {/* PASO 2: Obtener acta */}
      {hasAnyKey && !acta && !noMore && (
        <div className="border border-[#e5e7eb] p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-[#0a0a0a] text-white flex items-center justify-center text-sm font-bold shrink-0">2</div>
            <div className="flex-1">
              <h2 className="font-semibold mb-1">Obtener acta para auditar</h2>
              <p className="text-sm text-[#6b7280] mb-4">
                El sistema te asigna una acta E-14 pendiente. Tienes 10 minutos para procesarla.
              </p>
              {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
              <button
                onClick={() => void claimActa()}
                disabled={claiming}
                className="bg-[#0a0a0a] text-white px-6 py-2.5 text-sm font-medium hover:bg-[#374151] disabled:opacity-50"
              >
                {claiming ? "Buscando acta..." : "Obtener siguiente acta"}
              </button>
            </div>
          </div>
        </div>
      )}

      {noMore && (
        <div className="border border-green-200 bg-green-50 p-6 text-center">
          <p className="text-green-800 font-semibold">No hay más actas pendientes.</p>
          <p className="text-sm text-green-700 mt-1">¡Gracias por tu contribución a la democracia colombiana!</p>
        </div>
      )}

      {/* PASO 3: Analizar acta */}
      {acta && (
        <div>
          <div className="border border-[#e5e7eb] px-4 py-3 mb-4 flex items-center justify-between text-sm">
            <span>
              <strong>Mesa {acta.mesa}</strong> · Zona {acta.zona} · {acta.municipio}, {acta.departamento}
            </span>
            <div className="flex items-center gap-3">
              {hasBothKeys && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-[#6b7280]">IA:</span>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input type="radio" name="provider-acta" value="gemini" checked={selectedProvider === "gemini"} onChange={() => setSelectedProvider("gemini")} />
                    Gemini
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input type="radio" name="provider-acta" value="anthropic" checked={selectedProvider === "anthropic"} onChange={() => setSelectedProvider("anthropic")} />
                    Claude
                  </label>
                </div>
              )}
              <a href={acta.pdfUrl} target="_blank" rel="noopener" className="text-xs text-[#6b7280] underline">
                Abrir PDF
              </a>
              <button
                onClick={() => { setActa(null); setDraft(EMPTY); setMessage(""); setError(""); }}
                className="text-xs text-[#6b7280] underline"
              >
                Saltar
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* PDF + Analizar */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-[#0a0a0a] text-white flex items-center justify-center text-xs font-bold">3</div>
                <span className="font-semibold text-sm">Acta E-14</span>
              </div>
              <iframe src={acta.pdfUrl} className="w-full border border-[#e5e7eb]" style={{ height: 580 }} title="Acta E-14" />
              <button
                onClick={() => void analyzeWithAI()}
                disabled={analyzing}
                className="mt-3 w-full bg-blue-600 text-white py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {analyzing ? `Analizando con ${providerLabel}...` : `Analizar con ${providerLabel}`}
              </button>
            </div>

            {/* Formulario */}
            <div>
              <p className="font-semibold text-sm mb-3">Datos extraídos — revisa y corrige si es necesario</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-[#6b7280] mb-1">Tipo de copia</label>
                  <select
                    value={draft.tipoCopia}
                    onChange={e => setDraft(d => ({ ...d, tipoCopia: e.target.value }))}
                    className="w-full border border-[#e5e7eb] px-2 py-1.5 text-sm"
                  >
                    <option>DELEGADOS</option>
                    <option>CLAVEROS</option>
                    <option>DESCONOCIDO</option>
                  </select>
                </div>

                <div className="border-t border-[#e5e7eb] pt-3">
                  <p className="text-xs font-semibold text-[#6b7280] uppercase mb-2">Candidatos</p>
                  {NumInput("Iván Cepeda Castro", "cepedaVotos")}
                  {NumInput("Abelardo De la Espriella", "espriellaVotos")}
                </div>

                <div className="border-t border-[#e5e7eb] pt-3">
                  <p className="text-xs font-semibold text-[#6b7280] uppercase mb-2">Totales</p>
                  {NumInput("Votos en blanco", "blancos")}
                  {NumInput("Votos nulos", "nulos")}
                  {NumInput("Suma total declarada", "sumaTotal")}
                </div>

                <div className="border-t border-[#e5e7eb] pt-3">
                  <p className="text-xs font-semibold text-[#6b7280] uppercase mb-2">Nivelación E-11</p>
                  {NumInput("Votantes habilitados (E-11)", "e11")}
                  {NumInput("Votos en urna", "urna")}
                </div>

                <div className="border-t border-[#e5e7eb] pt-3">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draft.hayEnmiendas}
                      onChange={e => setDraft(d => ({ ...d, hayEnmiendas: e.target.checked }))}
                    />
                    Hay tachones o enmiendas visibles
                  </label>
                  <textarea
                    value={draft.observaciones}
                    onChange={e => setDraft(d => ({ ...d, observaciones: e.target.value }))}
                    placeholder="Observaciones para el equipo auditor..."
                    className="mt-2 w-full border border-[#e5e7eb] px-2 py-1.5 text-sm focus:outline-none resize-none"
                    rows={2}
                  />
                </div>

                {draft.cepedaVotos != null && draft.espriellaVotos != null && (
                  (() => {
                    const suma = draft.cepedaVotos + draft.espriellaVotos + (draft.blancos ?? 0) + (draft.nulos ?? 0);
                    const ok = draft.sumaTotal != null && suma === draft.sumaTotal;
                    return (
                      <div className={`text-xs px-3 py-2 border ${ok ? "border-green-200 bg-green-50 text-green-700" : "border-yellow-200 bg-yellow-50 text-yellow-700"}`}>
                        Suma calculada: <strong>{suma}</strong>
                        {draft.sumaTotal != null && <> · Declarada: <strong>{draft.sumaTotal}</strong> {ok ? "✓" : "⚠ Inconsistencia"}</>}
                      </div>
                    );
                  })()
                )}

                {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2">{error}</p>}
                {message && <p className="text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-2">{message}</p>}

                <button
                  onClick={() => void submitAudit()}
                  disabled={submitting || draft.cepedaVotos == null}
                  className="w-full bg-[#0a0a0a] text-white py-2.5 text-sm font-medium hover:bg-[#374151] disabled:opacity-40"
                >
                  {submitting ? "Guardando..." : "Confirmar y guardar auditoría"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
