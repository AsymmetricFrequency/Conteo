import type { StatsSummary } from "@/lib/api";

export function StatsCards({ stats }: { stats: StatsSummary }) {
  const alta = stats.porSeveridad.find((s) => s.severity === "ALTA")?.count ?? 0;
  const media = stats.porSeveridad.find((s) => s.severity === "MEDIA")?.count ?? 0;
  const baja = stats.porSeveridad.find((s) => s.severity === "BAJA")?.count ?? 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      <Card label="Formularios" value={stats.totalForms} color="slate" />
      <Card label="Reportes" value={stats.totalReports} color="slate" />
      <Card label="Alertas ALTA" value={alta} color="red" />
      <Card label="Alertas MEDIA" value={media} color="amber" />
      <Card label="Alertas BAJA" value={baja} color="blue" />
    </div>
  );
}

function Card({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "slate" | "red" | "amber" | "blue";
}) {
  const cls = {
    slate: "border-slate-200 text-slate-700",
    red: "border-red-200 text-red-700",
    amber: "border-amber-200 text-amber-700",
    blue: "border-blue-200 text-blue-700",
  }[color];

  return (
    <div className={`bg-white rounded-lg border p-4 ${cls}`}>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-xs mt-1 text-slate-500">{label}</p>
    </div>
  );
}
