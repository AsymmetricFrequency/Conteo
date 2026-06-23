/**
 * Descarga el bundle JS del portal con Playwright (navegador real)
 * y busca patrones de endpoints para zona/puesto/mesa.
 */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  let bundleContent = "";

  // Interceptar el bundle JS
  page.on("response", async (response) => {
    const url = response.url();
    if (url.includes("index-") && url.endsWith(".js")) {
      console.log("Bundle encontrado:", url);
      bundleContent = await response.text();
    }
  });

  await page.goto("https://resultados.registraduria.gov.co/v2/", {
    waitUntil: "networkidle",
    timeout: 30000,
  });

  if (!bundleContent) {
    console.log("Bundle no capturado en networkidle, esperando...");
    await page.waitForTimeout(3000);
  }

  await browser.close();

  if (!bundleContent) {
    console.error("No se pudo capturar el bundle.");
    process.exit(1);
  }

  writeFileSync("/tmp/reg_bundle.js", bundleContent);
  console.log(`Bundle guardado: ${bundleContent.length.toLocaleString()} chars`);

  // Buscar patrones de endpoints
  const patterns = [
    /["'`][A-Z]{2,5}\/PR\/[^"'`\s]{0,50}["'`]/g,
    /json\/[A-Z]{2,6}\/PR/g,
    /ACT|MES|PUE|ZON|MESA|PUESTO|ZONA/g,
    /\/${[^}]+}\.json/g,
    /fetch\([^)]{5,100}\)/g,
  ];

  console.log("\n--- Patrones de URL en el bundle ---");
  for (const re of patterns) {
    const matches = [...new Set([...bundleContent.matchAll(re)].map((m) => m[0]))];
    if (matches.length > 0) {
      console.log(`\nPatrón /${re.source}/:`, matches.slice(0, 15));
    }
  }

  // Buscar "mesa" o "puesto" en contexto
  const mesaIdx = [...bundleContent.matchAll(/mesa|puesto|zona/gi)];
  console.log(`\nOcurrencias de 'mesa/puesto/zona': ${mesaIdx.length}`);

  // Mostrar fragmentos alrededor de 'ACT' para ver el patrón completo
  const actMatches = [...bundleContent.matchAll(/ACT['"\/][A-Z]{2}/g)];
  console.log(`\nFragmentos ACT: ${actMatches.slice(0, 10).map((m) => m[0])}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
