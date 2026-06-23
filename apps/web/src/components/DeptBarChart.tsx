"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface DeptBarChartProps {
  data: Array<{
    dept: string;
    cand0: number;
    cand1: number;
    name0: string;
    name1: string;
  }>;
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) => {
  if (active && payload?.length) {
    return (
      <div className="bg-white border border-[#e5e7eb] px-3 py-2 text-xs shadow-sm min-w-[160px]">
        <div className="font-semibold text-[#0a0a0a] mb-1.5">{label}</div>
        {payload.map((p) => (
          <div key={p.name} className="flex justify-between gap-4">
            <span style={{ color: p.color }} className="font-medium">
              {p.name.split(" ").slice(0, 2).join(" ")}
            </span>
            <span className="font-bold tabnum">{p.value.toLocaleString("es-CO")}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export function DeptBarChart({ data }: DeptBarChartProps) {
  const name0 = data[0]?.name0 ?? "Candidato 1";
  const name1 = data[0]?.name1 ?? "Candidato 2";

  return (
    <ResponsiveContainer width="100%" height={Math.max(320, data.length * 40)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 0, right: 24, bottom: 0, left: 90 }}
        barCategoryGap={8}
        barGap={3}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={(v) =>
            v >= 1_000_000
              ? `${(v / 1_000_000).toFixed(1)}M`
              : `${Math.round(v / 1_000)}k`
          }
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          dataKey="dept"
          type="category"
          tick={{ fontSize: 11, fill: "#4b5563" }}
          width={88}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="cand0" name={name0} fill="#1d4ed8" radius={0} />
        <Bar dataKey="cand1" name={name1} fill="#b91c1c" radius={0} />
      </BarChart>
    </ResponsiveContainer>
  );
}
