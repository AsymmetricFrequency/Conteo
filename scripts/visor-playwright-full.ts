/**
 * Playwright con ignore-https-errors para el Visor Ciudadano.
 * Prueba múltiples URLs del portal de E-14.
 */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const PORTALS = [
  "https://divulgacione14presidente.registraduria.gov.co",
  "https://divulgacione14.registraduria.gov.co",
  "https://wapp.registraduria.gov.co/electoral/2026/presidente-de-la-republica/",
];

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--ignore-certificate-errors",
      "--disable-web-security",
      "--no-sandbox",
      "--disable-features=VizDisplayCompositor",
    ],
  });

  for (const BASE of PORTALS) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`Probando: ${BASE}`);

    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      locale: "es-CO",
      ignoreHTTPSErrors: true,
      extraHTTPHeaders: {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-CO,es;q=0.9,en;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
      },
    });
    const page = await context.newPage();

    const jsonCaptured: Record<string, unknown> = {};
    page.on("response", async (res) => {
      const url = res.url();
      const ct = res.headers()["content-type"] ?? "";
      if (ct.includes("json") || url.includes(".json")) {
        try {
          const body = await res.json();
          jsonCaptured[url] = body;
          console.log(`  [JSON] ${url.replace(BASE, "")}: ${JSON.stringify(body).slice(0, 200)}`);
        } catch { /**/ }
      }
      if (!ct.includes("css") && !ct.includes("font") && !url.includes(".woff")) {
        const path = url.replace(BASE, "");
        if (path && res.status() !== 200) {
          console.log(`  [${res.status()}] ${path.slice(0, 80)}`);
        }
      }
    });

    try {
      // Intentar con timeout largo
      const response = await page.goto(`${BASE}/home`, {
        waitUntil: "domcontentloaded",
        timeout: 25000,
      }).catch(() => page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 25000 }).catch(() => null));

      const currentUrl = page.url();
      const title = await page.title().catch(() => "");
      console.log(`  URL final: ${currentUrl}`);
      console.log(`  Title: "${title}"`);
      console.log(`  HTTP status: ${response?.status() ?? "N/A"}`);

      await page.waitForTimeout(3000);

      const html = await page.content().catch(() => "");
      if (html.length > 200) {
        const fname = `/tmp/visor-${BASE.replace(/https?:\/\//, "").replace(/\./g, "-")}.html`;
        writeFileSync(fname, html);
        console.log(`  DOM guardado (${html.length} chars) → ${fname}`);

        // Extraer scripts
        const scripts = await page.evaluate(() =>
          Array.from(document.querySelectorAll("script[src]")).map(s => (s as HTMLScriptElement).src)
        );
        console.log(`  Scripts: ${scripts.length}`);
        scripts.slice(0, 5).forEach(s => console.log(`    ${s.replace(BASE, "")}`));

        // Extraer links
        const links = await page.evaluate(() =>
          Array.from(document.querySelectorAll("a[href]")).slice(0, 20)
            .map(a => ({ href: (a as HTMLAnchorElement).href, text: a.textContent?.trim().slice(0, 50) }))
        );
        console.log(`  Links: ${links.length}`);
        links.forEach(l => console.log(`    "${l.text}" → ${l.href}`));
      }

      // Si el HTML es una SPA con un bundle JS, intentar descargarlo
      const bundleUrls = await page.evaluate(() =>
        Array.from(document.querySelectorAll("script[src]"))
          .map(s => (s as HTMLScriptElement).src)
          .filter(s => s.includes("chunk") || s.includes("main") || s.includes("app") || s.includes("bundle") || s.includes("index"))
      );

      for (const bundleUrl of bundleUrls.slice(0, 2)) {
        console.log(`  Descargando bundle: ${bundleUrl.replace(BASE, "")}`);
        const bundleText = await page.evaluate(async (url) => {
          const r = await fetch(url).catch(() => null);
          if (!r || !r.ok) return "";
          return r.text();
        }, bundleUrl);

        if (bundleText.length > 500) {
          writeFileSync("/tmp/visor-e14-bundle.js", bundleText);
          console.log(`  Bundle guardado (${bundleText.length.toLocaleString()} chars)`);

          // Buscar endpoints de API
          const apiMatches = [...bundleText.matchAll(/["'`]\/[a-z][a-z0-9/_-]{2,60}["'`]/g)]
            .map(m => m[0].replace(/["'`]/g, ""))
            .filter(p => p.includes("/api/") || p.includes("/acta") || p.includes("/e14") || p.includes("/formulario") || p.includes("/imagen") || p.includes("/mesa") || p.includes("/municipio") || p.includes("/departamento"))
            .filter((v, i, a) => a.indexOf(v) === i)
            .slice(0, 20);

          if (apiMatches.length > 0) {
            console.log("\n  ENDPOINTS ENCONTRADOS:");
            apiMatches.forEach(e => console.log(`    ${e}`));
          }

          // Buscar backend URLs
          const backendUrls = [...new Set([...bundleText.matchAll(/https?:\/\/[a-z0-9.-]+(?::\d+)?\/[^\s"'`]{5,80}/g)].map(m => m[0]))];
          if (backendUrls.length > 0) {
            console.log("\n  BACKEND URLs:");
            backendUrls.slice(0, 10).forEach(u => console.log(`    ${u}`));
          }
        }
      }

    } catch (e) {
      console.log(`  ERROR: ${e}`);
    }

    await context.close();
  }

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
