"use client";
import { useState } from "react";
import type { FraudActa } from "@/lib/api";
import ActaDrawer from "./ActaDrawer";

function n(v: number) { return v.toLocaleString("es-CO"); }

const SEV_STYLE = {
  ALTA:    { bg: "#fef2f2", border: "#fca5a5", text: "#b91c1c", dot: "#dc2626" },
  MEDIA:   { bg: "#fffbeb", border: "#fde68a", text: "#92400e", dot: "#d97706" },
  BAJA:    { bg: "#eff6ff", border: "#bfdbfe", text: "#1e40af", dot: "#2563eb" },
  NINGUNA: { bg: "#f0fdf4", border: "#bbf7d0", text: "#166534", dot: "#16a34a" },
};

interface Props {
  irregularidades: FraudActa[];
  resumen: {
    totalAnalizadas: number;
    totalConIrregularidades: number;
    conErrorAritmetico: number;
    conEnmiendaVisual: number;
    severidadAlta: number;
  };
}

export default function E14FraudTable({ irregularidades, resumen }: Props) {
  const [selected, setSelected] = useState<FraudActa | null>(null);
  const [filter, setFilter] = useState<"ALL" | "ALTA" | "MEDIA" | "BAJA">("ALL");

  if (resumen.totalAnalizadas === 0) {
    return (
      <div className="border border-[#e5e7eb] p-8 text-center text-sm text-[#9ca3af]">
        Sin actas analizadas todavía — usa la sección Auditar para procesar actas con IA
      </div>
    );
  }

  const pctIrreg = ((resumen.totalConIrregularidades / resumen.totalAnalizadas) * 100).toFixed(1);
  const visible = filter === "ALL" ? irregularidades : irregularidades.filter(i => i.severidadAnomalia === filter);

  return (
    <>
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 border border-[#e5e7eb] divide-x divide-[#e5e7eb]">
        <div className="p-4 text-center">
          <div className="font-black tabnum text-xl text-[#0a0a0a]">{n(resumen.totalAnalizadas)}</div>
          <div className="text-xs text-[#9ca3af] mt-0.5">Analizadas</div>
        </div>
        <div className="p-4 text-center">
          <div className={`font-black tabnum text-xl ${resumen.totalConIrregularidades > 0 ? "text-[#b91c1c]" : "text-[#16a34a]"}`}>
            {n(resumen.totalConIrregularidades)}
          </div>
          <div className="text-xs text-[#9ca3af] mt-0.5">Irregulares ({pctIrreg}%)</div>
        </div>
        <div className="p-4 text-center">
          <div className={`font-black tabnum text-xl ${resumen.conEnmiendaVisual > 0 ? "text-[#d97706]" : "text-[#6b7280]"}`}>
            {n(resumen.conEnmiendaVisual)}
          </div>
          <div className="text-xs text-[#9ca3af] mt-0.5">Enmiendas visuales</div>
        </div>
        <div className="p-4 text-center">
          <div className={`font-black tabnum text-xl ${resumen.severidadAlta > 0 ? "text-[#b91c1c]" : "text-[#6b7280]"}`}>
            {n(resumen.severidadAlta)}
          </div>
          <div className="text-xs text-[#9ca3af] mt-0.5">Severidad ALTA</div>
        </div>
      </div>

      {/* Detection methods */}
      <div className="border border-[#e5e7eb] p-4">
        <div className="text-xs font-semibold text-[#9ca3af] uppercase tracking-widest mb-3">Métodos de detección activos</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { dot: "#1d4ed8", titulo: "Validación aritmética", desc: "Cepeda + Espriella + blancos + nulos = suma total = votos en urna ≤ E-11" },
            { dot: "#d97706", titulo: "Análisis forense visual (IA)", desc: "Detecta números sobreescritos, correcciones, diferencias en trazo de bolígrafo" },
            { dot: "#b91c1c", titulo: "CLAVEROS vs DELEGADOS", desc: "Discrepancias entre las dos copias físicas del acta indican posible manipulación" },
          ].map(({ dot, titulo, desc }) => (
            <div key={titulo} className="flex gap-2">
              <div className="w-2 h-2 rounded-full mt-1 shrink-0" style={{ background: dot }} />
              <div>
                <div className="text-xs font-semibold text-[#0a0a0a]">{titulo}</div>
                <p className="text-xs text-[#6b7280] leading-relaxed mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actas table */}
      {irregularidades.length > 0 ? (
        <div className="border border-[#e5e7eb]">
          <div className="bg-[#f9fafb] border-b border-[#e5e7eb] px-4 py-3 flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-semibold text-[#0a0a0a] uppercase tracking-wide">
              Actas con irregularidades — click para ver PDF
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#9ca3af]">{visible.length} de {irregularidades.length}</span>
              <div className="flex border border-[#e5e7eb] text-xs overflow-hidden">
                {(["ALL", "ALTA", "MEDIA", "BAJA"] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1 font-medium transition-colors ${filter === f ? "bg-[#0a0a0a] text-white" : "hover:bg-[#f3f4f6] text-[#6b7280]"}`}
                  >
                    {f === "ALL" ? "Todas" : f}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e5e7eb]">
                  {["Sev.", "Tipo", "Mesa · Ubicación", "Cepeda", "Espriella", "Suma total", "Irregularidad", "Acta"].map(h => (
                    <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-[#6b7280] uppercase tracking-wide whitespace-nowrap bg-white">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f3f4f6]">
                {visible.map(irr => {
                  const sev = SEV_STYLE[irr.severidadAnomalia as keyof typeof SEV_STYLE] ?? SEV_STYLE.NINGUNA;
                  const flags = [...irr.flagsAritmetica, ...(irr.hayEnmiendas ? ["ENMIENDA VISUAL"] : [])];
                  return (
                    <tr
                      key={irr.txId}
                      style={{ background: sev.bg }}
                      className="hover:brightness-95 transition-all cursor-pointer"
                      onClick={() => setSelected(irr)}
                    >
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ background: sev.dot }} />
                          <span className="text-xs font-bold" style={{ color: sev.text }}>{irr.severidadAnomalia}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-xs font-mono border px-1.5 py-0.5" style={{ borderColor: sev.border, color: sev.text }}>
                          {irr.tipoCopia}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-mono text-xs text-[#9ca3af]">Z{irr.zona}·P{irr.stand}·M{irr.mesa}</div>
                        <div className="font-medium text-xs text-[#0a0a0a]">{irr.municipio}</div>
                        <div className="text-xs text-[#9ca3af]">{irr.departamento}</div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-bold tabnum text-violet-700 text-base">
                          {irr.candidato0.votos != null ? n(irr.candidato0.votos) : "—"}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-bold tabnum text-orange-600 text-base">
                          {irr.candidato1.votos != null ? n(irr.candidato1.votos) : "—"}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-bold tabnum text-[#4b5563]">
                          {irr.sumaTotal != null ? n(irr.sumaTotal) : "—"}
                        </div>
                      </td>
                      <td className="px-3 py-3 max-w-[200px]">
                        {flags.slice(0, 2).map((f, i) => (
                          <div key={i} className="text-xs leading-relaxed truncate" style={{ color: sev.text }}>
                            • {f}
                          </div>
                        ))}
                        {flags.length > 2 && (
                          <div className="text-xs text-[#9ca3af]">+{flags.length - 2} más...</div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <button
                          onClick={e => { e.stopPropagation(); setSelected(irr); }}
                          className="text-xs border border-[#e5e7eb] bg-white px-2.5 py-1 hover:bg-[#f9fafb] font-medium whitespace-nowrap"
                          style={{ borderColor: sev.border, color: sev.text }}
                        >
                          Ver E-14 ↗
                        </button>
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
          <div className="text-xs text-[#6b7280] mt-1">
            Las {n(resumen.totalAnalizadas)} actas procesadas pasan todas las validaciones automáticas
          </div>
        </div>
      )}

      {/* Drawer */}
      <ActaDrawer acta={selected} onClose={() => setSelected(null)} />
    </>
  );
}
