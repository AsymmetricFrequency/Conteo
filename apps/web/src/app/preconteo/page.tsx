import { api } from "@/lib/api";
import type { PreconteoSummary, PreconteoMunicipio } from "@/lib/api";
import { DeptBarChart } from "@/components/DeptBarChart";

export const dynamic = "force-dynamic";

function n(v: number) {
  return v.toLocaleString("es-CO");
}

function groupByDept(municipios: PreconteoMunicipio[]) {
  const map = new Map<string, {
    deptNombre: string;
    deptCodigo: string;
    municipios: PreconteoMunicipio[];
    totalSuf: number;
    votosByCandidato: Record<string, { nombre: string; vot: number }>;
  }>();

  for (const m of municipios) {
    if (!map.has(m.deptCodigo)) {
      map.set(m.deptCodigo, { deptNombre: m.deptNombre, deptCodigo: m.deptCodigo, municipios: [], totalSuf: 0, votosByCandidato: {} });
    }
    const d = map.get(m.deptCodigo)!;
    d.municipios.push(m);
    d.totalSuf += m.sufragantes;
    for (const v of m.votos) {
      const prev = d.votosByCandidato[v.cedula] ?? { nombre: v.nombre, vot: 0 };
      prev.vot += v.vot;
      d.votosByCandidato[v.cedula] = prev;
    }
  }
  return [...map.values()].sort((a, b) => b.totalSuf - a.totalSuf);
}

export default async function PreconteoPage() {
  let summary: PreconteoSummary | null = null;
  let municipios: PreconteoMunicipio[] = [];

  const [r0, r1] = await Promise.allSettled([api.preconteo.summary(), api.preconteo.list()]);
  if (r0.status === "fulfilled") summary = r0.value;
  if (r1.status === "fulfilled") municipios = r1.value;

  const depts = groupByDept(municipios);
  const topCedulas = summary?.candidatos.slice().sort((a, b) => b.vot - a.vot).slice(0, 2).map((c) => c.cedula) ?? [];
  const ced0 = topCedulas[0] ?? "";
  const ced1 = topCedulas[1] ?? "";
  const name0 = summary?.candidatos.find((c) => c.cedula === ced0)?.nombre ?? "Candidato 1";
  const name1 = summary?.candidatos.find((c) => c.cedula === ced1)?.nombre ?? "Candidato 2";
  const sorted = summary?.candidatos.slice().sort((a, b) => b.vot - a.vot) ?? [];

  const chartData = depts.slice(0, 15).map((d) => ({
    dept: d.deptNombre.length > 16 ? d.deptNombre.slice(0, 16) + "…" : d.deptNombre,
    cand0: d.votosByCandidato[ced0]?.vot ?? 0,
    cand1: d.votosByCandidato[ced1]?.vot ?? 0,
    name0,
    name1,
  }));

  return (
    <div className="space-y-10">
      {/* Page title */}
      <div className="border-b border-[#e5e7eb] pb-6">
        <div className="text-xs font-semibold text-[#9ca3af] uppercase tracking-widest mb-2">
          Preconteo · Registraduría Nacional
        </div>
        <h1 className="text-3xl font-black text-[#0a0a0a] leading-tight">
          Resultados por municipio
        </h1>
        <p className="text-sm text-[#6b7280] mt-2 max-w-xl">
          El E-14 oficial prevalece sobre el preconteo en caso de discrepancia. Estos datos son el
          preconteo preliminar de la Registraduría.
        </p>
      </div>

      {/* National summary — two panels like C40 */}
      {summary ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 border border-[#e5e7eb]">
          {/* Left: vote totals */}
          <div className="p-6 border-b lg:border-b-0 lg:border-r border-[#e5e7eb] space-y-4">
            <div className="text-xs font-semibold text-[#9ca3af] uppercase tracking-widest">
              Totales nacionales
            </div>

            {sorted.slice(0, 2).map((c, i) => (
              <div key={c.cedula} className="flex items-center gap-4">
                <div
                  className="w-1 self-stretch shrink-0"
                  style={{ background: i === 0 ? "#1d4ed8" : "#b91c1c" }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-[#6b7280] truncate">{c.nombre}</div>
                  <div className="flex items-baseline gap-3 mt-0.5">
                    <span
                      className="font-black text-3xl tabnum"
                      style={{ color: i === 0 ? "#1d4ed8" : "#b91c1c" }}
                    >
                      {c.pct}
                    </span>
                    <span className="text-sm text-[#6b7280] tabnum">{n(c.vot)} votos</span>
                  </div>
                  <div className="h-1 bg-[#f3f4f6] mt-2">
                    <div
                      className="h-full"
                      style={{
                        width: c.pct,
                        background: i === 0 ? "#1d4ed8" : "#b91c1c",
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Right: stats grid */}
          <div className="grid grid-cols-2 divide-x divide-y divide-[#e5e7eb]">
            {[
              { label: "Sufragantes", value: n(summary.sufragantes) },
              { label: "Municipios", value: n(summary.municipios) },
              { label: "Mesas total", value: n(summary.mesas.total) },
              { label: "Mesas escrutadas", value: n(summary.mesas.escrutadas) },
            ].map(({ label, value }) => (
              <div key={label} className="p-6">
                <div className="font-bold text-xl tabnum">{value}</div>
                <div className="text-xs text-[#9ca3af] mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="border border-[#fde68a] bg-[#fffbeb] p-4 text-sm text-[#92400e]">
          API no disponible
        </div>
      )}

      {/* Bar chart */}
      {chartData.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#0a0a0a]">Votos por departamento · Top 15</h2>
            <div className="flex items-center gap-4 text-xs text-[#6b7280]">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-2 inline-block" style={{ background: "#1d4ed8" }} />
                {name0.split(" ").slice(0, 2).join(" ")}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-2 inline-block" style={{ background: "#b91c1c" }} />
                {name1.split(" ").slice(0, 2).join(" ")}
              </span>
            </div>
          </div>
          <div className="border border-[#e5e7eb] p-4">
            <DeptBarChart data={chartData} />
          </div>
        </div>
      )}

      {/* Dept accordion */}
      <div className="space-y-2">
        <h2 className="text-lg font-bold text-[#0a0a0a]">Por departamento</h2>
        {depts.length === 0 ? (
          <div className="border border-[#e5e7eb] p-8 text-center text-sm text-[#9ca3af]">
            Sin datos de municipios cargados
          </div>
        ) : (
          depts.map((dept) => {
            const v0 = dept.votosByCandidato[ced0]?.vot ?? 0;
            const v1 = dept.votosByCandidato[ced1]?.vot ?? 0;
            const winner = v0 > v1 ? "#1d4ed8" : v1 > v0 ? "#b91c1c" : "#9ca3af";
            return (
              <details key={dept.deptCodigo} className="group border border-[#e5e7eb]">
                <summary className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-[#f9fafb] transition-colors select-none list-none">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: winner }} />
                  <span className="font-semibold text-sm flex-1 text-[#0a0a0a]">{dept.deptNombre}</span>
                  <span className="text-xs text-[#9ca3af] hidden sm:block">
                    {n(dept.municipios.length)} municipios
                  </span>
                  <div className="flex gap-4 text-sm font-bold tabnum">
                    <span style={{ color: "#1d4ed8" }}>{n(v0)}</span>
                    <span className="text-[#e5e7eb]">·</span>
                    <span style={{ color: "#b91c1c" }}>{n(v1)}</span>
                  </div>
                  <span className="text-[#9ca3af] text-xs group-open:rotate-90 transition-transform">▸</span>
                </summary>

                <div className="border-t border-[#e5e7eb] overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#f9fafb] border-b border-[#e5e7eb]">
                        {["Municipio", "Cand. 1", "Cand. 2", "Sufragantes", "Mesas"].map((h) => (
                          <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-[#6b7280] uppercase tracking-wide">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f3f4f6]">
                      {dept.municipios.map((m) => {
                        const mv0 = m.votos.find((v) => v.cedula === ced0)?.vot ?? 0;
                        const mv1 = m.votos.find((v) => v.cedula === ced1)?.vot ?? 0;
                        return (
                          <tr key={m.munCodigo} className="hover:bg-[#f9fafb] transition-colors">
                            <td className="px-4 py-2.5 font-medium text-[#0a0a0a] text-xs">{m.munNombre}</td>
                            <td className="px-4 py-2.5 font-bold tabnum text-sm" style={{ color: "#1d4ed8" }}>{n(mv0)}</td>
                            <td className="px-4 py-2.5 font-bold tabnum text-sm" style={{ color: "#b91c1c" }}>{n(mv1)}</td>
                            <td className="px-4 py-2.5 tabnum text-sm text-[#6b7280]">{n(m.sufragantes)}</td>
                            <td className="px-4 py-2.5 text-xs text-[#9ca3af] tabnum">{n(m.mesas.escrutadas)}/{n(m.mesas.total)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </details>
            );
          })
        )}
      </div>
    </div>
  );
}
