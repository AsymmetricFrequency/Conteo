/**
 * Script de DESCUBRIMIENTO de endpoints de la Registraduría.
 *
 * Abre el portal como un navegador real, intercepta todas las
 * llamadas de red JSON/API y las imprime con sus respuestas.
 *
 * Uso:
 *   pnpm tsx scripts/discover-api.ts
 *
 * Requiere: playwright chromium instalado (pnpm exec playwright install chromium)
 */

import { chromium } from "playwright";

const BASE = "https://resultados.registraduria.gov.co";

const captured: Array<{
  url: string;
  method: string;
  status: number;
  contentType: string;
  body: unknown;
}> = [];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    locale: "es-CO",
    timezoneId: "America/Bogota",
  });

  const page = await context.newPage();

  // Interceptar TODAS las respuestas
  page.on("response", async (response) => {
    const url = response.url();
    const ct = response.headers()["content-type"] ?? "";
    if (!ct.includes("json") && !url.includes("/api/") && !url.includes("/datos")) return;

    try {
      const body = await response.json();
      const entry = {
        url,
        method: response.request().method(),
        status: response.status(),
        contentType: ct,
        body,
      };
      captured.push(entry);
      console.log(`\n[CAPTURADO] ${entry.method} ${url} → ${entry.status}`);
      console.log(JSON.stringify(body, null, 2).slice(0, 800));
    } catch {
      // ignorar respuestas no-JSON
    }
  });

  // 1. Página principal — muestra resultados nacionales
  console.log(`\n=== Navegando a ${BASE}/ ===`);
  await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(3000);

  // 2. Navegar a territorios — para ver la jerarquía
  console.log(`\n=== Navegando a /v2/territorios/0/00/ ===`);
  await page.goto(`${BASE}/v2/territorios/0/00/`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(3000);

  // 3. Navegar a resultados nacionales
  console.log(`\n=== Navegando a /v2/resultados/0/00 ===`);
  await page.goto(`${BASE}/v2/resultados/0/00`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(3000);

  await browser.close();

  console.log(`\n\n${"=".repeat(60)}`);
  console.log(`RESUMEN: ${captured.length} endpoints capturados`);
  console.log("=".repeat(60));

  // Guardar en JSON para análisis
  const Fs = await import("node:fs");
  const outPath = "/tmp/registraduria-endpoints.json";
  Fs.writeFileSync(outPath, JSON.stringify(captured, null, 2));
  console.log(`\nGuardado en: ${outPath}`);
  console.log("\nURLs únicas:");
  [...new Set(captured.map((c) => c.url))].forEach((u) => console.log(" →", u));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
