"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

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
  cepedaVotos: null,
  espriellaVotos: null,
  blancos: null,
  nulos: null,
  sumaTotal: null,
  e11: null,
  urna: null,
  hayEnmiendas: false,
  observaciones: "",
};

const GEMINI_PROMPT = `Eres un sistema de auditoría electoral colombiana. Analiza este formulario E-14 (Acta de Escrutinio) de la segunda vuelta presidencial 2026.

Extrae los datos con máxima precisión. La elección tiene solo 2 candidatos:
- IVÁN CEPEDA CASTRO
- ABELARDO DE LA ESPRIELLA

Responde ÚNICAMENTE en JSON sin texto adicional:
{
  "tipoCopia": "CLAVEROS" o "DELEGADOS",
  "candidatos": [
    {"nombre": "IVÁN CEPEDA CASTRO", "votos": número},
    {"nombre": "ABELARDO DE LA ESPRIELLA", "votos": número}
  ],
  "votosEnBlanco": número,
  "votosNulos": número,
  "votosNoMarcados": número,
  "sumaTotal": número,
  "nivelacion": {
    "totalVotantesE11": número,
    "totalVotosUrna": número,
    "totalVotosIncinerados": número
  },
  "hayEnmiendas": true/false,
  "enmiendaDetalle": "descripción si hay enmiendas",
  "severidadAnomalia": "NINGUNA" o "BAJA" o "MEDIA" o "ALTA",
  "observaciones": "notas para auditoría"
}
Si un número es ilegible, usa null.`;

export default function AuditarPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [user, setUser] = useState<{ name: string; actasAuditadas: number } | null>(null);
  const [geminiKey, setGeminiKey] = useState("");
  const [keyConfigured, setKeyConfigured] = useState(false);
  const [acta, setActa] = useState<ActaInfo | null>(null);
  const [draft, setDraft] = useState<OcrDraft>(EMPTY);
  const [analyzing, setAnalyzing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [noMore, setNoMore] = useState(false);

  const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setToken(session.access_token);
        setUser({
          name: session.user.user_metadata?.full_name ?? session.user.email?.split("@")[0] ?? "Auditor",
          actasAuditadas: 0,
        });
      } else {
        const t = localStorage.getItem("conteo_token");
        const u = localStorage.getItem("conteo_user");
        if (!t) { router.push("/login"); return; }
        setToken(t);
        if (u) setUser(JSON.parse(u));
      }
      const savedKey = sessionStorage.getItem("gemini_key");
      if (savedKey) { setGeminiKey(savedKey); setKeyConfigured(true); }
    });
  }, [router]);

  async function getToken(): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? token;
  }

  function saveKey() {
    if (!geminiKey.trim()) return;
    sessionStorage.setItem("gemini_key", geminiKey.trim());
    setKeyConfigured(true);
  }

  async function claimActa() {
    setClaiming(true);
    setError("");
    setMessage("");
    setActa(null);
    setDraft(EMPTY);
    try {
      const tk = await getToken();
      const res = await fetch(`${BASE}/e14/claim`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${tk}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Error");
      if (!data.claimed) { setNoMore(true); setMessage(data.message ?? "No hay más actas"); return; }
      setActa(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setClaiming(false);
    }
  }

  async function analyzeWithGemini() {
    if (!acta || !geminiKey) return;
    setAnalyzing(true);
    setError("");
    try {
      // Fetch the PDF as base64
      const pdfRes = await fetch(acta.pdfUrl);
      const pdfBlob = await pdfRes.blob();
      const base64 = await blobToBase64(pdfBlob);
      const base64Data = base64.split(",")[1];

      // Call Gemini API directly from browser
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: GEMINI_PROMPT },
                { inline_data: { mime_type: "application/pdf", data: base64Data } },
              ],
            }],
          }),
        }
      );
      const geminiData = await geminiRes.json();
      if (geminiData.error) throw new Error(geminiData.error.message);

      let text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      if (text.startsWith("```")) text = text.split("```")[1];
      if (text.startsWith("json")) text = text.slice(4);
      const parsed = JSON.parse(text.trim());

      const cepeda = parsed.candidatos?.find((c: {nombre: string}) => c.nombre.includes("CEPEDA"))?.votos ?? null;
      const espriella = parsed.candidatos?.find((c: {nombre: string}) => c.nombre.includes("ESPRIELLA"))?.votos ?? null;

      setDraft({
        tipoCopia: parsed.tipoCopia ?? "DELEGADOS",
        cepedaVotos: cepeda,
        espriellaVotos: espriella,
        blancos: parsed.votosEnBlanco ?? null,
        nulos: parsed.votosNulos ?? null,
        sumaTotal: parsed.sumaTotal ?? null,
        e11: parsed.nivelacion?.totalVotantesE11 ?? null,
        urna: parsed.nivelacion?.totalVotosUrna ?? null,
        hayEnmiendas: parsed.hayEnmiendas ?? false,
        observaciones: parsed.observaciones ?? "",
      });
    } catch (e) {
      setError(`Error al analizar: ${e instanceof Error ? e.message : e}`);
    } finally {
      setAnalyzing(false);
    }
  }

  async function submitAudit() {
    if (!acta) return;
    setSubmitting(true);
    setError("");
    try {
      const ocrResult = {
        tipoCopia: draft.tipoCopia,
        ocrEngine: "gemini-flash-citizen",
        candidatos: [
          { nombre: "IVÁN CEPEDA CASTRO", votos: draft.cepedaVotos },
          { nombre: "ABELARDO DE LA ESPRIELLA", votos: draft.espriellaVotos },
        ],
        votosEnBlanco: draft.blancos,
        votosNulos: draft.nulos,
        votosNoMarcados: null,
        sumaTotal: draft.sumaTotal,
        totalSufragantes: draft.urna,
        nivelacion: {
          totalVotantesE11: draft.e11,
          totalVotosUrna: draft.urna,
          totalVotosIncinerados: null,
        },
        hayEnmiendas: draft.hayEnmiendas,
        enmiendaDetalle: draft.hayEnmiendas ? "Detectado por auditor ciudadano" : "",
        severidadAnomalia: "NINGUNA",
        observaciones: draft.observaciones,
      };

      const tk = await getToken();
      const res = await fetch(`${BASE}/e14/submit`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${tk}` },
        body: JSON.stringify({ txId: acta.txId, ocrResult }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      setMessage(data.message);
      if (user) {
        const updated = { ...user, actasAuditadas: user.actasAuditadas + 1 };
        setUser(updated);
        localStorage.setItem("conteo_user", JSON.stringify(updated));
      }
      setActa(null);
      setDraft(EMPTY);
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

  function N(label: string, key: Exclude<keyof OcrDraft, "tipoCopia" | "hayEnmiendas" | "observaciones">) {
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

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Auditoría ciudadana</h1>
          <p className="text-sm text-[#6b7280]">
            {user && <span>Hola, <strong>{user.name}</strong> · {user.actasAuditadas} actas procesadas</span>}
          </p>
        </div>
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            localStorage.clear();
            router.push("/");
          }}
          className="text-xs text-[#9ca3af] hover:text-[#6b7280]"
        >
          Cerrar sesión
        </button>
      </div>

      {/* Step 1: Configure API Key */}
      {!keyConfigured && (
        <div className="border border-[#e5e7eb] p-6 mb-6">
          <h2 className="font-semibold mb-1">Paso 1: Configura tu API key de Google Gemini</h2>
          <p className="text-sm text-[#6b7280] mb-3">
            La key se usa directamente desde tu navegador para analizar las actas.
            <strong> Nunca se envía a nuestro servidor.</strong>{" "}
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener" className="underline">
              Obtener key gratis →
            </a>
          </p>
          <div className="flex gap-2">
            <input
              type="password"
              value={geminiKey}
              onChange={e => setGeminiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="flex-1 border border-[#e5e7eb] px-3 py-2 text-sm focus:outline-none focus:border-[#0a0a0a] font-mono"
            />
            <button
              onClick={saveKey}
              className="bg-[#0a0a0a] text-white px-4 py-2 text-sm font-medium hover:bg-[#374151]"
            >
              Guardar
            </button>
          </div>
        </div>
      )}

      {keyConfigured && (
        <div className="text-sm text-green-700 bg-green-50 border border-green-200 px-4 py-2 mb-4 flex items-center justify-between">
          <span>API key configurada (solo en esta sesión)</span>
          <button onClick={() => { sessionStorage.removeItem("gemini_key"); setKeyConfigured(false); setGeminiKey(""); }}
            className="text-xs underline">Cambiar
          </button>
        </div>
      )}

      {/* Step 2: Claim and audit */}
      {keyConfigured && !acta && !noMore && (
        <div className="border border-[#e5e7eb] p-6 mb-6">
          <h2 className="font-semibold mb-1">Paso 2: Obtener siguiente acta</h2>
          <p className="text-sm text-[#6b7280] mb-4">
            El sistema te asignará una acta E-14 pendiente de auditoría.
          </p>
          {message && <p className="text-sm text-green-700 mb-3 font-medium">{message}</p>}
          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
          <button
            onClick={claimActa}
            disabled={claiming}
            className="bg-[#0a0a0a] text-white px-6 py-2.5 text-sm font-medium hover:bg-[#374151] disabled:opacity-50"
          >
            {claiming ? "Buscando..." : "Obtener acta para auditar"}
          </button>
        </div>
      )}

      {noMore && (
        <div className="border border-green-200 bg-green-50 p-6 text-center">
          <p className="text-green-800 font-semibold">No hay más actas pendientes.</p>
          <p className="text-sm text-green-700 mt-1">Gracias por tu contribución a la democracia colombiana.</p>
        </div>
      )}

      {acta && (
        <div className="grid grid-cols-2 gap-6">
          {/* PDF Viewer */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-sm">
                Mesa {acta.mesa} · Zona {acta.zona} · {acta.municipio}
              </h2>
              <a href={acta.pdfUrl} target="_blank" rel="noopener" className="text-xs text-[#6b7280] underline">
                Abrir en nueva pestaña
              </a>
            </div>
            <iframe
              src={acta.pdfUrl}
              className="w-full border border-[#e5e7eb]"
              style={{ height: "600px" }}
              title="Acta E-14"
            />
            <button
              onClick={analyzeWithGemini}
              disabled={analyzing}
              className="mt-3 w-full bg-blue-600 text-white py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {analyzing ? "Analizando con Gemini..." : "Analizar con IA"}
            </button>
          </div>

          {/* OCR Form */}
          <div>
            <h2 className="font-semibold text-sm mb-3">Datos extraídos — revisa y corrige</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-[#6b7280] mb-1">Tipo de copia</label>
                <select
                  value={draft.tipoCopia}
                  onChange={e => setDraft(d => ({ ...d, tipoCopia: e.target.value }))}
                  className="w-full border border-[#e5e7eb] px-2 py-1.5 text-sm focus:outline-none"
                >
                  <option>DELEGADOS</option>
                  <option>CLAVEROS</option>
                  <option>DESCONOCIDO</option>
                </select>
              </div>

              <div className="border-t border-[#e5e7eb] pt-3">
                <p className="text-xs font-semibold text-[#6b7280] uppercase mb-2">Candidatos</p>
                {N("Iván Cepeda Castro", "cepedaVotos")}
                {N("Abelardo De la Espriella", "espriellaVotos")}
              </div>

              <div className="border-t border-[#e5e7eb] pt-3">
                <p className="text-xs font-semibold text-[#6b7280] uppercase mb-2">Totales</p>
                {N("Votos en blanco", "blancos")}
                {N("Votos nulos", "nulos")}
                {N("Suma total", "sumaTotal")}
              </div>

              <div className="border-t border-[#e5e7eb] pt-3">
                <p className="text-xs font-semibold text-[#6b7280] uppercase mb-2">Nivelación</p>
                {N("Votantes E-11", "e11")}
                {N("Votos en urna", "urna")}
              </div>

              <div className="border-t border-[#e5e7eb] pt-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.hayEnmiendas}
                    onChange={e => setDraft(d => ({ ...d, hayEnmiendas: e.target.checked }))}
                  />
                  Hay tachones o enmiendas
                </label>
                <textarea
                  value={draft.observaciones}
                  onChange={e => setDraft(d => ({ ...d, observaciones: e.target.value }))}
                  placeholder="Observaciones para el equipo auditor..."
                  className="mt-2 w-full border border-[#e5e7eb] px-2 py-1.5 text-sm focus:outline-none"
                  rows={2}
                />
              </div>

              {/* Arithmetic check */}
              {draft.cepedaVotos != null && draft.espriellaVotos != null && (
                <div className={`text-xs px-3 py-2 border ${
                  (draft.cepedaVotos + draft.espriellaVotos + (draft.blancos ?? 0) + (draft.nulos ?? 0)) === (draft.sumaTotal ?? -1)
                    ? "border-green-200 bg-green-50 text-green-700"
                    : "border-yellow-200 bg-yellow-50 text-yellow-700"
                }`}>
                  Suma calculada: {draft.cepedaVotos + draft.espriellaVotos + (draft.blancos ?? 0) + (draft.nulos ?? 0)}
                  {draft.sumaTotal != null && <> · Declarada: {draft.sumaTotal}</>}
                </div>
              )}

              {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2">{error}</p>}
              {message && <p className="text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-2">{message}</p>}

              <button
                onClick={submitAudit}
                disabled={submitting || draft.cepedaVotos == null}
                className="w-full bg-[#0a0a0a] text-white py-2.5 text-sm font-medium hover:bg-[#374151] disabled:opacity-50"
              >
                {submitting ? "Guardando..." : "Confirmar y guardar auditoría"}
              </button>
              <button
                onClick={() => { setActa(null); setDraft(EMPTY); setMessage(""); }}
                className="w-full border border-[#e5e7eb] py-2 text-sm text-[#6b7280] hover:bg-[#f9fafb]"
              >
                Saltar esta acta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
