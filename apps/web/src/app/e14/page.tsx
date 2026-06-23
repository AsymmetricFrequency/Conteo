import { api } from "@/lib/api";
import type { E14PipelineStats, E14RecentActa, E14FraudCheck } from "@/lib/api";
import E14FraudTable from "@/components/E14FraudTable";

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

const SEV_STYLE = {
  ALTA:   { bg: "#fef2f2", border: "#fca5a5", text: "#b91c1c", dot: "#dc2626" },
  MEDIA:  { bg: "#fffbeb", border: "#fde68a", text: "#92400e", dot: "#d97706" },
  BAJA:   { bg: "#eff6ff", border: "#bfdbfe", text: "#1e40af", dot: "#2563eb" },
  NINGUNA:{ bg: "#f0fdf4", border: "#bbf7d0", text: "#166534", dot: "#16a34a" },
};

// ─── Actas table ──────────────────────────────────────────────────────────────

function ActasTable({ actas }: { actas: E14RecentActa[] }) {
  if (actas.length === 0) {
    return (
      <div className="border border-[#e5e7eb] p-12 text-center">
        <div className="text-sm text-[#9ca3af]">Sin actas procesadas todavía</div>
      </div>
    );
  }

  return (
    <div className="border border-[#e5e7eb] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#f9fafb] border-b border-[#e5e7eb]">
              {["Tipo", "Mesa · Municipio", "Cepeda", "Espriella", "Blancos", "Nulos", "Total", "Estado", "Acta PDF"].map((h) => (
                <th key={h} className="text-left px-3 py-3 text-xs font-semibold text-[#6b7280] uppercase tracking-wide whitespace-nowrap">
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
              const pdfUrl = acta.pdfUrl ?? acta.sourceUrl;
              return (
                <tr key={acta.id} style={{ background: hasObs ? sevStyle.bg : undefined }} className="hover:bg-[#f9fafb] transition-colors">
                  <td className="px-3 py-3">
                    <span className="text-xs font-semibold px-1.5 py-0.5 border"
                      style={hasObs ? { borderColor: sevStyle.border, color: sevStyle.text } : { borderColor: "#e5e7eb", color: "#6b7280" }}>
                      {ocr?.tipoCopia ?? "?"}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-mono text-xs font-medium">Mesa {ocr?.mesa ?? acta.mesa}</div>
                    <div className="font-medium text-xs text-[#0a0a0a]">{ocr?.municipio ?? `Mun ${acta.munCode}`}</div>
                    <div className="text-xs text-[#9ca3af]">{ocr?.departamento ?? acta.deptCode}</div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-bold tabnum text-violet-700">{c0?.votos ?? "—"}</div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-bold tabnum text-orange-600">{c1?.votos ?? "—"}</div>
                  </td>
                  <td className="px-3 py-3 tabnum text-[#6b7280] text-xs">{ocr?.votosEnBlanco ?? "—"}</td>
                  <td className="px-3 py-3 tabnum text-[#6b7280] text-xs">{ocr?.votosNulos ?? "—"}</td>
                  <td className="px-3 py-3 tabnum font-medium text-xs">
                    {ocr?.totalSufragantes != null ? n(ocr.totalSufragantes) : "—"}
                  </td>
                  <td className="px-3 py-3">
                    {hasObs ? (
                      <span className="text-xs font-medium px-1.5 py-0.5 border inline-block"
                        style={{ borderColor: sevStyle.border, color: sevStyle.text, background: "rgba(255,255,255,0.7)" }}>
                        ⚠ {sev !== "NINGUNA" ? sev : "OBS"}
                      </span>
                    ) : (
                      <span className="text-xs text-green-600 font-medium">✓ OK</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {pdfUrl ? (
                      <a href={pdfUrl} target="_blank" rel="noopener"
                        className="text-xs border border-[#e5e7eb] px-2.5 py-1 hover:bg-[#f9fafb] font-medium text-[#0a0a0a] whitespace-nowrap">
                        Ver E-14 ↗
                      </a>
                    ) : (
                      <span className="text-xs text-[#d1d5db]">—</span>
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
            Análisis automático: validación aritmética + detección forense visual por IA.
            Click en cualquier fila para ver el formulario E-14 original y los detalles de la anomalía.
          </p>
        </div>
        {fraud ? (
          <E14FraudTable resumen={fraud.resumen} irregularidades={fraud.irregularidades} />
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
