"use client";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import type { DeptStat, PreconteoDeptStat } from "@/lib/api";

const GEO_URL = "/colombia-departments.json";

const NAME_TO_DANE: Record<string, string> = {
  amazonas: "91", antioquia: "05", arauca: "81",
  "atlántico": "08", atlantico: "08",
  "bogotá d.c.": "11", "bogota d.c.": "11", "bogotá": "11", bogota: "11",
  "bolívar": "13", bolivar: "13",
  "boyacá": "15", boyaca: "15",
  caldas: "17",
  "caquetá": "18", caqueta: "18",
  casanare: "85", cauca: "19", cesar: "20",
  "chocó": "27", choco: "27",
  "córdoba": "23", cordoba: "23",
  cundinamarca: "25",
  "guainía": "94", guainia: "94",
  guaviare: "95", huila: "41",
  "la guajira": "44",
  magdalena: "47", meta: "50",
  "nariño": "52", narino: "52",
  "norte de santander": "54",
  putumayo: "86",
  "quindío": "63", quindio: "63",
  risaralda: "66",
  "san andrés y providencia": "88", "san andres y providencia": "88",
  santander: "68", sucre: "70", tolima: "73",
  "valle del cauca": "76",
  "vaupés": "97", vaupes: "97",
  vichada: "99",
};

export const DANE_TO_NAME: Record<string, string> = {
  "05": "Antioquia", "08": "Atlántico", "11": "Bogotá D.C.", "13": "Bolívar",
  "15": "Boyacá", "17": "Caldas", "18": "Caquetá", "19": "Cauca", "20": "Cesar",
  "23": "Córdoba", "25": "Cundinamarca", "27": "Chocó", "41": "Huila",
  "44": "La Guajira", "47": "Magdalena", "50": "Meta", "52": "Nariño",
  "54": "Norte de Santander", "63": "Quindío", "66": "Risaralda", "68": "Santander",
  "70": "Sucre", "73": "Tolima", "76": "Valle del Cauca", "81": "Arauca",
  "85": "Casanare", "86": "Putumayo", "88": "San Andrés", "91": "Amazonas",
  "94": "Guainía", "95": "Guaviare", "97": "Vaupés", "99": "Vichada",
};

function getCode(props: Record<string, unknown>): string | null {
  if (typeof props.DPTO === "string") return props.DPTO.padStart(2, "0");
  if (typeof props.DPTO === "number") return String(props.DPTO).padStart(2, "0");
  const raw = String(props.NAME_1 ?? props.NOMBRE_DPT ?? "").toLowerCase().trim();
  return NAME_TO_DANE[raw] ?? null;
}

function coverageColor(pct: number, isSelected: boolean): string {
  if (isSelected) return "#f59e0b";
  if (pct === 0) return "#f3f4f6";
  if (pct < 0.1) return "#d1fae5";
  if (pct < 1) return "#6ee7b7";
  if (pct < 5) return "#34d399";
  if (pct < 20) return "#10b981";
  if (pct < 50) return "#059669";
  return "#047857";
}

function preconteoColor(stat: PreconteoDeptStat | undefined, isSelected: boolean): string {
  if (isSelected) return "#f59e0b";
  if (!stat) return "#e5e7eb";
  const m = stat.margen;
  if (stat.winner === "cepeda") {
    if (m < 2) return "#ddd6fe";
    if (m < 5) return "#a78bfa";
    if (m < 10) return "#7c3aed";
    return "#5b21b6";
  } else {
    if (m < 2) return "#fed7aa";
    if (m < 5) return "#fb923c";
    if (m < 10) return "#ea580c";
    return "#c2410c";
  }
}

interface CoverageProps {
  mode: "coverage";
  stats: DeptStat[];
  selectedDept: string | null;
  onSelect: (code: string, name: string) => void;
}

interface PreconteoProps {
  mode: "preconteo";
  preconteoStats: PreconteoDeptStat[];
  selectedDept: string | null;
  onSelect: (code: string, name: string) => void;
}

type Props = CoverageProps | PreconteoProps;

export default function ColombiaMap(props: Props) {
  const coverageByCode = props.mode === "coverage"
    ? Object.fromEntries(props.stats.map(s => [s.code, s]))
    : {};
  const preconteoByCode = props.mode === "preconteo"
    ? Object.fromEntries(props.preconteoStats.map(s => [s.deptCodigo, s]))
    : {};

  return (
    <ComposableMap
      projection="geoMercator"
      projectionConfig={{ center: [-74.2973, 4.5709], scale: 2100 }}
      style={{ width: "100%", height: "100%" }}
    >
      <Geographies geography={GEO_URL}>
        {({ geographies }: { geographies: import("react-simple-maps").GeoFeature[] }) =>
          geographies.map(geo => {
            const code = getCode(geo.properties);
            const isSelected = code === props.selectedDept;

            let fill: string;
            let stroke: string;
            let strokeWidth: number;

            if (props.mode === "coverage") {
              const stat = code ? coverageByCode[code] : null;
              fill = coverageColor(stat?.pct ?? 0, isSelected);
              stroke = (stat?.severidadAlta ?? 0) > 0 ? "#ef4444" : "#ffffff";
              strokeWidth = (stat?.severidadAlta ?? 0) > 0 ? 1.5 : 0.5;
            } else {
              const stat = code ? preconteoByCode[code] : undefined;
              fill = preconteoColor(stat, isSelected);
              stroke = "#ffffff";
              strokeWidth = 0.7;
            }

            return (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill={fill}
                stroke={stroke}
                strokeWidth={strokeWidth}
                onClick={() => {
                  if (code) {
                    const name = DANE_TO_NAME[code] ?? String(geo.properties["NAME_1"] ?? code);
                    props.onSelect(code, name);
                  }
                }}
                style={{
                  default: { outline: "none", cursor: "pointer" },
                  hover: { fill: "#fbbf24", outline: "none", cursor: "pointer" },
                  pressed: { outline: "none" },
                }}
              />
            );
          })
        }
      </Geographies>
    </ComposableMap>
  );
}
