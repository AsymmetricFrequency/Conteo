const MAP: Record<string, string> = {
  ALTA: "bg-red-100 text-red-700 border border-red-300",
  MEDIA: "bg-amber-100 text-amber-700 border border-amber-300",
  BAJA: "bg-blue-100 text-blue-700 border border-blue-300",
};

export function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span className={`inline-block text-xs font-semibold rounded px-2 py-0.5 ${MAP[severity] ?? "bg-slate-100 text-slate-600"}`}>
      {severity}
    </span>
  );
}
