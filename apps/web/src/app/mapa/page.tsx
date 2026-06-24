"use client";
import dynamic from "next/dynamic";
import { useState, useEffect, useCallback } from "react";
import type { DeptStat, MunStat, MesaBrief, PreconteoDeptStat, PreconteoSummary } from "@/lib/api";
import { DANE_TO_NAME } from "@/components/ColombiaMap";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3008/api";

const ColombiaMap = dynamic(() => import("@/components/ColombiaMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center text-sm text-[#9ca3af]">
      Cargando mapa...
    </div>
  ),
});

function n(v: number) { return v.toLocaleString("es-CO"); }

const SEV_COLOR: Record<string, string> = {
  ALTA: "text-red-700 bg-red-50 border-red-200",
  MEDIA: "text-yellow-700 bg-yellow-50 border-yellow-200",
  BAJA: "text-blue-700 bg-blue-50 border-blue-200",
  NINGUNA: "text-gray-500 bg-gray-50 border-gray-200",
};

function StatusBadge({ status, auditedAt }: { status: string; auditedAt: string | null }) {
  if (auditedAt) return <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 border border-green-200">Auditada</span>;
  if (status === "error") return <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 border border-red-200">Error</span>;
  return <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 border border-gray-200">Pendiente</span>;
}

function MesaModal({ acta, onClose }: { acta: MesaBrief; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="fixed inset-0 bg-black/50" />
      <div
        className="relative z-10 ml-auto w-full max-w-5xl bg-white h-full overflow-auto flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e5e7eb] shrink-0">
          <div>
            <div className="text-xs text-[#6b7280] font-mono">{acta.txId}</div>
            <h2 className="font-bold">Mesa {acta.mesa} · Zona {acta.zona} · Puesto {acta.stand}</h2>
            <div className="text-sm text-[#6b7280]">
              {acta.municipio ?? `Mun ${acta.munCode}`} · {acta.departamento ?? DANE_TO_NAME[acta.deptCode] ?? acta.deptCode}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a href={acta.pdfUrl} target="_blank" rel="noopener"
              className="text-xs border border-[#e5e7eb] px-3 py-1.5 hover:bg-[#f9fafb]">
              Abrir PDF ↗
            </a>
            <button onClick={onClose} className="text-xs border border-[#e5e7eb] px-3 py-1.5 hover:bg-[#f9fafb]">
              Cerrar ×
            </button>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 overflow-hidden">
          <div className="border-r border-[#e5e7eb] h-[60vh] lg:h-full">
            <iframe src={acta.pdfUrl} className="w-full h-full" title="Acta E-14" />
          </div>
          <div className="overflow-auto p-6 space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={acta.status} auditedAt={acta.auditedAt} />
              {acta.tipoCopia && (
                <span className="text-xs border border-[#e5e7eb] px-2 py-0.5 font-mono">{acta.tipoCopia}</span>
              )}
              {acta.fraudSeverity && acta.fraudSeverity !== "NINGUNA" && (
                <span className={`text-xs px-2 py-0.5 border ${SEV_COLOR[acta.fraudSeverity]}`}>
                  ⚠ {acta.fraudSeverity}
                </span>
              )}
            </div>
            {(acta.candidato0 || acta.candidato1) && (
              <div className="border border-[#e5e7eb] divide-y divide-[#e5e7eb]">
                {[acta.candidato0, acta.candidato1].map((c, i) => c && (
                  <div key={i} className="px-4 py-3 flex items-center justify-between">
                    <span className="text-sm text-[#4b5563] truncate max-w-[200px]">
                      {c.nombre.split(" ").slice(0, 3).join(" ")}
                    </span>
                    <span className={`font-black tabnum text-xl ${i === 0 ? "text-violet-700" : "text-orange-600"}`}>
                      {c.votos ?? "—"}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {(acta.sumaTotal != null || acta.totalSufragantes != null) && (
              <div className="grid grid-cols-2 gap-3">
                {acta.sumaTotal != null && (
                  <div className="border border-[#e5e7eb] p-3 text-center">
                    <div className="font-bold tabnum text-lg">{n(acta.sumaTotal)}</div>
                    <div className="text-xs text-[#9ca3af]">Suma total</div>
                  </div>
                )}
                {acta.totalSufragantes != null && (
                  <div className="border border-[#e5e7eb] p-3 text-center">
                    <div className="font-bold tabnum text-lg">{n(acta.totalSufragantes)}</div>
                    <div className="text-xs text-[#9ca3af]">Sufragantes</div>
                  </div>
                )}
              </div>
            )}
            {acta.hayEnmiendas && (
              <div className="bg-yellow-50 border border-yellow-200 px-3 py-2 text-xs text-yellow-700">
                Enmiendas o tachones detectados
              </div>
            )}
            {(acta.fraudFlags?.length ?? 0) > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-semibold text-[#6b7280] uppercase tracking-wide">Irregularidades</div>
                {acta.fraudFlags!.map((f, i) => (
                  <div key={i} className="text-xs bg-red-50 border border-red-200 text-red-700 px-3 py-2">{f}</div>
                ))}
              </div>
            )}
            {acta.auditedByName && (
              <div className="text-xs text-[#9ca3af] border-t border-[#e5e7eb] pt-3">
                Auditada por <strong>{acta.auditedByName}</strong>
                {acta.auditedAt && <> · {new Date(acta.auditedAt).toLocaleDateString("es-CO")}</>}
              </div>
            )}
            <a href="/auditar"
              className="block w-full text-center bg-[#0a0a0a] text-white py-2.5 text-sm font-medium hover:bg-[#374151] mt-2">
              Auditar esta acta →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

type Tab = "resultados" | "territorio" | "cobertura";

export default function MapaPage() {
  const [tab, setTab] = useState<Tab>("territorio");

  // Preconteo data
  const [summary, setSummary] = useState<PreconteoSummary | null>(null);
  const [deptStats, setDeptStats] = useState<PreconteoDeptStat[]>([]);

  // E-14 coverage data
  const [geoStats, setGeoStats] = useState<DeptStat[]>([]);

  // Drill-down state
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [selectedDeptName, setSelectedDeptName] = useState<string | null>(null);
  const [municipalities, setMunicipalities] = useState<MunStat[]>([]);
  const [selectedMun, setSelectedMun] = useState<string | null>(null);
  const [mesas, setMesas] = useState<MesaBrief[]>([]);
  const [totalMesas, setTotalMesas] = useState(0);
  const [selectedActa, setSelectedActa] = useState<MesaBrief | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`${BASE}/preconteo/summary`).then(r => r.json()).catch(() => null),
      fetch(`${BASE}/preconteo/by-dept`).then(r => r.json()).catch(() => []),
      fetch(`${BASE}/e14/geo-stats`).then(r => r.json()).catch(() => []),
    ]).then(([sum, depts, geo]) => {
      if (sum) setSummary(sum as PreconteoSummary);
      setDeptStats(Array.isArray(depts) ? (depts as PreconteoDeptStat[]) : []);
      setGeoStats(Array.isArray(geo) ? (geo as DeptStat[]) : []);
    });
  }, []);

  const fetchMunicipalities = useCallback(async (dept: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/e14/municipalities?dept=${dept}`);
      setMunicipalities(await res.json() as MunStat[]);
    } finally { setLoading(false); }
  }, []);

  const fetchMesas = useCallback(async (dept: string, mun?: string) => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ limit: "200", dept });
      if (mun) q.set("mun", mun);
      const res = await fetch(`${BASE}/e14/browse?${q}`);
      const data = await res.json() as { total: number; actas: MesaBrief[] };
      setMesas(data.actas);
      setTotalMesas(data.total);
    } finally { setLoading(false); }
  }, []);

  function handleDeptSelect(code: string, name: string) {
    setSelectedDept(code);
    setSelectedDeptName(name);
    setSelectedMun(null);
    setMesas([]);
    void fetchMunicipalities(code);
  }

  function handleMunSelect(code: string) {
    setSelectedMun(code);
    void fetchMesas(selectedDept!, code);
  }

  function handleBack() {
    if (selectedMun) { setSelectedMun(null); setMesas([]); }
    else { setSelectedDept(null); setSelectedDeptName(null); setMunicipalities([]); }
  }

  function resetDrill() {
    setSelectedDept(null); setSelectedDeptName(null);
    setMunicipalities([]); setSelectedMun(null); setMesas([]);
  }

  // Totals from preconteo summary
  const cepedaTotal = summary?.candidatos?.find(c => c.nombre.toUpperCase().includes("CEPEDA"))?.vot ?? 0;
  const espriellaTotal = summary?.candidatos?.find(c =>
    c.nombre.toUpperCase().includes("ESPRIELLA") || c.nombre.toUpperCase().includes("ESPRI")
  )?.vot ?? 0;
  const totalSufragantes = cepedaTotal + espriellaTotal;
  const pctCepeda = totalSufragantes > 0 ? (cepedaTotal / totalSufragantes) * 100 : 0;
  const pctEspriella = totalSufragantes > 0 ? (espriellaTotal / totalSufragantes) * 100 : 0;

  const mesasTotal = summary?.mesas?.total ?? 0;
  const mesasEsc = summary?.mesas?.escrutadas ?? 0;
  const pctMesas = mesasTotal > 0 ? (mesasEsc / mesasTotal) * 100 : 0;

  // E14 coverage totals
  const e14Total = geoStats.reduce((s, d) => s + d.total, 0);
  const e14Auditadas = geoStats.reduce((s, d) => s + d.auditadas, 0);
  const e14Fraude = geoStats.reduce((s, d) => s + d.conIrregularidades, 0);

  const TABS: { id: Tab; label: string }[] = [
    { id: "resultados", label: "Resultados" },
    { id: "territorio", label: "Por territorio" },
    { id: "cobertura", label: "Cobertura E-14" },
  ];

  // Preconteo dept for selected dept
  const selectedPreconteoDept = deptStats.find(d => d.deptCodigo === selectedDept);
  const selectedGeoStat = geoStats.find(d => d.code === selectedDept);

  return (
    // -my-10 -mx-6 escapes AppShell's px-6 py-10 so the map fills the full viewport
    <div className="-my-10 -mx-6 flex flex-col" style={{ height: "calc(100vh - 3.5rem)" }}>

      {/* ── Compact header ── */}
      <div className="shrink-0 border-b border-[#e5e7eb] px-6 py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div>
            <div className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-widest leading-none mb-0.5">
              Colombia 2026 · Segunda vuelta
            </div>
            <h1 className="text-base font-black text-[#0a0a0a] leading-tight">Presidente y Vicepresidente</h1>
          </div>
          {mesasTotal > 0 && (
            <div className="hidden sm:flex items-center gap-2 text-xs text-[#6b7280] border-l border-[#e5e7eb] pl-4">
              <span>Mesas <strong className="text-[#0a0a0a]">{n(mesasEsc)}/{n(mesasTotal)}</strong></span>
              <div className="w-16 h-1.5 bg-[#f3f4f6]">
                <div className="h-full bg-[#0a0a0a]" style={{ width: `${pctMesas}%` }} />
              </div>
              <strong className="text-[#0a0a0a] tabnum">{pctMesas.toFixed(1)}%</strong>
            </div>
          )}
        </div>
        {/* Tabs inline with header */}
        <div className="flex items-center border border-[#e5e7eb]">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); resetDrill(); }}
              className={`px-4 py-1.5 text-xs font-medium transition-colors border-r last:border-r-0 border-[#e5e7eb] ${
                tab === t.id
                  ? "bg-[#0a0a0a] text-white"
                  : "text-[#6b7280] hover:bg-[#f9fafb]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content — fills remaining height ── */}
      <div className="flex-1 overflow-hidden">

      {/* ─── TAB: RESULTADOS ─── */}
      {tab === "resultados" && (
        <div className="h-full overflow-y-auto px-6 py-6 space-y-6">
          <h2 className="text-lg font-bold">Candidatos a la Presidencia</h2>

          {totalSufragantes === 0 ? (
            <p className="text-sm text-[#9ca3af]">Cargando resultados del preconteo...</p>
          ) : (
            <>
              {/* Totals bar */}
              <div className="border border-[#e5e7eb] p-6">
                <div className="grid grid-cols-2 gap-6">
                  {/* Cepeda */}
                  <div className="text-center">
                    <div className="text-xs font-semibold text-[#6b7280] uppercase tracking-wide mb-1">
                      IVÁN CEPEDA CASTRO
                    </div>
                    <div className="text-4xl font-black tabnum text-violet-700">{n(cepedaTotal)}</div>
                    <div className="text-xl font-bold text-violet-600 mt-1">{pctCepeda.toFixed(2)}%</div>
                    <div className="mt-3 h-3 bg-violet-100">
                      <div className="h-full bg-violet-600" style={{ width: `${pctCepeda}%` }} />
                    </div>
                  </div>
                  {/* Espriella */}
                  <div className="text-center">
                    <div className="text-xs font-semibold text-[#6b7280] uppercase tracking-wide mb-1">
                      ABELARDO DE LA ESPRIELLA
                    </div>
                    <div className="text-4xl font-black tabnum text-orange-600">{n(espriellaTotal)}</div>
                    <div className="text-xl font-bold text-orange-500 mt-1">{pctEspriella.toFixed(2)}%</div>
                    <div className="mt-3 h-3 bg-orange-100">
                      <div className="h-full bg-orange-500" style={{ width: `${pctEspriella}%` }} />
                    </div>
                  </div>
                </div>
                <div className="mt-4 text-center text-xs text-[#9ca3af]">
                  Total sufragantes reportados: <strong className="text-[#4b5563]">{n(totalSufragantes)}</strong>
                  {" · "}Fuente: preconteo Registraduría · última actualización en base
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 border border-[#e5e7eb] divide-x divide-[#e5e7eb]">
                {[
                  { label: "Mesas informadas", value: `${n(mesasEsc)} / ${n(mesasTotal)}`, sub: `${pctMesas.toFixed(2)}%` },
                  { label: "Sufragantes", value: n(totalSufragantes), sub: "votos válidos" },
                  { label: "Municipios", value: n(summary?.municipios ?? 0), sub: "con resultados" },
                ].map(({ label, value, sub }) => (
                  <div key={label} className="p-4 text-center">
                    <div className="font-black tabnum text-lg">{value}</div>
                    <div className="text-xs font-semibold text-[#0a0a0a] mt-0.5">{label}</div>
                    <div className="text-xs text-[#9ca3af]">{sub}</div>
                  </div>
                ))}
              </div>

              {/* E-14 audit status */}
              <div className="border border-[#e5e7eb] p-4 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-sm">Auditoría ciudadana E-14</div>
                  <div className="text-xs text-[#6b7280] mt-0.5">
                    {n(e14Auditadas)} de {n(e14Total)} actas auditadas por IA ciudadana
                    {e14Fraude > 0 && <span className="text-red-600"> · {n(e14Fraude)} con irregularidades</span>}
                  </div>
                </div>
                <a href="/auditar" className="text-xs bg-[#0a0a0a] text-white px-4 py-2 hover:bg-[#374151]">
                  Participar →
                </a>
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── TAB: POR TERRITORIO ─── */}
      {tab === "territorio" && (
        <div className="h-full grid grid-cols-1 lg:grid-cols-2">
          {/* Left: Map — full height */}
          <div className="border-r border-[#e5e7eb] relative h-full">
            <ColombiaMap
              mode="preconteo"
              preconteoStats={deptStats}
              selectedDept={selectedDept}
              onSelect={handleDeptSelect}
            />
            {/* Legend */}
            <div className="absolute bottom-4 left-4 bg-white/95 border border-[#e5e7eb] p-3 text-xs shadow-sm">
              <div className="font-semibold mb-2 text-[#6b7280] uppercase tracking-wide text-[10px]">Candidato ganador</div>
              <div className="space-y-1">
                {[
                  { color: "#5b21b6", label: "Cepeda +10%" },
                  { color: "#7c3aed", label: "Cepeda +5%" },
                  { color: "#a78bfa", label: "Cepeda +2%" },
                  { color: "#ddd6fe", label: "Cepeda ajustado" },
                ].map(({ color, label }) => (
                  <div key={label} className="flex items-center gap-2">
                    <div className="w-4 h-3 shrink-0" style={{ background: color }} />
                    <span>{label}</span>
                  </div>
                ))}
                <div className="border-t border-[#e5e7eb] my-1" />
                {[
                  { color: "#c2410c", label: "Espriella +10%" },
                  { color: "#ea580c", label: "Espriella +5%" },
                  { color: "#fb923c", label: "Espriella +2%" },
                  { color: "#fed7aa", label: "Espriella ajustado" },
                ].map(({ color, label }) => (
                  <div key={label} className="flex items-center gap-2">
                    <div className="w-4 h-3 shrink-0" style={{ background: color }} />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Dept list — scrolls independently */}
          <div className="flex flex-col h-full overflow-hidden border-t lg:border-t-0 border-[#e5e7eb]">
            {/* Selected dept detail */}
            {selectedDept && selectedPreconteoDept && (
              <div className="border-b border-[#e5e7eb] p-4 bg-[#f9fafb]">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm">{selectedPreconteoDept.deptNombre}</span>
                  <button onClick={resetDrill} className="text-xs text-[#6b7280] hover:text-[#0a0a0a]">← Volver</button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-violet-50 border border-violet-200 p-2 text-center">
                    <div className="font-black text-violet-700 tabnum text-lg">{selectedPreconteoDept.pctCepeda.toFixed(2)}%</div>
                    <div className="text-violet-600">Cepeda · {n(selectedPreconteoDept.cepedaVotos)}</div>
                  </div>
                  <div className="bg-orange-50 border border-orange-200 p-2 text-center">
                    <div className="font-black text-orange-600 tabnum text-lg">{selectedPreconteoDept.pctEspriella.toFixed(2)}%</div>
                    <div className="text-orange-500">Espriella · {n(selectedPreconteoDept.espriellaVotos)}</div>
                  </div>
                </div>
                <div className="text-xs text-[#9ca3af] mt-2">
                  {n(selectedPreconteoDept.mesasEsc)} / {n(selectedPreconteoDept.mesasTotal)} mesas ·{" "}
                  {n(selectedPreconteoDept.sufragantes)} sufragantes
                  {selectedGeoStat && selectedGeoStat.auditadas > 0 && (
                    <span className="ml-1 text-green-600">· {selectedGeoStat.auditadas} actas E-14 auditadas</span>
                  )}
                </div>
              </div>
            )}

            {/* Dept list */}
            <div className="flex-1 overflow-auto">
              {deptStats.length === 0 ? (
                <div className="text-sm text-[#9ca3af] text-center py-12">Cargando datos...</div>
              ) : (
                deptStats.map(d => {
                  const geoD = geoStats.find(g => g.code === d.deptCodigo);
                  return (
                    <button
                      key={d.deptCodigo}
                      onClick={() => handleDeptSelect(d.deptCodigo, d.deptNombre)}
                      className={`w-full text-left px-4 py-3 border-b border-[#f3f4f6] hover:bg-[#f9fafb] transition-colors ${selectedDept === d.deptCodigo ? "bg-amber-50" : ""}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-sm">{d.deptNombre}</div>
                          <div className="text-xs text-[#9ca3af] mt-0.5">
                            {n(d.mesasEsc)}/{n(d.mesasTotal)} mesas · {n(d.sufragantes)} votos
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <div className={`text-sm font-bold tabnum ${d.winner === "cepeda" ? "text-violet-700" : "text-orange-600"}`}>
                            {d.winner === "cepeda"
                              ? `C ${d.pctCepeda.toFixed(1)}%`
                              : `E ${d.pctEspriella.toFixed(1)}%`}
                          </div>
                          {geoD && geoD.auditadas > 0 && (
                            <div className="text-xs text-green-600">{geoD.auditadas} E-14 ✓</div>
                          )}
                        </div>
                      </div>
                      {/* Mini bar */}
                      <div className="mt-1.5 h-1 bg-[#f3f4f6] flex">
                        <div className="h-full bg-violet-500" style={{ width: `${d.pctCepeda}%` }} />
                        <div className="h-full bg-orange-400" style={{ width: `${d.pctEspriella}%` }} />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB: COBERTURA E-14 ─── */}
      {tab === "cobertura" && (
        <div className="h-full flex flex-col overflow-hidden">
          {/* Stats bar */}
          <div className="grid grid-cols-4 border border-[#e5e7eb] divide-x divide-[#e5e7eb]">
            {[
              { label: "Total actas E-14", value: n(e14Total), color: "#0a0a0a" },
              { label: "Auditadas", value: n(e14Auditadas), color: "#059669" },
              { label: "Cobertura", value: e14Total > 0 ? `${((e14Auditadas / e14Total) * 100).toFixed(2)}%` : "0%", color: "#1d4ed8" },
              { label: "Con irregularidades", value: n(e14Fraude), color: "#b91c1c" },
            ].map(({ label, value, color }) => (
              <div key={label} className="p-4 text-center">
                <div className="font-black tabnum text-xl" style={{ color }}>{value}</div>
                <div className="text-xs text-[#9ca3af] mt-0.5">{label}</div>
              </div>
            ))}
          </div>

          <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-5">
            {/* Left: drill-down panel */}
            <div className="lg:col-span-2 border border-[#e5e7eb] flex flex-col overflow-hidden">
              {/* Breadcrumb */}
              <div className="px-4 py-3 border-b border-[#e5e7eb] flex items-center gap-2 text-xs text-[#6b7280] shrink-0">
                <button
                  onClick={resetDrill}
                  className="hover:text-[#0a0a0a] font-medium"
                >Colombia</button>
                {selectedDeptName && (
                  <>
                    <span>›</span>
                    <button onClick={() => { setSelectedMun(null); setMesas([]); }} className="hover:text-[#0a0a0a]">
                      {selectedDeptName}
                    </button>
                  </>
                )}
                {selectedMun && (
                  <>
                    <span>›</span>
                    <span className="text-[#0a0a0a]">Mun {selectedMun}</span>
                  </>
                )}
              </div>
              {loading && (
                <div className="px-4 py-2 text-xs text-[#9ca3af] border-b border-[#e5e7eb]">Cargando...</div>
              )}
              <div className="flex-1 overflow-auto">
                {/* Dept list */}
                {!selectedDept && (
                  <div>
                    <div className="px-4 py-2 text-xs font-semibold text-[#9ca3af] uppercase tracking-wide border-b border-[#e5e7eb] bg-[#f9fafb]">
                      {geoStats.length} departamentos · click para municipios
                    </div>
                    {geoStats.map(d => (
                      <button
                        key={d.code}
                        onClick={() => handleDeptSelect(d.code, DANE_TO_NAME[d.code] ?? d.code)}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#f9fafb] border-b border-[#f3f4f6] text-left"
                      >
                        <div>
                          <div className="text-sm font-medium">{DANE_TO_NAME[d.code] ?? d.code}</div>
                          <div className="text-xs text-[#9ca3af]">{n(d.total)} actas</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className={`text-sm font-bold tabnum ${d.auditadas > 0 ? "text-green-600" : "text-[#9ca3af]"}`}>
                            {d.pct}%
                          </div>
                          {d.severidadAlta > 0 && (
                            <div className="text-xs text-red-600">⚠ {d.severidadAlta} alta</div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Municipalities */}
                {selectedDept && !selectedMun && (
                  <div>
                    <div className="px-4 py-2 text-xs font-semibold text-[#9ca3af] uppercase tracking-wide border-b border-[#e5e7eb] bg-[#f9fafb] flex items-center justify-between">
                      <span>{municipalities.length} municipios</span>
                      <button onClick={handleBack} className="text-blue-600 hover:underline normal-case font-normal">← Volver</button>
                    </div>
                    {municipalities.map(m => (
                      <button
                        key={m.code}
                        onClick={() => handleMunSelect(m.code)}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#f9fafb] border-b border-[#f3f4f6] text-left"
                      >
                        <div>
                          <div className="text-sm font-medium font-mono">Mun {m.code}</div>
                          <div className="text-xs text-[#9ca3af]">{n(m.total)} mesas</div>
                        </div>
                        <div className={`text-sm font-bold tabnum ${m.auditadas > 0 ? "text-green-600" : "text-[#9ca3af]"}`}>
                          {m.total > 0 ? ((m.auditadas / m.total) * 100).toFixed(1) : "0"}%
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Mesas */}
                {selectedMun && (
                  <div>
                    <div className="px-4 py-2 text-xs font-semibold text-[#9ca3af] uppercase tracking-wide border-b border-[#e5e7eb] bg-[#f9fafb] flex items-center justify-between">
                      <span>{n(totalMesas)} mesas · {mesas.length} cargadas</span>
                      <button onClick={handleBack} className="text-blue-600 hover:underline normal-case font-normal">← Volver</button>
                    </div>
                    <div className="p-3 space-y-2">
                      {mesas.map(a => (
                        <button
                          key={a.id}
                          onClick={() => setSelectedActa(a)}
                          className={`w-full text-left border px-3 py-2.5 hover:bg-[#f9fafb] transition-colors ${
                            a.fraudSeverity === "ALTA" ? "border-red-300" :
                            a.fraudSeverity === "MEDIA" ? "border-yellow-300" :
                            a.auditedAt ? "border-green-200" : "border-[#e5e7eb]"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold">Mesa {a.mesa}</span>
                            <StatusBadge status={a.status} auditedAt={a.auditedAt} />
                          </div>
                          {a.candidato0 && a.candidato1 && (
                            <div className="flex gap-3 text-xs">
                              <span className="text-violet-700 font-bold tabnum">{a.candidato0.votos ?? "?"}</span>
                              <span className="text-[#9ca3af]">vs</span>
                              <span className="text-orange-600 font-bold tabnum">{a.candidato1.votos ?? "?"}</span>
                            </div>
                          )}
                          {(a.fraudFlags?.length ?? 0) > 0 && (
                            <div className="text-xs text-red-600 mt-1 truncate">⚠ {a.fraudFlags![0]}</div>
                          )}
                        </button>
                      ))}
                      {mesas.length === 0 && !loading && (
                        <div className="text-sm text-[#9ca3af] text-center py-8">Sin actas cargadas aún</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Map */}
            <div className="lg:col-span-3 border-l border-[#e5e7eb] relative h-full">
              <ColombiaMap
                mode="coverage"
                stats={geoStats}
                selectedDept={selectedDept}
                onSelect={handleDeptSelect}
              />
              <div className="absolute bottom-4 left-4 bg-white/95 border border-[#e5e7eb] p-3 text-xs shadow-sm">
                <div className="font-semibold mb-2 text-[#6b7280] uppercase tracking-wide text-[10px]">Cobertura auditada</div>
                <div className="space-y-1">
                  {[
                    { color: "#f3f4f6", label: "Sin auditar" },
                    { color: "#6ee7b7", label: "< 1%" },
                    { color: "#10b981", label: "1–5%" },
                    { color: "#059669", label: "5–20%" },
                    { color: "#047857", label: "> 50%" },
                  ].map(({ color, label }) => (
                    <div key={label} className="flex items-center gap-2">
                      <div className="w-4 h-3 shrink-0" style={{ background: color, border: "1px solid #e5e7eb" }} />
                      <span>{label}</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 mt-1 pt-1 border-t border-[#e5e7eb]">
                    <div className="w-4 h-3 shrink-0 border-2 border-red-400" style={{ background: "#f3f4f6" }} />
                    <span>Con fraude ALTA</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      </div> {/* end content area */}

      {selectedActa && (
        <MesaModal acta={selectedActa} onClose={() => setSelectedActa(null)} />
      )}
    </div>
  );
}
