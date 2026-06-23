/**
 * Descarga el nomenclator.json (árbol completo de territorios con sus códigos)
 * y el config.json del portal de la Registraduría.
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

  const captured: Record<string, unknown> = {};

  page.on("response", async (response) => {
    const url = response.url();
    const ct = response.headers()["content-type"] ?? "";
    if (!ct.includes("json") && !url.endsWith(".json")) return;
    if (captured[url]) return;
    try {
      const body = await response.json();
      captured[url] = body;
      const path = url.replace(BASE, "");
      console.log(`[JSON] ${path} → ${JSON.stringify(body).slice(0, 120)}`);
    } catch {
      /* skip */
    }
  });

  // Cargar el SPA primero (para que tenga las cookies/headers correctos)
  console.log("Cargando SPA...");
  await page.goto(`${BASE}/v2/`, { waitUntil: "networkidle", timeout: 40000 });
  await page.waitForTimeout(2000);

  // Los endpoints estáticos que descubrimos en el bundle
  const endpoints = [
    "/v2/json/nomenclator.json",
    "/v2/json/web/config.json",
    "/v2/json/movilidad/config.json",
    "/v2/json/notification.json",
    "/v2/json/ACT/PR/00.json",    // nacional (ya sabemos que funciona)
    "/v2/json/ACT/PR/01.json",    // Antioquia
    "/v2/json/INI/PR/00.json",    // INI nacional
    "/v2/json/INI/PR/01.json",    // INI Antioquia
    "/v2/json/INI/PR/01001.json", // INI Medellín
  ];

  for (const ep of endpoints) {
    console.log(`\nFetch ${ep}...`);
    try {
      const result = await page.evaluate(async (url) => {
        try {
          const res = await fetch(url, {
            headers: {
              Accept: "application/json, */*",
              "Cache-Control": "no-cache",
            },
          });
          if (!res.ok) return { ok: false, status: res.status };
          const data = await res.json();
          return { ok: true, status: res.status, data };
        } catch (e: unknown) {
          return { ok: false, error: String(e) };
        }
      }, `${BASE}${ep}`);

      if (result.ok) {
        const dataStr = JSON.stringify(result.data, null, 2);
        console.log(`  OK (${result.status}): ${dataStr.slice(0, 300)}`);
        captured[ep] = result.data;
        // Guardar nomenclator completo
        if (ep.includes("nomenclator")) {
          writeFileSync("/tmp/nomenclator.json", dataStr);
          console.log("  → Guardado en /tmp/nomenclator.json");
        }
        if (ep.includes("config")) {
          writeFileSync(`/tmp/reg_${ep.replace(/\//g, "_").replace(/^_+/, "")}.json`, dataStr);
          console.log(`  → Guardado en /tmp/reg_config.json`);
        }
        if (ep.includes("/INI/")) {
          const fname = ep.replace(/\//g, "_").replace(/^_+/, "");
          writeFileSync(`/tmp/${fname}`, dataStr);
          console.log(`  → Guardado en /tmp/${fname}`);
        }
      } else {
        console.log(`  ERROR: ${result.status ?? result.error}`);
      }
    } catch (e) {
      console.error(`  Excepción: ${e}`);
    }
  }

  await browser.close();

  writeFileSync(
    "/tmp/all-captured.json",
    JSON.stringify(captured, null, 2).slice(0, 5_000_000)
  );
  console.log("\nTotal endpoints capturados:", Object.keys(captured).length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
