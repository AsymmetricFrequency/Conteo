import { api } from "@/lib/api";
import { AlertsTable } from "@/components/AlertsTable";
import E14FraudTable from "@/components/E14FraudTable";
import type { StatsSummary } from "@/lib/api";

export const dynamic = "force-dynamic";

function n(v: number) {
  return v.toLocaleString("es-CO");
}

export default async function AlertasPage() {
  let stats: StatsSummary | null = null;
  const [rAlerts, rStats, rFraud] = await Promise.allSettled([
    api.alerts({ take: "500" }),
    api.stats(),
    api.e14.fraudCheck(500),
  ]);

  const alerts = rAlerts.status === "fulfilled" ? rAlerts.value : [];
  if (rStats.status === "fulfilled") stats = rStats.value;
  const fraud = rFraud.status === "fulfilled" ? rFraud.value : null;

  const porSev = Object.fromEntries((stats?.porSeveridad ?? []).map((s) => [s.severity, s.count]));
  const porEstado = Object.fromEntries((stats?.porEstado ?? []).map((s) => [s.estado, s.count]));
  const total = stats?.porSeveridad.reduce((s, c) => s + c.count, 0) ?? alerts.length;

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="border-b border-[#e5e7eb] pb-6">
        <div className="text-xs font-semibold text-[#9ca3af] uppercase tracking-widest mb-2">
          Trazabilidad y revisión humana
        </div>
        <h1 className="text-3xl font-black text-[#0a0a0a] leading-tight">
          Actas anómalas · Alertas
        </h1>
        <p className="text-sm text-[#6b7280] mt-2 max-w-xl">
          Todos los formularios E-14 auditados por IA son trazables. Haz clic en cualquier acta para
          abrir el PDF original de la Registraduría junto con las irregularidades detectadas.
        </p>
      </div>

      {/* ── SECTION 1: E-14 OCR Anomalies (with PDF links) ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-[#0a0a0a]">Actas E-14 con irregularidades</h2>
            <p className="text-xs text-[#6b7280] mt-0.5">
              Detectadas por validación aritmética y análisis forense visual (IA) ·
              Click en la fila o en "Ver E-14" para abrir el formulario original
            </p>
          </div>
          {fraud && fraud.resumen.severidadAlta > 0 && (
            <div className="text-center border border-red-200 bg-red-50 px-4 py-2">
              <div className="font-black text-2xl tabnum text-red-700">{n(fraud.resumen.severidadAlta)}</div>
              <div className="text-xs text-red-600">Severidad ALTA</div>
            </div>
          )}
        </div>

        {fraud ? (
          <E14FraudTable resumen={fraud.resumen} irregularidades={fraud.irregularidades} />
        ) : (
          <div className="border border-[#e5e7eb] p-8 text-center text-sm text-[#9ca3af]">
            No se pudo cargar el módulo de detección de irregularidades
          </div>
        )}
      </div>

      {/* ── SECTION 2: Rule-based alerts ── */}
      {alerts.length > 0 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-black text-[#0a0a0a]">Alertas del sistema · {n(total)} hallazgos</h2>
            <p className="text-xs text-[#6b7280] mt-0.5">
              Generadas por reglas de comparación E-14 vs preconteo · Requieren revisión humana
            </p>
          </div>

          {/* Severity + Estado */}
          <div className="grid grid-cols-1 lg:grid-cols-2 border border-[#e5e7eb]">
            <div className="p-6 border-b lg:border-b-0 lg:border-r border-[#e5e7eb]">
              <div className="text-xs font-semibold text-[#9ca3af] uppercase tracking-widest mb-4">Por severidad</div>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { key: "ALTA", label: "Alta", color: "#b91c1c", bg: "#fef2f2" },
                  { key: "MEDIA", label: "Media", color: "#d97706", bg: "#fffbeb" },
                  { key: "BAJA", label: "Baja", color: "#1d4ed8", bg: "#eff6ff" },
                ].map(({ key, label, color, bg }) => (
                  <div key={key} className="text-center p-4" style={{ background: bg }}>
                    <div className="font-black text-3xl tabnum" style={{ color }}>{n(porSev[key] ?? 0)}</div>
                    <div className="text-xs font-medium mt-1" style={{ color }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-6">
              <div className="text-xs font-semibold text-[#9ca3af] uppercase tracking-widest mb-4">Por estado de revisión</div>
              <div className="space-y-3">
                {[
                  { key: "PENDIENTE", label: "Pendientes" },
                  { key: "EN_REVISION", label: "En revisión" },
                  { key: "CONFIRMADO", label: "Confirmados" },
                  { key: "DESCARTADO", label: "Descartados" },
                ].map(({ key, label }) => {
                  const count = porEstado[key] ?? 0;
                  const maxCount = Math.max(...Object.values(porEstado), 1);
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <div className="w-24 text-xs text-[#6b7280] shrink-0">{label}</div>
                      <div className="flex-1 h-1.5 bg-[#f3f4f6]">
                        <div className="h-full bg-[#0a0a0a]" style={{ width: `${(count / maxCount) * 100}%` }} />
                      </div>
                      <div className="w-12 text-right font-bold text-sm tabnum text-[#0a0a0a]">{n(count)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="border border-[#e5e7eb]">
            <AlertsTable initial={alerts} />
          </div>
        </div>
      )}

      <p className="text-xs text-[#9ca3af] border-t border-[#e5e7eb] pt-4">
        El E-14 prevalece sobre el preconteo. Las reclamaciones deben presentarse ante la comisión
        escrutadora con evidencia documental original. Todos los PDFs son documentos públicos
        publicados por la Registraduría Nacional del Estado Civil.
      </p>
    </div>
  );
}
