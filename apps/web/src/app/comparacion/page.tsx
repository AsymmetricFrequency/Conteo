import { api } from "@/lib/api";
import type { E14Comparacion } from "@/lib/api";

export const dynamic = "force-dynamic";

function n(v: number) { return v.toLocaleString("es-CO"); }
function pct(v: number) { return `${v.toFixed(1)}%`; }

const ALERTA = {
  ALTA:  { bg: "#fef2f2", border: "#fca5a5", text: "#b91c1c", dot: "#dc2626", label: "Diferencia alta ≥10pp" },
  MEDIA: { bg: "#fffbeb", border: "#fde68a", text: "#92400e", dot: "#d97706", label: "Diferencia media ≥5pp" },
  BAJA:  { bg: "#eff6ff", border: "#bfdbfe", text: "#1e40af", dot: "#2563eb", label: "Diferencia baja ≥3pp"  },
  OK:    { bg: "#f0fdf4", border: "#bbf7d0", text: "#166534", dot: "#16a34a", label: "Dentro del margen"     },
};

// Barra horizontal comparativa (preconteo vs E14)
function BarraComparativa({
  pctPre, pctE14, label,
}: { pctPre: number; pctE14: number; label: string }) {
  const diff = pctPre - pctE14;
  const abs = Math.abs(diff);
  return (
    <div className="flex items-center gap-3 text-xs">
      <div className="w-28 text-right text-[#6b7280] shrink-0">{label}</div>
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-1.5">
          <div className="w-12 text-right tabnum text-[#6b7280]">{pct(pctPre)}</div>
          <div className="flex-1 h-2 bg-[#f3f4f6]">
            <div className="h-full bg-[#6b7280]" style={{ width: `${pctPre}%` }} />
          </div>
          <span className="text-[#9ca3af] text-xs">Preconteo</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`w-12 text-right tabnum font-bold ${abs >= 5 ? "text-[#b91c1c]" : "text-[#1d4ed8]"}`}>
            {pct(pctE14)}
          </div>
          <div className="flex-1 h-2 bg-[#f3f4f6]">
            <div
              className="h-full"
              style={{ width: `${pctE14}%`, background: abs >= 5 ? "#b91c1c" : "#1d4ed8" }}
            />
          </div>
          <span className={`text-xs font-semibold ${abs >= 5 ? "text-[#b91c1c]" : "text-[#1d4ed8]"}`}>
            E-14 {diff > 0 ? "−" : "+"}{abs.toFixed(1)}pp
          </span>
        </div>
      </div>
    </div>
  );
}

function MunicipioCard({ m }: { m: E14Comparacion["municipios"][0] }) {
  const alerta = ALERTA[m.alertaNivel];
  const absDiff = Math.abs(m.diferenciaPct);
  const favoreceA = m.diferenciaPct < 0
    ? "E-14 DELEGADOS favorece a De la Espriella vs preconteo"
    : "E-14 DELEGADOS favorece a Cepeda vs preconteo";

  return (
    <details
      className="group border"
      style={{ borderColor: alerta.border, background: alerta.bg }}
    >
      <summary className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:brightness-95 transition-all select-none list-none">
        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: alerta.dot }} />
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm" style={{ color: alerta.text }}>{m.munNombre}</div>
          <div className="text-xs mt-0.5" style={{ color: alerta.text }}>
            {m.deptNombre} · {m.mesasConE14} mesa{m.mesasConE14 !== 1 ? "s" : ""} auditadas de {n(m.mesasTotalMunicipio)} totales
          </div>
        </div>

        {/* Cepeda % comparison */}
        <div className="hidden sm:flex flex-col items-end gap-0.5 shrink-0">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[#6b7280]">Preconteo:</span>
            <span className="font-bold tabnum text-[#1d4ed8]">{pct(m.preconteo.pctCepeda)}</span>
            <span className="text-[#9ca3af]">Cepeda</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[#6b7280]">E-14 DEL:</span>
            <span className={`font-bold tabnum ${absDiff >= 5 ? "text-[#b91c1c]" : "text-[#1d4ed8]"}`}>
              {pct(m.e14Delegados.pctCepeda)}
            </span>
            <span style={{ color: alerta.dot }} className="font-semibold">
              Δ {absDiff.toFixed(1)}pp
            </span>
          </div>
        </div>

        <span className="text-[#9ca3af] text-xs group-open:rotate-90 transition-transform shrink-0">▸</span>
      </summary>

      <div className="border-t px-5 py-4 space-y-4" style={{ borderColor: alerta.border }}>
        {/* Alerta y explicación */}
        <div className="text-xs p-3 border" style={{ borderColor: alerta.border, background: "rgba(255,255,255,0.5)" }}>
          <span className="font-semibold" style={{ color: alerta.text }}>
            {alerta.label} ({absDiff.toFixed(1)}pp):
          </span>
          <span className="ml-1" style={{ color: alerta.text }}>{favoreceA}</span>
          {absDiff >= 5 && (
            <div className="mt-1 text-[#6b7280]">
              Nota: la muestra es {m.mesasConE14}/{m.mesasTotalMunicipio} mesas — diferencia puede ser aleatoria.
              Requiere comparar copia CLAVEROS vs DELEGADOS para cada acta.
            </div>
          )}
        </div>

        {/* Barras comparativas */}
        <div className="space-y-3">
          <BarraComparativa
            pctPre={m.preconteo.pctCepeda}
            pctE14={m.e14Delegados.pctCepeda}
            label="Iván Cepeda"
          />
          <BarraComparativa
            pctPre={m.preconteo.pctEspriella}
            pctE14={m.e14Delegados.pctEspriella}
            label="De la Espriella"
          />
        </div>

        {/* Actas detalle */}
        <div>
          <div className="text-xs font-semibold text-[#6b7280] uppercase tracking-wide mb-2">
            Actas E-14 analizadas
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-white/60 border-b" style={{ borderColor: alerta.border }}>
                  {["Tipo", "Zona · Puesto · Mesa", "Cepeda", "De la Espriella", "Total acta", "Irregularidad", "PDF"].map((h) => (
                    <th key={h} className="text-left px-3 py-2 font-semibold text-[#6b7280] uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: alerta.border }}>
                {m.actas.map((a) => (
                  <tr key={a.txId} className="hover:bg-white/40 transition-all">
                    <td className="px-3 py-2">
                      <span
                        className="font-semibold px-1.5 py-0.5 border text-xs"
                        style={{ borderColor: alerta.border, color: alerta.text }}
                      >
                        {a.tipoCopia}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-[#4b5563]">
                      Z{a.zona}·P{a.stand}·M{a.mesa}
                    </td>
                    <td className="px-3 py-2 font-bold tabnum text-[#1d4ed8]">
                      {a.cepedaVotos ?? "—"}
                    </td>
                    <td className="px-3 py-2 font-bold tabnum text-[#b91c1c]">
                      {a.espriellaVotos ?? "—"}
                    </td>
                    <td className="px-3 py-2 tabnum text-[#6b7280]">{n(a.totalVotosActa)}</td>
                    <td className="px-3 py-2">
                      {a.hayIrregularidades ? (
                        <span className="text-xs font-semibold text-[#b91c1c]">
                          ⚠ {a.fraudSeverity}
                        </span>
                      ) : (
                        <span className="text-[#d1d5db]">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <a
                        href={a.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs underline text-[#1d4ed8] hover:text-[#1e40af] transition-colors"
                      >
                        Ver PDF ↗
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </details>
  );
}

export default async function ComparacionPage() {
  let data: E14Comparacion | null = null;
  try {
    data = await api.e14.comparacion();
  } catch { /* offline */ }

  const alta = data?.municipios.filter((m) => m.alertaNivel === "ALTA") ?? [];
  const media = data?.municipios.filter((m) => m.alertaNivel === "MEDIA") ?? [];
  const baja = data?.municipios.filter((m) => m.alertaNivel === "BAJA") ?? [];
  const ok = data?.municipios.filter((m) => m.alertaNivel === "OK") ?? [];

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="border-b border-[#e5e7eb] pb-6">
        <div className="text-xs font-semibold text-[#9ca3af] uppercase tracking-widest mb-2">
          Auditoría documental · Sin tokens de AI
        </div>
        <h1 className="text-3xl font-black text-[#0a0a0a] leading-tight">
          E-14 DELEGADOS vs Preconteo
        </h1>
        <p className="text-sm text-[#6b7280] mt-2 max-w-2xl">
          Comparación automática entre los votos en los formularios E-14 (copia DELEGADOS descargada
          de la Registraduría) y el preconteo oficial por municipio. Las diferencias significativas
          indican mesas que requieren confrontar la copia CLAVEROS.
        </p>
      </div>

      {/* Metodología */}
      <div className="border border-[#e5e7eb] p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <div className="text-xs font-semibold text-[#0a0a0a] mb-1">¿Por qué DELEGADOS vs Preconteo?</div>
          <p className="text-xs text-[#6b7280] leading-relaxed">
            El fraude detectado en Twitter consiste en alterar la copia DELEGADOS. Comparar con el
            preconteo municipal revela municipios donde los DELEGADOS muestran resultados
            sistemáticamente distintos al conteo general.
          </p>
        </div>
        <div>
          <div className="text-xs font-semibold text-[#0a0a0a] mb-1">Limitación de la muestra</div>
          <p className="text-xs text-[#6b7280] leading-relaxed">
            Solo tenemos OCR de unas pocas mesas por municipio. Una diferencia en 1-3 mesas puede
            ser aleatoria. La señal es más fuerte cuando hay 10+ mesas y la diferencia supera 5pp.
          </p>
        </div>
        <div>
          <div className="text-xs font-semibold text-[#0a0a0a] mb-1">Próximo paso: CLAVEROS</div>
          <p className="text-xs text-[#6b7280] leading-relaxed">
            Para confirmar fraude, hay que comparar la copia CLAVEROS con la DELEGADOS de la misma
            mesa. Si difieren → fraude confirmado. Los PDFs están en el portal de la Registraduría.
          </p>
        </div>
      </div>

      {!data && (
        <div className="border border-[#fde68a] bg-[#fffbeb] p-5 text-sm text-[#92400e]">
          API no disponible — reinicia con <code className="font-mono bg-[#fef3c7] px-1">pnpm --filter api dev</code>
        </div>
      )}

      {data && (
        <>
          {/* Resumen */}
          <div className="grid grid-cols-2 sm:grid-cols-4 border border-[#e5e7eb] divide-x divide-[#e5e7eb]">
            {[
              { label: "Actas analizadas", value: data.totalActas, color: "#0a0a0a" },
              { label: "Municipios", value: data.municipios.length, color: "#0a0a0a" },
              { label: "Diferencia ALTA", value: alta.length, color: alta.length > 0 ? "#b91c1c" : "#6b7280" },
              { label: "Diferencia MEDIA", value: media.length, color: media.length > 0 ? "#d97706" : "#6b7280" },
            ].map(({ label, value, color }) => (
              <div key={label} className="p-5">
                <div className="font-bold text-2xl tabnum" style={{ color }}>{value}</div>
                <div className="text-xs text-[#9ca3af] mt-0.5">{label}</div>
              </div>
            ))}
          </div>

          {/* Municipios por nivel de alerta */}
          {alta.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[#dc2626]" />
                <h2 className="text-base font-bold text-[#0a0a0a]">
                  Diferencia alta ≥10pp · {alta.length} municipio{alta.length !== 1 ? "s" : ""}
                </h2>
              </div>
              {alta.map((m) => <MunicipioCard key={m.munCode} m={m} />)}
            </section>
          )}

          {media.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[#d97706]" />
                <h2 className="text-base font-bold text-[#0a0a0a]">
                  Diferencia media ≥5pp · {media.length} municipio{media.length !== 1 ? "s" : ""}
                </h2>
              </div>
              {media.map((m) => <MunicipioCard key={m.munCode} m={m} />)}
            </section>
          )}

          {baja.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[#2563eb]" />
                <h2 className="text-base font-bold text-[#0a0a0a]">
                  Diferencia baja ≥3pp · {baja.length} municipio{baja.length !== 1 ? "s" : ""}
                </h2>
              </div>
              {baja.map((m) => <MunicipioCard key={m.munCode} m={m} />)}
            </section>
          )}

          {ok.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[#16a34a]" />
                <h2 className="text-base font-bold text-[#0a0a0a]">
                  Sin diferencia significativa · {ok.length} municipio{ok.length !== 1 ? "s" : ""}
                </h2>
              </div>
              {ok.map((m) => <MunicipioCard key={m.munCode} m={m} />)}
            </section>
          )}

          {data.municipios.length === 0 && (
            <div className="border border-[#e5e7eb] p-12 text-center text-sm text-[#9ca3af]">
              Sin actas procesadas todavía · ejecuta el pipeline para comenzar el análisis
            </div>
          )}
        </>
      )}

      <p className="text-xs text-[#9ca3af] border-t border-[#e5e7eb] pt-4">
        El E-14 prevalece sobre el preconteo. Esta comparación es un insumo de investigación, no un
        veredicto. La confirmación requiere revisión humana del acta física.
      </p>
    </div>
  );
}
