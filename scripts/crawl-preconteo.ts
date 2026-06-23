/**
 * Crawl completo del preconteo presidencial 2026 - Segunda vuelta.
 * Itera los 1,189 municipios usando el nomenclator oficial e
 * intercepta las respuestas JSON del portal de la Registraduría.
 *
 * Uso: pnpm tsx scripts/crawl-preconteo.ts [--limit N] [--out /path/out.jsonl]
 *
 * Datos guardados por municipio:
 *   { code, nombre, dept, votos: [{ codcan, cedula, nombre, vot }], totales, capturedAt }
 */
import { chromium, type Page } from "playwright";
import { writeFileSync, appendFileSync, existsSync } from "node:fs";
import { readFileSync } from "node:fs";

const BASE = "https://resultados.registraduria.gov.co";
const ELECTION_SIGLAS = "PR";

interface Municipio {
  i: number;
  n: string;
  co: string;
  dept: string;
  deptCode: string;
}

interface CandidatoResult {
  codcan: string;
  cedula: string;
  nombre: string;
  vot: number;
  pvot: string;
}

interface MunicipioResult {
  code: string;
  nombre: string;
  deptCode: string;
  dept: string;
  mesas: {
    total: number;
    escrutadas: number;
    pct: string;
  };
  sufragantes: number;
  votos: CandidatoResult[];
  votnul: number;
  votblan: number;
  capturedAt: string;
  numact: string;
}

// Parsear args
const args = process.argv.slice(2);
const limitIdx = args.indexOf("--limit");
const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : Infinity;
const outIdx = args.indexOf("--out");
const outFile = outIdx >= 0 ? args[outIdx + 1] : "/tmp/preconteo-resultados.jsonl";

function parseVotes(v: string): number {
  return Number(v.replace(/\./g, "").replace(",", ".")) || 0;
}

async function fetchAct(page: Page, code: string): Promise<unknown> {
  return page.evaluate(
    async ([base, siglas, co]) => {
      const url = `${base}/v2/json/ACT/${siglas}/${co}.json`;
      const res = await fetch(url, {
        headers: { Accept: "application/json, */*", "Cache-Control": "no-cache" },
      });
      if (!res.ok) return null;
      return res.json();
    },
    [BASE, ELECTION_SIGLAS, code] as const
  );
}

function extractResults(data: unknown, mun: Municipio): MunicipioResult | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;

  const totales = (d.totales as Record<string, unknown>)?.act as Record<string, string> | undefined;
  if (!totales) return null;

  const camaras = d.camaras as Array<Record<string, unknown>> | undefined;
  const cam0 = camaras?.[0];
  const partotabla = cam0?.partotabla as Array<Record<string, unknown>> | undefined;

  const candidatos: CandidatoResult[] = [];
  if (partotabla) {
    for (const partido of partotabla) {
      const act = partido.act as Record<string, unknown> | undefined;
      const cantotabla = act?.cantotabla as Array<Record<string, string>> | undefined;
      if (cantotabla) {
        for (const c of cantotabla) {
          candidatos.push({
            codcan: c.codcan ?? "",
            cedula: c.cedula ?? "",
            nombre: `${c.nomcan ?? ""} ${c.apecan ?? ""}`.trim(),
            vot: parseVotes(c.vot ?? "0"),
            pvot: c.pvot ?? "",
          });
        }
      }
    }
  }

  return {
    code: mun.co,
    nombre: mun.n,
    deptCode: mun.deptCode,
    dept: mun.dept,
    mesas: {
      total: parseVotes(totales.metota ?? "0"),
      escrutadas: parseVotes(totales.mesesc ?? "0"),
      pct: totales.pmesesc ?? "",
    },
    sufragantes: parseVotes(totales.votant ?? "0"),
    votos: candidatos,
    votnul: parseVotes(totales.votnul ?? "0"),
    votblan: parseVotes(totales.votblan ?? "0"),
    capturedAt: new Date().toISOString(),
    numact: String(d.numact ?? ""),
  };
}

async function main() {
  // Cargar el nomenclator
  let nominatorPath = "/tmp/nomenclator.json";
  if (!existsSync(nominatorPath)) {
    console.error("ERROR: /tmp/nomenclator.json no existe. Ejecuta primero: pnpm tsx scripts/get-nomenclator.ts");
    process.exit(1);
  }

  const nom = JSON.parse(readFileSync(nominatorPath, "utf-8"));
  const ambitos: Array<{ i: number; n: string; co: string; l: number; p: Array<{ l: number; p: number[] }> }> =
    nom.amb[0].ambitos;

  // Construir índice por i
  const byIndex = new Map(ambitos.map((a) => [a.i, a]));

  // Extraer todos los municipios (nivel 3) con su departamento
  const municipios: Municipio[] = [];
  for (const amb of ambitos) {
    if (amb.l !== 3) continue; // Solo municipios
    // Buscar el departamento padre (nivel 2)
    const deptEntry = amb.p
      .flatMap((p) => (p.l === 2 ? p.p : []))
      .map((i) => byIndex.get(i))
      .find((a) => a?.l === 2);

    municipios.push({
      i: amb.i,
      n: amb.n,
      co: amb.co,
      dept: deptEntry?.n ?? "?",
      deptCode: deptEntry?.co ?? "??",
    });
  }

  const total = Math.min(municipios.length, limit === Infinity ? municipios.length : limit);
  console.log(`\nNomenclátor cargado: ${municipios.length} municipios`);
  console.log(`Crawleando: ${total} municipios → ${outFile}`);
  console.log(`Rate limit: 1 req/s\n`);

  // Inicializar el archivo de salida
  writeFileSync(
    outFile,
    JSON.stringify({ meta: { crawledAt: new Date().toISOString(), total } }) + "\n"
  );

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    locale: "es-CO",
    timezoneId: "America/Bogota",
  });
  const page = await context.newPage();

  // Cargar el SPA primero (establece cookies/headers necesarios para CloudFront)
  console.log("Inicializando sesión con el portal...");
  await page.goto(`${BASE}/v2/`, { waitUntil: "networkidle", timeout: 40000 });
  await page.waitForTimeout(2000);
  console.log("Sesión iniciada. Comenzando crawl...\n");

  let ok = 0;
  let errors = 0;
  const byDept: Record<string, { ok: number; err: number }> = {};

  for (let i = 0; i < total; i++) {
    const mun = municipios[i]!;
    const start = Date.now();

    try {
      const data = await fetchAct(page, mun.co);
      const result = data ? extractResults(data, mun) : null;

      if (result) {
        appendFileSync(outFile, JSON.stringify(result) + "\n");
        ok++;
        const entry = byDept[mun.deptCode] ?? { ok: 0, err: 0 };
        entry.ok++;
        byDept[mun.deptCode] = entry;

        // Mostrar candidatos clave
        const votos = result.votos
          .map((c) => `${c.nombre.split(" ")[0]?.slice(0, 8)}:${c.vot.toLocaleString()}`)
          .join(" | ");
        const progress = `[${i + 1}/${total}]`;
        const dept = `${mun.deptCode}-${mun.dept.slice(0, 8)}`;
        console.log(
          `${progress} ${dept} → ${mun.co} ${mun.n.slice(0, 16).padEnd(16)} mesas:${result.mesas.escrutadas}/${result.mesas.total} ${votos}`
        );
      } else {
        errors++;
        const entry = byDept[mun.deptCode] ?? { ok: 0, err: 0 };
        entry.err++;
        byDept[mun.deptCode] = entry;
        console.log(`[${i + 1}/${total}] ✗ ${mun.co} ${mun.n} (null/vacío)`);
      }
    } catch (e) {
      errors++;
      console.error(`[${i + 1}/${total}] ✗ ${mun.co} ${mun.n}: ${e}`);
    }

    // Rate limit: esperar el resto del segundo
    const elapsed = Date.now() - start;
    if (elapsed < 1050 && i < total - 1) {
      await new Promise((r) => setTimeout(r, 1050 - elapsed));
    }

    // Cada 100 municipios, refrescar la sesión para evitar que expire
    if ((i + 1) % 100 === 0 && i < total - 1) {
      console.log("\n--- Refrescando sesión CloudFront... ---");
      await page.goto(`${BASE}/v2/`, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(2000);
      console.log("--- Sesión renovada. Continuando... ---\n");
    }
  }

  await browser.close();

  console.log(`\n${"=".repeat(50)}`);
  console.log(`COMPLETADO: ${ok} OK, ${errors} errores`);
  console.log(`Archivo: ${outFile}`);

  // Resumen por departamento
  console.log("\nResumen por departamento:");
  for (const [deptCode, stats] of Object.entries(byDept).sort()) {
    const dept = municipios.find((m) => m.deptCode === deptCode)?.dept ?? deptCode;
    console.log(`  ${deptCode} ${dept.slice(0, 15).padEnd(15)}: ${stats.ok} OK, ${stats.err} err`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
