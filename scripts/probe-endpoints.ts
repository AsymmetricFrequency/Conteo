/**
 * Prueba variaciones de endpoints buscando datos de zona/puesto/mesa.
 * También explora el endpoint HIST y otras URLs del portal.
 */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const BASE = "https://resultados.registraduria.gov.co";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    locale: "es-CO",
    timezoneId: "America/Bogota",
  });
  const page = await context.newPage();

  // Cargar el SPA para tener los cookies/headers correctos
  console.log("Cargando SPA...");
  await page.goto(`${BASE}/v2/`, { waitUntil: "networkidle", timeout: 40000 });
  await page.waitForTimeout(2000);

  async function probe(url: string): Promise<{ status: number; body?: unknown }> {
    return page.evaluate(async (u) => {
      try {
        const res = await fetch(u, {
          headers: { Accept: "application/json, */*", "Cache-Control": "no-cache" },
        });
        if (res.ok) {
          const body = await res.json().catch(() => null);
          return { status: res.status, body };
        }
        return { status: res.status };
      } catch (e: unknown) {
        return { status: -1, error: String(e) };
      }
    }, url);
  }

  const results: Record<string, unknown> = {};

  // 1. Endpoint HIST - avance histórico de actualizaciones
  // /json/HIST/:deptCode/:electionSiglas/:advance/:scopeCode
  // advance = "{type}_{numact.padStart(4,'0')}"
  // El ACT de Medellín tiene numact:24, type podría ser "AV" o "BO"
  console.log("\n=== HIST endpoints ===");
  const histEndpoints = [
    "/v2/json/HIST/01/PR/AV_0001/01001.json",   // dept=01, avance 1, Medellín
    "/v2/json/HIST/01/PR/AV_0024/01001.json",   // avance 24 (último)
    "/v2/json/HIST/01/PR/BO_0001/01001.json",   // tipo BO
    "/v2/json/HIST/01/PR/AV_0001/01.json",      // nivel dept
    "/v2/json/HIST/00/PR/AV_0001/00.json",      // nacional
    "/v2/json/HIST/00/PR/AV_0066/00.json",      // nacional avance 66
  ];

  for (const ep of histEndpoints) {
    const r = await probe(`${BASE}${ep}`);
    if (r.status === 200) {
      console.log(`  ✓ ${ep}: OK`);
      console.log(`    ${JSON.stringify(r.body).slice(0, 200)}`);
      results[ep] = r.body;
    } else {
      console.log(`  ✗ ${ep}: ${r.status}`);
    }
  }

  // 2. Explorar el ACT con formato diferente para zona/puesto
  // El bundle dice: codeMinimumLength: 15 para mesa
  // El código del puesto es 9 chars: dept(2)+mun(3)+puesto(4)?
  console.log("\n=== ACT zona/puesto (diferentes formatos) ===");

  // El nomenclator tiene 1189 municipios. 122,020 mesas / 1189 mun ≈ 102 mesas/mun
  // Con ≈5000 mesas en Medellín y ≈50 puestos, cada puesto tiene ≈100 mesas

  // Intentar códigos DIVIPOLA extendidos
  const actCodes = [
    // Con 6 dígitos (dept+zona o dept+mun sufijo)
    "010011",   // dept01 + zona 01 1
    "010012",
    "010100",
    // Formatos de 7 dígitos
    "0100101",  // dept01 + mun001 + zona01
    "0100102",
    // Formatos de 8 dígitos
    "01001001", // dept01+mun001+zona00+puesto1
    "01001011",
    "01001021",
    // Formatos de 9 dígitos
    "010010001", // Medellín puesto 0001
    "010010002",
    "010010010",
    // Con ceros al inicio diferente
    "0100100001", // 10 chars
    // Formatos de 10 dígitos
    "0100100001",
    "0100100002",
  ];

  for (const code of actCodes) {
    const r = await probe(`${BASE}/v2/json/ACT/PR/${code}.json`);
    if (r.status === 200) {
      console.log(`  ✓ ACT/${code}: OK`);
      console.log(`    ${JSON.stringify(r.body).slice(0, 200)}`);
      results[`/v2/json/ACT/PR/${code}.json`] = r.body;
    } else {
      process.stdout.write(`  ✗ ${code}(${r.status})  `);
    }
  }

  // 3. Probar el otro dominio de la Registraduría (escrutinio)
  console.log("\n\n=== Portal escrutinio ===");
  const scrutinyUrls = [
    "https://www.registraduria.gov.co/resultados/index.xhtml",
    "https://certielectoral.registraduria.gov.co/",
    "https://puestos.registraduria.gov.co/",
  ];

  for (const url of scrutinyUrls) {
    const r = await probe(url);
    console.log(`  ${r.status === 200 ? "✓" : "✗"} ${url}: ${r.status}`);
  }

  // 4. Revisar si el ACT de un departamento tiene subestructuras de zonas
  console.log("\n=== ACT Antioquia completo (subestructuras?) ===");
  const antioquia = await probe(`${BASE}/v2/json/ACT/PR/01.json`);
  if (antioquia.body && typeof antioquia.body === 'object') {
    const body = antioquia.body as Record<string, unknown>;
    console.log("  Claves:", Object.keys(body));
    for (const k of Object.keys(body)) {
      const v = body[k];
      if (Array.isArray(v)) {
        console.log(`  ${k}: [${v.length}] → ${JSON.stringify(v[0]).slice(0, 100)}`);
      } else if (typeof v === 'object' && v !== null) {
        console.log(`  ${k}: {${Object.keys(v as object).join(", ")}}`);
      } else {
        console.log(`  ${k}: ${v}`);
      }
    }
  }

  await browser.close();

  writeFileSync("/tmp/probe-results.json", JSON.stringify(results, null, 2));
  console.log("\nResultados en /tmp/probe-results.json");
}

main().catch((e) => { console.error(e); process.exit(1); });
