import { api } from "@/lib/api";
import type { E14PipelineStats, E14RecentActa, E14FraudCheck } from "@/lib/api";

export const dynamic = "force-dynamic";

function n(v: number) {
  return v.toLocaleString("es-CO");
}

// ─── Pipeline section ─────────────────────────────────────────────────────────

function PipelineSection({ stats }: { stats: E14PipelineStats }) {
  const pct = stats.total > 0 ? (stats.ocr_done / stats.total) * 100 : 0;

  return (
    <div className="border border-[#e5e7eb]">
      <div className="p-6 border-b border-[#e5e7eb] flex items-center justify-between gap-4">
        <div>
          <div className="font-bold text-[#0a0a0a]">Estado del pipeline</div>
          <div className="text-xs text-[#9ca3af] mt-0.5">
            {n(stats.ocr_done)} de {n(stats.total)} actas auditadas con OCR
          </div>
        </div>
        <div className="text-right">
          <div className="font-black text-3xl tabnum text-[#0a0a0a]">{pct.toFixed(2)}%</div>
          <div className="text-xs text-[#9ca3af]">completado</div>
        </div>
      </div>

      <div className="h-1 bg-[#f3f4f6]">
        <div className="h-full bg-[#16a34a]" style={{ width: `${Math.max(pct, 0.2)}%` }} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-[#e5e7eb]">
        {[
          { label: "Total actas", value: stats.total, color: "#0a0a0a" },
          { label: "Pendientes", value: stats.pending, color: "#6b7280" },
          { label: "OCR listo", value: stats.ocr_done, color: "#16a34a" },
          { label: "Con error", value: stats.error, color: "#b91c1c" },
        ].map(({ label, value, color }) => (
          <div key={label} className="p-5">
            <div className="font-bold text-2xl tabnum" style={{ color }}>{n(value)}</div>
            <div className="text-xs text-[#9ca3af] mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {stats.topDepts.length > 0 && (
        <div className="border-t border-[#e5e7eb] px-6 py-4">
          <div className="text-xs font-semibold text-[#9ca3af] uppercase tracking-widest mb-2">
            Top departamentos auditados
          </div>
          <div className="flex flex-wrap gap-2">
            {stats.topDepts.map((d) => (
              <span key={d.dept} className="text-xs font-medium px-2.5 py-1 border border-[#e5e7eb] text-[#4b5563]">
                Dept {d.dept} · {n(d.count)} actas
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Fraud detection dashboard ────────────────────────────────────────────────

const SEV_STYLE = {
  ALTA:   { bg: "#fef2f2", border: "#fca5a5", text: "#b91c1c", dot: "#dc2626" },
  MEDIA:  { bg: "#fffbeb", border: "#fde68a", text: "#92400e", dot: "#d97706" },
  BAJA:   { bg: "#eff6ff", border: "#bfdbfe", text: "#1e40af", dot: "#2563eb" },
  NINGUNA:{ bg: "#f0fdf4", border: "#bbf7d0", text: "#166534", dot: "#16a34a" },
};

function FraudDashboard({ fraud }: { fraud: E14FraudCheck }) {
  const { resumen, irregularidades } = fraud;

  if (resumen.totalAnalizadas === 0) {
    return (
      <div className="border border-[#e5e7eb] p-8 text-center text-sm text-[#9ca3af]">
        Sin actas analizadas todavía — ejecuta el pipeline para procesar más actas
      </div>
    );
  }

  const pctIrreg = ((resumen.totalConIrregularidades / resumen.totalAnalizadas) * 100).toFixed(1);

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 border border-[#e5e7eb] divide-x divide-[#e5e7eb]">
        <div className="p-5">
          <div className="font-bold text-2xl tabnum text-[#0a0a0a]">{n(resumen.totalAnalizadas)}</div>
          <div className="text-xs text-[#9ca3af] mt-0.5">Analizadas</div>
        </div>
        <div className="p-5">
          <div className={`font-bold text-2xl tabnum ${resumen.totalConIrregularidades > 0 ? "text-[#b91c1c]" : "text-[#16a34a]"}`}>
            {n(resumen.totalConIrregularidades)}
          </div>
          <div className="text-xs text-[#9ca3af] mt-0.5">Con irregularidades ({pctIrreg}%)</div>
        </div>
        <div className="p-5">
          <div className={`font-bold text-2xl tabnum ${resumen.conEnmiendaVisual > 0 ? "text-[#d97706]" : "text-[#6b7280]"}`}>
            {n(resumen.conEnmiendaVisual)}
          </div>
          <div className="text-xs text-[#9ca3af] mt-0.5">Enmiendas visuales</div>
        </div>
        <div className="p-5">
          <div className={`font-bold text-2xl tabnum ${resumen.severidadAlta > 0 ? "text-[#b91c1c]" : "text-[#6b7280]"}`}>
            {n(resumen.severidadAlta)}
          </div>
          <div className="text-xs text-[#9ca3af] mt-0.5">Severidad ALTA</div>
        </div>
      </div>

      {/* How fraud is detected — explanation */}
      <div className="border border-[#e5e7eb] p-5 space-y-3">
        <div className="text-xs font-semibold text-[#9ca3af] uppercase tracking-widest">
          Métodos de detección activos
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              titulo: "Validación aritmética",
              desc: "C1 + C2 + blancos + nulos + no marcados = suma total = votos en urna ≤ E-11",
              color: "#1d4ed8",
            },
            {
              titulo: "Análisis forense visual",
              desc: "Claude Vision detecta números sobreescritos, diferencias en trazo de bolígrafo, correcciones en celdas de votos",
              color: "#d97706",
            },
            {
              titulo: "CLAVEROS vs DELEGADOS",
              desc: "Comparación entre las dos copias físicas del acta — discrepancias entre ellas indican manipulación",
              color: "#b91c1c",
            },
          ].map(({ titulo, desc, color }) => (
            <div key={titulo} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                <span className="text-xs font-semibold text-[#0a0a0a]">{titulo}</span>
              </div>
              <p className="text-xs text-[#6b7280] leading-relaxed pl-4">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Irregularities table */}
      {irregularidades.length > 0 ? (
        <div className="border border-[#e5e7eb]">
          <div className="bg-[#f9fafb] border-b border-[#e5e7eb] px-5 py-3 flex items-center justify-between">
            <span className="text-xs font-semibold text-[#0a0a0a] uppercase tracking-wide">
              Actas con irregularidades
            </span>
            <span className="text-xs text-[#9ca3af]">{irregularidades.length} registros</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e5e7eb]">
                  {["Sev.", "Tipo", "Mesa · Municipio", "Cand. 1 (Cepeda)", "Cand. 2 (De la Espriella)", "Irregularidad"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-[#6b7280] uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f3f4f6]">
                {irregularidades.map((irr) => {
                  const sev = SEV_STYLE[irr.severidadAnomalia as keyof typeof SEV_STYLE] ?? SEV_STYLE.NINGUNA;
                  const allFlags = [
                    ...irr.flagsAritmetica,
                    ...(irr.hayEnmiendas ? [`ENMIENDA: ${irr.enmiendaDetalle}`] : []),
                  ];
                  return (
                    <tr key={irr.txId} style={{ background: sev.bg }} className="hover:brightness-95 transition-all">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ background: sev.dot }} />
                          <span className="text-xs font-bold" style={{ color: sev.text }}>
                            {irr.severidadAnomalia}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="text-xs font-semibold px-2 py-0.5 border"
                          style={{ borderColor: sev.border, color: sev.text, background: "rgba(255,255,255,0.6)" }}
                        >
                          {irr.tipoCopia}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-mono text-xs text-[#9ca3af]">
                          Zona {irr.zona} · Puesto {irr.stand} · Mesa {irr.mesa}
                        </div>
                        <div className="font-medium text-xs text-[#0a0a0a]">{irr.municipio}</div>
                        <div className="text-xs text-[#9ca3af]">{irr.departamento}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold tabnum text-[#1d4ed8]">
                          {irr.candidato0.votos != null ? n(irr.candidato0.votos) : "—"}
                        </div>
                        <div className="text-xs text-[#9ca3af] truncate max-w-[100px]">
                          {irr.candidato0.nombre.split(" ").slice(0, 2).join(" ")}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold tabnum text-[#b91c1c]">
                          {irr.candidato1.votos != null ? n(irr.candidato1.votos) : "—"}
                        </div>
                        <div className="text-xs text-[#9ca3af] truncate max-w-[100px]">
                          {irr.candidato1.nombre.split(" ").slice(0, 2).join(" ")}
                        </div>
                      </td>
                      <td className="px-4 py-3 max-w-[260px]">
                        {allFlags.map((f, i) => (
                          <div key={i} className="text-xs leading-relaxed" style={{ color: sev.text }}>
                            {f}
                          </div>
                        ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="border border-[#d1fae5] bg-[#f0fdf4] p-6 text-center">
          <div className="text-sm font-semibold text-[#166534]">Sin irregularidades detectadas</div>
          <div className="text-xs text-[#4ade80] mt-1">
            Las {n(resumen.totalAnalizadas)} actas procesadas pasan todas las validaciones automáticas
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Actas table ──────────────────────────────────────────────────────────────

function ActasTable({ actas }: { actas: E14RecentActa[] }) {
  if (actas.length === 0) {
    return (
      <div className="border border-[#e5e7eb] p-12 text-center">
        <div className="text-sm text-[#9ca3af]">Sin actas procesadas todavía</div>
        <div className="text-xs text-[#d1d5db] mt-2 font-mono">
          npx tsx scripts/pipeline-e14.ts run 10
        </div>
      </div>
    );
  }

  return (
    <div className="border border-[#e5e7eb] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#f9fafb] border-b border-[#e5e7eb]">
              {["Tipo", "Puesto / Mesa", "Municipio", "Zona", "Candidato 1", "Candidato 2", "Blancos", "Nulos", "Sufragantes", "Estado"].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-[#6b7280] uppercase tracking-wide whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f3f4f6]">
            {actas.map((acta) => {
              const ocr = acta.ocrResult;
              const c0 = ocr?.candidatos[0];
              const c1 = ocr?.candidatos[1];
              const hasObs = !!ocr?.observaciones?.trim() || ocr?.hayEnmiendas;
              const sev = ocr?.severidadAnomalia ?? "NINGUNA";
              const sevStyle = SEV_STYLE[sev as keyof typeof SEV_STYLE] ?? SEV_STYLE.NINGUNA;
              return (
                <tr key={acta.id} style={{ background: hasObs ? sevStyle.bg : undefined }} className="hover:bg-[#f9fafb] transition-colors">
                  <td className="px-4 py-3">
                    <span
                      className="text-xs font-semibold px-1.5 py-0.5 border"
                      style={hasObs ? { borderColor: sevStyle.border, color: sevStyle.text } : { borderColor: "#e5e7eb", color: "#6b7280" }}
                    >
                      {ocr?.tipoCopia ?? "?"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs text-[#9ca3af] truncate max-w-[120px]">{ocr?.puesto || "—"}</div>
                    <div className="font-mono text-xs font-medium">Mesa {ocr?.mesa ?? acta.mesa}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-xs text-[#0a0a0a]">{ocr?.municipio ?? `Mun ${acta.munCode}`}</div>
                    <div className="text-xs text-[#9ca3af]">{ocr?.departamento ?? acta.deptCode}</div>
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-[#6b7280]">{ocr?.zona ?? "—"}</td>
                  <td className="px-4 py-3">
                    {c0 ? (
                      <>
                        <div className="text-xs text-[#9ca3af] truncate max-w-[90px]">
                          {c0.nombre.split(" ").slice(0, 2).join(" ")}
                        </div>
                        <div className="font-bold tabnum" style={{ color: "#1d4ed8" }}>{c0.votos ?? "—"}</div>
                      </>
                    ) : <span className="text-[#d1d5db]">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {c1 ? (
                      <>
                        <div className="text-xs text-[#9ca3af] truncate max-w-[90px]">
                          {c1.nombre.split(" ").slice(0, 2).join(" ")}
                        </div>
                        <div className="font-bold tabnum" style={{ color: "#b91c1c" }}>{c1.votos ?? "—"}</div>
                      </>
                    ) : <span className="text-[#d1d5db]">—</span>}
                  </td>
                  <td className="px-4 py-3 tabnum text-[#6b7280]">{ocr?.votosEnBlanco ?? "—"}</td>
                  <td className="px-4 py-3 tabnum text-[#6b7280]">{ocr?.votosNulos ?? "—"}</td>
                  <td className="px-4 py-3 tabnum font-medium">
                    {ocr?.totalSufragantes != null ? n(ocr.totalSufragantes) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {hasObs ? (
                      <span
                        className="text-xs font-medium px-1.5 py-0.5 border inline-block"
                        style={{ borderColor: sevStyle.border, color: sevStyle.text, background: "rgba(255,255,255,0.7)" }}
                      >
                        {sev !== "NINGUNA" ? `⚠ ${sev}` : "OBS"}
                      </span>
                    ) : (
                      <span className="text-[#d1d5db] text-xs">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function E14Page() {
  let stats: E14PipelineStats | null = null;
  let actas: E14RecentActa[] = [];
  let fraud: E14FraudCheck | null = null;

  const [r0, r1, r2] = await Promise.allSettled([
    api.e14.stats(),
    api.e14.recent(50),
    api.e14.fraudCheck(200),
  ]);
  if (r0.status === "fulfilled") stats = r0.value;
  if (r1.status === "fulfilled") actas = r1.value;
  if (r2.status === "fulfilled") fraud = r2.value;

  return (
    <div className="space-y-10">
      {/* Page header */}
      <div className="border-b border-[#e5e7eb] pb-6">
        <div className="text-xs font-semibold text-[#9ca3af] uppercase tracking-widest mb-2">
          OCR Pipeline · Claude Vision
        </div>
        <h1 className="text-3xl font-black text-[#0a0a0a] leading-tight">Actas E-14</h1>
        <p className="text-sm text-[#6b7280] mt-2 max-w-xl">
          El pipeline descarga cada PDF publicado por la Registraduría y usa Claude Vision para
          extraer los votos y detectar alteraciones visuales en el formulario E-14.
        </p>
      </div>

      {/* Pipeline stats */}
      {stats ? (
        <PipelineSection stats={stats} />
      ) : (
        <div className="border border-[#fde68a] bg-[#fffbeb] p-5 space-y-2">
          <div className="text-sm font-semibold text-[#92400e]">Endpoint E-14 no disponible</div>
          <div className="text-xs text-[#b45309]">Reinicia la API:</div>
          <code className="text-xs font-mono bg-[#fef3c7] px-2 py-1 block w-fit">
            pnpm --filter api dev
          </code>
        </div>
      )}

      {/* Fraud detection */}
      <div className="space-y-4">
        <div className="border-b border-[#e5e7eb] pb-3">
          <h2 className="text-xl font-black text-[#0a0a0a]">Detección de irregularidades</h2>
          <p className="text-xs text-[#6b7280] mt-1">
            Análisis automático: validación aritmética + detección forense visual por Claude Vision.
            El E-14 prevalece sobre el preconteo — la detección de manipulación requiere comparar
            la copia CLAVEROS con la copia DELEGADOS de cada mesa.
          </p>
        </div>
        {fraud ? (
          <FraudDashboard fraud={fraud} />
        ) : (
          <div className="border border-[#e5e7eb] p-6 text-sm text-[#9ca3af] text-center">
            Módulo de detección no disponible
          </div>
        )}
      </div>

      {/* Actas table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#0a0a0a]">Actas procesadas</h2>
          <span className="text-xs text-[#9ca3af]">{actas.length} registros mostrados</span>
        </div>
        <ActasTable actas={actas} />
      </div>
    </div>
  );
}
