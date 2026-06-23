import { api } from "@/lib/api";
import type { PreconteoSummary, E14PipelineStats, E14RecentActa } from "@/lib/api";
import Link from "next/link";
import { VoteDonutChart } from "@/components/VoteDonutChart";

export const dynamic = "force-dynamic";

function n(v: number) {
  return v.toLocaleString("es-CO");
}

// ─── Candidate panel — one column, full bleed color strip ─────────────────────
function CandidatePanel({
  nombre,
  votos,
  pct,
  rank,
  color,
}: {
  nombre: string;
  votos: number;
  pct: string;
  rank: 1 | 2;
  color: "blue" | "red";
}) {
  const pctNum = parseFloat(pct);
  const nombres = nombre.split(" / ");
  const presidente = nombres[0] ?? nombre;
  const vice = nombres[1];
  const accent = color === "blue" ? "#1d4ed8" : "#b91c1c";
  const bg = color === "blue" ? "#eff6ff" : "#fef2f2";

  return (
    <div className="flex flex-col border border-[#e5e7eb]">
      {/* Color strip at top */}
      <div style={{ height: 4, background: accent }} />

      <div className="p-6 flex-1 flex flex-col gap-4" style={{ background: bg }}>
        {/* Rank tag */}
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-bold px-2 py-0.5"
            style={{ background: accent, color: "white" }}
          >
            #{rank}
          </span>
          <span className="text-xs text-[#6b7280] font-medium">
            {color === "blue" ? "Pacto por Colombia" : "Colombia Humana"}
          </span>
        </div>

        {/* Name */}
        <div>
          <div className="font-bold text-lg leading-tight text-[#0a0a0a]">{presidente}</div>
          {vice && <div className="text-sm text-[#6b7280] mt-0.5">{vice}</div>}
        </div>

        {/* Big percentage */}
        <div className="font-black tabnum" style={{ fontSize: 56, lineHeight: 1, color: accent }}>
          {pct}
        </div>

        {/* Votes */}
        <div className="text-sm font-medium text-[#4b5563] tabnum">{n(votos)} votos</div>

        {/* Progress bar */}
        <div>
          <div
            className="h-1.5"
            style={{ background: "#e5e7eb" }}
          >
            <div
              className="h-full"
              style={{ width: `${pctNum}%`, background: accent }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Pipeline bar ─────────────────────────────────────────────────────────────
function PipelineBar({ stats }: { stats: E14PipelineStats }) {
  const pct = stats.total > 0 ? (stats.ocr_done / stats.total) * 100 : 0;
  return (
    <div className="border border-[#e5e7eb] p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-semibold text-sm text-[#0a0a0a]">Pipeline OCR · Actas E-14</div>
          <div className="text-xs text-[#6b7280] mt-0.5">
            {n(stats.ocr_done)} de {n(stats.total)} actas procesadas
          </div>
        </div>
        <div className="font-black tabnum text-2xl text-[#0a0a0a]">{pct.toFixed(2)}%</div>
      </div>

      {/* Thin progress line */}
      <div className="h-1 bg-[#f3f4f6]">
        <div
          className="h-full bg-[#16a34a]"
          style={{ width: `${Math.max(pct, 0.2)}%` }}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total", value: stats.total },
          { label: "Pendientes", value: stats.pending },
          { label: "OCR listo", value: stats.ocr_done, accent: "#16a34a" },
          { label: "Errores", value: stats.error, accent: "#b91c1c" },
        ].map(({ label, value, accent }) => (
          <div key={label}>
            <div
              className="font-bold text-xl tabnum"
              style={{ color: accent ?? "#0a0a0a" }}
            >
              {n(value)}
            </div>
            <div className="text-xs text-[#9ca3af] mt-0.5">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Recent actas table ───────────────────────────────────────────────────────
function RecentActas({ actas }: { actas: E14RecentActa[] }) {
  if (actas.length === 0) {
    return (
      <div className="border border-[#e5e7eb] p-10 text-center text-sm text-[#9ca3af]">
        Sin actas procesadas aún ·{" "}
        <code className="text-xs font-mono bg-[#f3f4f6] px-1.5 py-0.5">
          pipeline-e14.ts run 10
        </code>
      </div>
    );
  }

  return (
    <div className="border border-[#e5e7eb] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#e5e7eb] bg-[#f9fafb]">
              {["Mesa", "Municipio / Departamento", "Cand. 1", "Cand. 2", "Sufragantes", "Obs."].map(
                (h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 text-xs font-semibold text-[#6b7280] uppercase tracking-wide"
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f3f4f6]">
            {actas.map((acta) => {
              const ocr = acta.ocrResult;
              const c0 = ocr?.candidatos[0];
              const c1 = ocr?.candidatos[1];
              return (
                <tr key={acta.id} className="hover:bg-[#f9fafb] transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-[#6b7280]">
                    {ocr?.mesa ?? acta.mesa}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-[#0a0a0a] text-xs">
                      {ocr?.municipio ?? `Mun ${acta.munCode}`}
                    </div>
                    <div className="text-xs text-[#9ca3af]">
                      {ocr?.departamento ?? acta.deptCode}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {c0 ? (
                      <>
                        <div className="text-xs text-[#9ca3af] truncate max-w-[100px]">
                          {c0.nombre.split(" ").slice(0, 2).join(" ")}
                        </div>
                        <div className="font-bold tabnum" style={{ color: "#1d4ed8" }}>
                          {c0.votos ?? "—"}
                        </div>
                      </>
                    ) : (
                      <span className="text-[#d1d5db]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {c1 ? (
                      <>
                        <div className="text-xs text-[#9ca3af] truncate max-w-[100px]">
                          {c1.nombre.split(" ").slice(0, 2).join(" ")}
                        </div>
                        <div className="font-bold tabnum" style={{ color: "#b91c1c" }}>
                          {c1.votos ?? "—"}
                        </div>
                      </>
                    ) : (
                      <span className="text-[#d1d5db]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 tabnum font-medium text-[#0a0a0a]">
                    {ocr?.totalSufragantes != null ? n(ocr.totalSufragantes) : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#6b7280] max-w-[160px] truncate">
                    {ocr?.observaciones || <span className="text-[#d1d5db]">—</span>}
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
export default async function Home() {
  let preconteo: PreconteoSummary | null = null;
  let e14stats: E14PipelineStats | null = null;
  let recentActas: E14RecentActa[] = [];

  const [r0, r1, r2] = await Promise.allSettled([
    api.preconteo.summary(),
    api.e14.stats(),
    api.e14.recent(10),
  ]);
  if (r0.status === "fulfilled") preconteo = r0.value;
  if (r1.status === "fulfilled") e14stats = r1.value;
  if (r2.status === "fulfilled") recentActas = r2.value;

  const sorted = [...(preconteo?.candidatos ?? [])].sort((a, b) => b.vot - a.vot);
  const cand0 = sorted[0];
  const cand1 = sorted[1];
  const totalVotos = sorted.reduce((s, c) => s + c.vot, 0);

  return (
    <div className="space-y-12">
      {/* Hero — C40 style: two column, colored left block */}
      <section className="grid grid-cols-1 lg:grid-cols-2 border border-[#e5e7eb]">
        {/* Left: title block */}
        <div className="p-8 lg:p-10 flex flex-col justify-between gap-8 bg-[#f8f8f6] border-b lg:border-b-0 lg:border-r border-[#e5e7eb]">
          <div className="space-y-3">
            <div className="text-xs font-semibold text-[#9ca3af] uppercase tracking-widest">
              Auditoría Electoral Ciudadana · Segunda Vuelta
            </div>
            <h1 className="text-3xl font-black leading-tight text-[#0a0a0a]">
              Resultados Presidenciales
              <br />
              Colombia 2026
            </h1>
            <p className="text-sm text-[#4b5563] leading-relaxed max-w-sm">
              Verificación mesa por mesa de los formularios E-14 oficiales publicados por la
              Registraduría Nacional del Estado Civil.
            </p>
          </div>

          {preconteo && (
            <div className="grid grid-cols-3 gap-4 border-t border-[#e5e7eb] pt-6">
              <div>
                <div className="font-black text-xl tabnum">{n(preconteo.sufragantes)}</div>
                <div className="text-xs text-[#9ca3af] mt-0.5">Sufragantes</div>
              </div>
              <div>
                <div className="font-black text-xl tabnum">{n(preconteo.municipios)}</div>
                <div className="text-xs text-[#9ca3af] mt-0.5">Municipios</div>
              </div>
              <div>
                <div className="font-black text-xl tabnum">{n(preconteo.mesas.total)}</div>
                <div className="text-xs text-[#9ca3af] mt-0.5">Mesas totales</div>
              </div>
            </div>
          )}
        </div>

        {/* Right: donut chart */}
        <div className="p-8 lg:p-10 flex flex-col gap-4">
          <div className="text-xs font-semibold text-[#9ca3af] uppercase tracking-widest">
            Distribución de votos · Preconteo
          </div>
          {preconteo && sorted.length > 0 ? (
            <VoteDonutChart candidatos={sorted} />
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-[#9ca3af]">
              API no disponible
            </div>
          )}
        </div>
      </section>

      {/* Candidate cards */}
      {preconteo && cand0 && cand1 ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#0a0a0a]">Resultados por candidato</h2>
            <Link href="/preconteo" className="text-xs font-medium text-[#1d4ed8] hover:underline">
              Ver por municipio →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <CandidatePanel
              nombre={cand0.nombre}
              votos={cand0.vot}
              pct={cand0.pct}
              rank={1}
              color="blue"
            />
            <CandidatePanel
              nombre={cand1.nombre}
              votos={cand1.vot}
              pct={cand1.pct}
              rank={2}
              color="red"
            />
          </div>

          {/* Total row */}
          <div className="border border-[#e5e7eb] grid grid-cols-3 divide-x divide-[#e5e7eb]">
            {[
              { label: "Total votos válidos", value: n(totalVotos) },
              {
                label: "Mesas escrutadas",
                value: `${n(preconteo.mesas.escrutadas)} / ${n(preconteo.mesas.total)}`,
              },
              {
                label: "Participación",
                value: `${((preconteo.mesas.escrutadas / Math.max(preconteo.mesas.total, 1)) * 100).toFixed(1)}%`,
              },
            ].map(({ label, value }) => (
              <div key={label} className="px-5 py-4 text-center">
                <div className="font-bold tabnum text-base">{value}</div>
                <div className="text-xs text-[#9ca3af] mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <div className="border border-[#fde68a] bg-[#fffbeb] p-4 text-sm text-[#92400e]">
          API de preconteo no disponible ·{" "}
          <code className="font-mono text-xs">localhost:3001</code>
        </div>
      )}

      {/* Pipeline */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#0a0a0a]">Pipeline de auditoría E-14</h2>
          <Link href="/e14" className="text-xs font-medium text-[#1d4ed8] hover:underline">
            Ver actas procesadas →
          </Link>
        </div>

        {e14stats ? (
          <PipelineBar stats={e14stats} />
        ) : (
          <div className="border border-[#e5e7eb] p-6 text-sm text-[#9ca3af]">
            E-14 Stats no disponible · reinicia la API con{" "}
            <code className="font-mono text-xs bg-[#f3f4f6] px-1">pnpm --filter api start:dev</code>
          </div>
        )}
      </section>

      {/* Recent actas */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#0a0a0a]">Últimas actas E-14 procesadas</h2>
          <Link href="/e14" className="text-xs font-medium text-[#1d4ed8] hover:underline">
            Ver todas →
          </Link>
        </div>
        <RecentActas actas={recentActas} />
      </section>
    </div>
  );
}
