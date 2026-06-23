"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface VoteDonutProps {
  candidatos: Array<{ nombre: string; vot: number; pct: string }>;
}

const COLORS = ["#1d4ed8", "#b91c1c", "#6b7280", "#9ca3af"];

const CustomTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: { pct: string } }>;
}) => {
  if (active && payload?.length) {
    const entry = payload[0];
    return (
      <div className="bg-white border border-[#e5e7eb] px-3 py-2 text-xs shadow-sm">
        <div className="font-semibold text-[#0a0a0a] truncate max-w-[200px]">
          {entry?.name?.split(" ").slice(0, 3).join(" ")}
        </div>
        <div className="text-[#6b7280] mt-0.5">
          {entry?.value?.toLocaleString("es-CO")} votos · {entry?.payload?.pct}
        </div>
      </div>
    );
  }
  return null;
};

export function VoteDonutChart({ candidatos }: VoteDonutProps) {
  const data = candidatos.map((c) => ({
    name: c.nombre,
    value: c.vot,
    pct: c.pct,
  }));

  const top2 = data.slice(0, 2);

  return (
    <div className="flex flex-col gap-4">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={top2}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={2}
            dataKey="value"
            strokeWidth={1}
            stroke="#ffffff"
          >
            {top2.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Legend below */}
      <div className="flex flex-col gap-2">
        {top2.map((c, i) => (
          <div key={c.name} className="flex items-center gap-3">
            <div
              className="w-3 h-3 rounded-full shrink-0"
              style={{ background: COLORS[i] }}
            />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-[#6b7280] truncate">
                {c.name.split(" ").slice(0, 3).join(" ")}
              </div>
            </div>
            <div className="font-bold text-sm tabnum" style={{ color: COLORS[i] }}>
              {c.pct}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
