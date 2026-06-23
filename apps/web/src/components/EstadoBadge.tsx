const MAP: Record<string, string> = {
  PENDIENTE: "bg-slate-100 text-slate-600",
  EN_REVISION: "bg-yellow-100 text-yellow-700",
  DESCARTADO: "bg-slate-200 text-slate-500 line-through",
  CONFIRMADO: "bg-red-100 text-red-700",
  RECLAMADO: "bg-purple-100 text-purple-700",
};

export function EstadoBadge({ estado }: { estado: string }) {
  return (
    <span className={`inline-block text-xs rounded px-2 py-0.5 ${MAP[estado] ?? "bg-slate-100"}`}>
      {estado.replace("_", " ")}
    </span>
  );
}
