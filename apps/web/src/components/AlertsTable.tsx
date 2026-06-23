"use client";

import { useState } from "react";
import type { AlertItem } from "@/lib/api";
import { api } from "@/lib/api";

const ESTADOS = ["PENDIENTE", "EN_REVISION", "DESCARTADO", "CONFIRMADO", "RECLAMADO"];

const SEV = {
  ALTA: { dot: "#b91c1c", text: "text-[#b91c1c]", label: "Alta" },
  MEDIA: { dot: "#d97706", text: "text-[#d97706]", label: "Media" },
  BAJA: { dot: "#1d4ed8", text: "text-[#1d4ed8]", label: "Baja" },
};

export function AlertsTable({ initial }: { initial: AlertItem[] }) {
  const [alerts, setAlerts] = useState(initial);

  async function cambiarEstado(id: string, estado: string) {
    const updated = await api.updateEstado(id, { estado });
    setAlerts((prev) => prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)));
  }

  if (alerts.length === 0) {
    return (
      <div className="p-10 text-center text-sm text-[#9ca3af]">
        Sin alertas · Ingesta formularios E-14 para ver resultados
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[#f9fafb] border-b border-[#e5e7eb]">
            {["Sev.", "Mesa / Ubicación", "Categoría", "Hallazgo", "Estado", "Cambiar"].map((h) => (
              <th
                key={h}
                className="text-left px-4 py-3 text-xs font-semibold text-[#6b7280] uppercase tracking-wide"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#f3f4f6]">
          {alerts.map((a) => {
            const sev = SEV[a.severity as keyof typeof SEV] ?? SEV.BAJA;
            return (
              <tr key={a.id} className="hover:bg-[#f9fafb] transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: sev.dot }} />
                    <span className={`text-xs font-semibold ${sev.text}`}>{sev.label}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-mono text-xs text-[#9ca3af]">{a.ubicacionKey}</div>
                  <div className="text-xs font-medium text-[#0a0a0a]">{a.municipio}</div>
                  <div className="text-xs text-[#9ca3af]">Mesa {a.mesa}</div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs font-mono text-[#6b7280]">
                    {a.category.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="px-4 py-3 max-w-[280px]">
                  <p className="text-xs text-[#4b5563] leading-relaxed line-clamp-3">{a.message}</p>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs font-medium text-[#6b7280] border border-[#e5e7eb] px-2 py-0.5 whitespace-nowrap">
                    {a.estado.replace("_", " ")}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <select
                    className="text-xs border border-[#e5e7eb] px-2 py-1 bg-white text-[#4b5563] hover:border-[#9ca3af] transition-colors"
                    value={a.estado}
                    onChange={(e) => void cambiarEstado(a.id, e.target.value)}
                  >
                    {ESTADOS.map((e) => (
                      <option key={e} value={e}>{e.replace("_", " ")}</option>
                    ))}
                  </select>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
