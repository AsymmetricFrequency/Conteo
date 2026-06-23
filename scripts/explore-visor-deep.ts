/**
 * Exploración profunda del Visor Ciudadano E-14.
 * Navega por departamento/municipio/zona/puesto/mesa e intercepta la API.
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

  const captured: Record<string, unknown> = {};

  page.on("response", async (res) => {
    const url = res.url();
    const ct = res.headers()["content-type"] ?? "";
    if (captured[url]) return;
    if (ct.includes("json") || url.includes("/api/") || url.endsWith(".json")) {
      try {
        const body = await res.json();
        captured[url] = body;
        const path = url.replace(BASE, "");
        console.log(`  [JSON] ${path}`);
        console.log(`         ${JSON.stringify(body).slice(0, 200)}`);
      } catch { /**/ }
    }
    if (!ct.includes("json") && !url.includes(".js") && !url.includes(".css") && !url.includes(".woff") && !url.includes("font")) {
      if (res.status() !== 200 || url.includes("/api/") || url.includes("/acta")) {
        console.log(`  [${res.status()}] ${url.replace(BASE, "").slice(0, 100)}`);
      }
    }
  });

  // 1. Home
  console.log("\n[1] GET /home");
  await page.goto(`${BASE}/home`, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(4000);
  console.log("URL:", page.url());
  console.log("Title:", await page.title());
  const html1 = await page.content();
  writeFileSync("/tmp/visor-home.html", html1);

  // Ver el DOM
  const dom1 = await page.evaluate(() => {
    return {
      links: Array.from(document.querySelectorAll("a")).slice(0, 15).map(a => ({ href: a.href, text: a.textContent?.trim().slice(0, 50) })),
      inputs: Array.from(document.querySelectorAll("input, select, button")).slice(0, 15).map(el => ({
        tag: el.tagName, type: (el as HTMLInputElement).type, id: el.id, name: (el as HTMLInputElement).name,
        text: el.textContent?.trim().slice(0, 40), class: el.className.slice(0, 60)
      })),
      headings: Array.from(document.querySelectorAll("h1,h2,h3,p")).slice(0, 5).map(el => el.textContent?.trim().slice(0, 80)),
    };
  });
  console.log("Links:", dom1.links);
  console.log("Inputs:", dom1.inputs);
  console.log("Headings:", dom1.headings);

  // 2. Departamento 01 (Antioquia)
  console.log("\n[2] GET /departamento/01");
  await page.goto(`${BASE}/departamento/01`, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(4000);
  writeFileSync("/tmp/visor-dept01.html", await page.content());
  console.log("URL:", page.url());

  const dom2 = await page.evaluate(() => ({
    links: Array.from(document.querySelectorAll("a")).slice(0, 20).map(a => ({ href: a.href, text: a.textContent?.trim().slice(0, 50) })),
    lists: Array.from(document.querySelectorAll("li,tr,td,[class*='item'],[class*='row'],[class*='card']")).slice(0, 10).map(el => ({
      tag: el.tagName, text: el.textContent?.trim().slice(0, 60), class: el.className.slice(0, 60),
      attrs: Array.from(el.attributes).map(a => `${a.name}=${a.value}`).join(" ").slice(0, 100)
    }))
  }));
  console.log("Links en /departamento/01:", dom2.links.slice(0, 10));
  console.log("Items:", dom2.lists.slice(0, 5));

  // 3. Probar rutas de municipio
  console.log("\n[3] Probando rutas de municipio...");
  const munPaths = [
    "/departamento/01/municipio/001",
    "/departamento/01/001",
    "/municipio/01001",
    "/departamento/01/municipio/01001",
    "/01/01001",
  ];
  for (const p of munPaths) {
    const r = await page.evaluate(async (url) => {
      const res = await fetch(url, { headers: { Accept: "text/html,application/json" } }).catch(() => null);
      return res ? { status: res.status, ok: res.ok } : { status: -1, ok: false };
    }, `${BASE}${p}`);
    console.log(`  ${r.ok ? "✓" : "✗"} ${p}: ${r.status}`);
  }

  // 4. Buscar el JS bundle del visor y extraer la API
  console.log("\n[4] Descargando bundle JS del visor...");
  const jsSources = await page.evaluate(() =>
    Array.from(document.querySelectorAll("script[src]")).map(s => (s as HTMLScriptElement).src)
  );
  console.log("Scripts:", jsSources);

  for (const src of jsSources.slice(0, 3)) {
    if (!src || src.includes("google") || src.includes("analytics")) continue;
    console.log(`\nAnalizando: ${src}`);
    const bundleText = await page.evaluate(async (url) => {
      const r = await fetch(url).catch(() => null);
      if (!r || !r.ok) return "";
      return r.text();
    }, src);

    if (bundleText.length > 100) {
      writeFileSync("/tmp/visor-bundle-e14.js", bundleText);
      console.log(`  Guardado (${bundleText.length.toLocaleString()} chars)`);

      // Buscar endpoints de API
      const patterns = [
        /["'`][^"'`]*\/api\/[^"'`]{3,80}["'`]/g,
        /fetch\([^)]{5,100}\)/g,
        /axios\.[a-z]+\([^)]{5,100}\)/g,
        /https?:\/\/[a-z0-9.-]+\.[a-z]{2,}\/[^\s'"]{5,80}/g,
        /\/acta[s]?\/[^"'`\s]{0,60}/g,
        /\/formulario[^"'`\s]{0,60}/g,
        /\/imagen[^"'`\s]{0,60}/g,
        /\/visor[^"'`\s]{0,60}/g,
        /\/e14[^"'`\s]{0,60}/gi,
        /"departamento"[^{]{0,200}/g,
        /"municipio"[^{]{0,200}/g,
      ];

      for (const pat of patterns) {
        const matches = [...new Set([...bundleText.matchAll(pat)].map(m => m[0]))];
        if (matches.length > 0) {
          console.log(`\n  Patrón ${pat.source.slice(0, 30)}:`);
          matches.slice(0, 5).forEach(m => console.log(`    ${m.slice(0, 120)}`));
        }
      }
      break;
    }
  }

  // 5. Resumen de JSON capturados
  console.log("\n=== JSON endpoints capturados ===");
  for (const [url, body] of Object.entries(captured)) {
    console.log(`\n${url.replace(BASE, "")}`);
    console.log(JSON.stringify(body, null, 2).slice(0, 400));
  }

  writeFileSync("/tmp/visor-e14-captured.json", JSON.stringify(captured, null, 2));
  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
