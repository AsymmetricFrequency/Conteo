"use client";
import type { FraudActa } from "@/lib/api";

function n(v: number) { return v.toLocaleString("es-CO"); }

const SEV = {
  ALTA:    { bg: "bg-red-50",    border: "border-red-300",    text: "text-red-700",    badge: "bg-red-100 text-red-800 border-red-300" },
  MEDIA:   { bg: "bg-yellow-50", border: "border-yellow-300", text: "text-yellow-700", badge: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  BAJA:    { bg: "bg-blue-50",   border: "border-blue-300",   text: "text-blue-700",   badge: "bg-blue-100 text-blue-800 border-blue-300" },
  NINGUNA: { bg: "bg-gray-50",   border: "border-gray-200",   text: "text-gray-600",   badge: "bg-gray-100 text-gray-700 border-gray-200" },
};

interface Props {
  acta: FraudActa | null;
  onClose: () => void;
}

export default function ActaDrawer({ acta, onClose }: Props) {
  if (!acta) return null;

  const sev = SEV[acta.severidadAnomalia as keyof typeof SEV] ?? SEV.NINGUNA;
  const allFlags = [
    ...acta.flagsAritmetica,
    ...(acta.hayEnmiendas ? [`ENMIENDA: ${acta.enmiendaDetalle || "tachones o correcciones detectadas"}`] : []),
  ];
  const totalVotos = (acta.candidato0.votos ?? 0) + (acta.candidato1.votos ?? 0);

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Panel */}
      <div
        className="absolute inset-y-0 right-0 w-full max-w-6xl bg-white flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-3 border-b border-[#e5e7eb] shrink-0 ${sev.bg}`}>
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`text-xs font-bold px-2.5 py-1 border ${sev.badge}`}>
              {acta.severidadAnomalia}
            </span>
            <span className="text-xs border border-[#e5e7eb] bg-white px-2 py-1 font-mono">
              {acta.tipoCopia}
            </span>
            <div>
              <span className="font-semibold text-sm text-[#0a0a0a]">
                Mesa {acta.mesa} · Zona {acta.zona} · Puesto {acta.stand}
              </span>
              <span className="text-xs text-[#6b7280] ml-2">
                {acta.municipio}{acta.departamento ? `, ${acta.departamento}` : ""}
              </span>
            </div>
            <span className="text-xs font-mono text-[#9ca3af] hidden md:block">{acta.txId}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={acta.pdfUrl}
              target="_blank"
              rel="noopener"
              className="text-xs border border-[#e5e7eb] bg-white px-3 py-1.5 hover:bg-[#f9fafb] font-medium"
            >
              Abrir en pestaña ↗
            </a>
            <button
              onClick={onClose}
              className="text-xs border border-[#e5e7eb] bg-white px-3 py-1.5 hover:bg-[#f9fafb]"
            >
              Cerrar ×
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-5 overflow-hidden min-h-0">
          {/* PDF — 3 cols */}
          <div className="lg:col-span-3 h-[50vh] lg:h-full border-r border-[#e5e7eb] bg-[#f9fafb] flex flex-col">
            <div className="flex items-center justify-between px-3 py-2 border-b border-[#e5e7eb] text-xs text-[#6b7280] bg-white shrink-0">
              <span>Formulario E-14 · Registraduría Nacional</span>
              <a href={acta.pdfUrl} target="_blank" rel="noopener" className="underline hover:text-[#0a0a0a]">
                {acta.pdfUrl.split("/").slice(-1)[0]}
              </a>
            </div>
            <iframe
              src={acta.pdfUrl}
              className="flex-1 w-full"
              title={`E-14 ${acta.txId}`}
            />
          </div>

          {/* Data — 2 cols */}
          <div className="lg:col-span-2 overflow-auto p-5 space-y-5">
            {/* Candidate votes */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-[#6b7280] uppercase tracking-wide">Votos según E-14</div>
              <div className="border border-[#e5e7eb] divide-y divide-[#e5e7eb]">
                <div className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-xs text-violet-700">IVÁN CEPEDA CASTRO</div>
                    <div className="text-xs text-[#9ca3af]">
                      {totalVotos > 0 && acta.candidato0.votos != null
                        ? `${((acta.candidato0.votos / totalVotos) * 100).toFixed(1)}% de votos válidos`
                        : ""}
                    </div>
                  </div>
                  <div className="font-black tabnum text-2xl text-violet-700">
                    {acta.candidato0.votos != null ? n(acta.candidato0.votos) : "—"}
                  </div>
                </div>
                <div className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-xs text-orange-600">ABELARDO DE LA ESPRIELLA</div>
                    <div className="text-xs text-[#9ca3af]">
                      {totalVotos > 0 && acta.candidato1.votos != null
                        ? `${((acta.candidato1.votos / totalVotos) * 100).toFixed(1)}% de votos válidos`
                        : ""}
                    </div>
                  </div>
                  <div className="font-black tabnum text-2xl text-orange-600">
                    {acta.candidato1.votos != null ? n(acta.candidato1.votos) : "—"}
                  </div>
                </div>
              </div>
              {/* Vote bar */}
              {totalVotos > 0 && (
                <div className="h-2 bg-orange-400 flex">
                  <div
                    className="h-full bg-violet-600"
                    style={{ width: `${((acta.candidato0.votos ?? 0) / totalVotos) * 100}%` }}
                  />
                </div>
              )}
            </div>

            {/* Nivelación */}
            {(acta.nivelacion?.totalVotantesE11 != null || acta.nivelacion?.totalVotosUrna != null) && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-[#6b7280] uppercase tracking-wide">Nivelación E-11</div>
                <div className="grid grid-cols-2 gap-2">
                  {acta.nivelacion.totalVotantesE11 != null && (
                    <div className="border border-[#e5e7eb] p-3">
                      <div className="font-bold tabnum">{n(acta.nivelacion.totalVotantesE11)}</div>
                      <div className="text-xs text-[#9ca3af]">Votantes habilitados (E-11)</div>
                    </div>
                  )}
                  {acta.nivelacion.totalVotosUrna != null && (
                    <div className="border border-[#e5e7eb] p-3">
                      <div className="font-bold tabnum">{n(acta.nivelacion.totalVotosUrna)}</div>
                      <div className="text-xs text-[#9ca3af]">Votos en urna</div>
                    </div>
                  )}
                  {acta.sumaTotal != null && (
                    <div className="border border-[#e5e7eb] p-3 col-span-2">
                      <div className="font-bold tabnum">{n(acta.sumaTotal)}</div>
                      <div className="text-xs text-[#9ca3af]">Suma total declarada</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Irregularities */}
            {allFlags.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-[#6b7280] uppercase tracking-wide">
                  Irregularidades detectadas ({allFlags.length})
                </div>
                <div className="space-y-1.5">
                  {allFlags.map((flag, i) => (
                    <div
                      key={i}
                      className={`text-xs px-3 py-2.5 border leading-relaxed ${sev.bg} ${sev.border} ${sev.text}`}
                    >
                      <span className="font-semibold">{i + 1}.</span> {flag}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Enmiendas detail */}
            {acta.hayEnmiendas && acta.enmiendaDetalle && (
              <div className="border border-yellow-200 bg-yellow-50 p-3 space-y-1">
                <div className="text-xs font-semibold text-yellow-800">Detalle de enmiendas</div>
                <p className="text-xs text-yellow-700 leading-relaxed">{acta.enmiendaDetalle}</p>
              </div>
            )}

            {/* Meta */}
            <div className="border-t border-[#e5e7eb] pt-4 space-y-1 text-xs text-[#9ca3af]">
              <div>Dept {acta.deptCode} · Mun {acta.munCode}</div>
              {acta.processedAt && (
                <div>Procesado: {new Date(acta.processedAt).toLocaleString("es-CO")}</div>
              )}
              <div className="font-mono break-all">{acta.txId}</div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <a
                href={acta.pdfUrl}
                target="_blank"
                rel="noopener"
                className="flex-1 text-center text-xs bg-[#0a0a0a] text-white py-2.5 font-medium hover:bg-[#374151]"
              >
                Descargar PDF original ↗
              </a>
              <a
                href="/auditar"
                className="flex-1 text-center text-xs border border-[#0a0a0a] py-2.5 font-medium hover:bg-[#f9fafb]"
              >
                Auditar manualmente →
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
