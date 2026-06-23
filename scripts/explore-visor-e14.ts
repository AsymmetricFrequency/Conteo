/**
 * Explora el Visor Ciudadano de E-14 (divulgacione14presidente.registraduria.gov.co)
 * para descubrir la API de imágenes de actas y su estructura.
 */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const BASE = "https://divulgacione14presidente.registraduria.gov.co";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    locale: "es-CO",
    timezoneId: "America/Bogota",
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  const capturedRequests: Array<{ url: string; method: string; status: number; type: string; bodySnippet?: string }> = [];

  // Capturar TODAS las requests
  page.on("response", async (res) => {
    const url = res.url();
    const ct = res.headers()["content-type"] ?? "";
    const entry = {
      url,
      method: res.request().method(),
      status: res.status(),
      type: ct.split(";")[0] ?? "",
    };

    if (ct.includes("json") || url.includes("/api/") || url.includes(".json")) {
      try {
        const body = await res.text();
        (entry as typeof entry & { bodySnippet: string }).bodySnippet = body.slice(0, 500);
      } catch { /**/ }
    }
    capturedRequests.push(entry);

    if (!url.includes("font") && !url.includes(".css") && !url.includes(".woff") && !url.includes(".png") && !url.includes(".ico")) {
      const path = url.replace(BASE, "");
      console.log(`  [${res.status()}] ${path.slice(0, 100)}`);
    }
  });

  // 1. Cargar la página principal
  console.log("\n=== Cargando Visor Ciudadano E-14 ===");
  try {
    await page.goto(BASE, { waitUntil: "networkidle", timeout: 40000 });
    await page.waitForTimeout(3000);
  } catch (e) {
    console.log("Error cargando página:", e);
    // Intentar de todas formas
  }

  const title = await page.title().catch(() => "");
  console.log("Título:", title);

  // 2. DOM snapshot
  const dom = await page.content();
  writeFileSync("/tmp/visor-e14-dom.html", dom);
  console.log("DOM guardado en /tmp/visor-e14-dom.html");

  // 3. Links y botones
  const links = await page.evaluate(() =>
    Array.from(document.querySelectorAll("a, button, input, select"))
      .slice(0, 30)
      .map(el => ({
        tag: el.tagName,
        text: el.textContent?.trim().slice(0, 60),
        href: (el as HTMLAnchorElement).href ?? "",
        type: (el as HTMLInputElement).type ?? "",
        name: (el as HTMLInputElement).name ?? "",
        id: el.id,
        class: el.className.slice(0, 60),
      }))
  );
  console.log("\nElementos interactivos:");
  links.forEach(l => console.log(`  <${l.tag} id="${l.id}" type="${l.type}" name="${l.name}"> "${l.text}" → ${l.href.slice(0, 80)}`));

  // 4. Probar fetch directo de posibles endpoints API
  console.log("\n=== Probando endpoints API ===");
  const apiCandidates = [
    "/api/actas",
    "/api/e14",
    "/api/mesas",
    "/api/departamentos",
    "/api/municipios",
    "/v1/actas",
    "/actas/00",
    "/actas/01/001",
  ];

  for (const ep of apiCandidates) {
    const result = await page.evaluate(async (url) => {
      try {
        const r = await fetch(url, { headers: { Accept: "application/json" } });
        return { status: r.status, body: await r.text().then(t => t.slice(0, 200)) };
      } catch (e) {
        return { status: -1, body: String(e) };
      }
    }, `${BASE}${ep}`);
    console.log(`  ${result.status === 200 ? "✓" : "✗"} ${ep}: ${result.status} — ${result.body.slice(0, 100)}`);
  }

  // 5. JS bundles para descubrir API
  const jsBundles = capturedRequests.filter(r => r.url.endsWith(".js") && r.status === 200);
  console.log(`\nBundles JS encontrados: ${jsBundles.length}`);
  jsBundles.forEach(b => console.log(`  ${b.url.replace(BASE, "")}`));

  // Descargar el bundle principal para buscar endpoints
  if (jsBundles.length > 0) {
    const mainBundle = jsBundles.find(b => b.url.includes("main") || b.url.includes("index")) ?? jsBundles[0];
    if (mainBundle) {
      console.log(`\nDescargando bundle: ${mainBundle.url}`);
      const bundleContent = await page.evaluate(async (url) => {
        const r = await fetch(url);
        return r.text();
      }, mainBundle.url!);
      writeFileSync("/tmp/visor-bundle.js", bundleContent);
      console.log(`  Bundle guardado (${bundleContent.length.toLocaleString()} chars)`);

      // Buscar patrones de API
      const patterns = [
        /['"`][^'"`]*\/api\/[^'"`]{3,80}['"`]/g,
        /fetch\s*\([^)]{5,100}\)/g,
        /axios\s*\.[a-z]+\s*\([^)]{5,100}\)/g,
        /https?:\/\/[^\s'"]{10,100}/g,
        /\/actas\/[^'"]{0,50}/g,
        /\/formulario[^'"]{0,50}/g,
        /\/imagen[^'"]{0,50}/g,
        /\/pdf[^'"]{0,50}/g,
        /departament[^'"]{0,80}/gi,
        /municipio[^'"]{0,80}/gi,
      ];

      console.log("\nPatrones de API en el bundle:");
      for (const pat of patterns) {
        const matches = [...new Set([...bundleContent.matchAll(pat)].map(m => m[0]))];
        if (matches.length > 0) {
          console.log(`\n  Patrón /${pat.source.slice(0, 40)}/:`);
          matches.slice(0, 8).forEach(m => console.log(`    ${m.slice(0, 120)}`));
        }
      }
    }
  }

  // 6. Resumen de todas las requests capturadas
  console.log("\n=== RESUMEN DE REQUESTS ===");
  const interesting = capturedRequests.filter(r =>
    !r.url.includes(".css") && !r.url.includes(".woff") && !r.url.includes(".ico") &&
    !r.url.includes("font") && r.status === 200
  );
  interesting.forEach(r => console.log(`  [${r.status}] ${r.type.slice(0, 20).padEnd(20)} ${r.url.replace(BASE, "").slice(0, 100)}`));

  writeFileSync("/tmp/visor-requests.json", JSON.stringify(capturedRequests, null, 2));
  console.log("\nRequests completas en /tmp/visor-requests.json");

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
