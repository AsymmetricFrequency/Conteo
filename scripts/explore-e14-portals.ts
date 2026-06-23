/**
 * Explora los portales reales de E-14 y escrutinios descubiertos en la página oficial.
 */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const PORTALS = [
  { name: "e14-delegados", base: "https://e14segundavueltapresidente.registraduria.gov.co" },
  { name: "e14-transmision", base: "https://e14segundavueltapresidentet.registraduria.gov.co" },
  { name: "escrutinios", base: "https://escrutinios2vueltapresidente2026.registraduria.gov.co" },
  { name: "visor-e14", base: "https://divulgacione14presidente.registraduria.gov.co" },
];

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--ignore-certificate-errors", "--no-sandbox"],
  });

  for (const portal of PORTALS) {
    console.log(`\n${"=".repeat(65)}`);
    console.log(`[${portal.name}] ${portal.base}`);

    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      locale: "es-CO",
      ignoreHTTPSErrors: true,
      extraHTTPHeaders: {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-CO,es;q=0.9",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
      },
    });
    const page = await context.newPage();

    const jsonCaptured: Record<string, unknown> = {};
    const allRequests: string[] = [];

    page.on("response", async (res) => {
      const url = res.url();
      const ct = res.headers()["content-type"] ?? "";
      allRequests.push(`[${res.status()}] ${url.replace(portal.base, "")}`);
      if (ct.includes("json") || url.endsWith(".json")) {
        try {
          const body = await res.json();
          jsonCaptured[url] = body;
          console.log(`  [JSON] ${url.replace(portal.base, "")}`);
          console.log(`         ${JSON.stringify(body).slice(0, 300)}`);
        } catch { /**/ }
      }
    });

    try {
      const resp = await page.goto(portal.base, {
        waitUntil: "networkidle",
        timeout: 30000,
      });

      const title = await page.title().catch(() => "");
      const finalUrl = page.url();
      console.log(`  Status: ${resp?.status()}, URL final: ${finalUrl}`);
      console.log(`  Title: "${title}"`);

      await page.waitForTimeout(3000);

      const html = await page.content().catch(() => "");
      if (html.length > 500) {
        writeFileSync(`/tmp/${portal.name}.html`, html);
        console.log(`  HTML guardado (${html.length} chars)`);
      }

      // Scripts JS
      const scripts = await page.evaluate(() =>
        Array.from(document.querySelectorAll("script[src]"))
          .map(s => (s as HTMLScriptElement).src)
          .filter(s => !s.includes("google") && !s.includes("leaflet") && !s.includes("cdnjs"))
      );
      console.log(`  Scripts: ${scripts.slice(0, 5).map(s => s.replace(portal.base, "")).join(", ")}`);

      // Links principales
      const links = await page.evaluate(() =>
        Array.from(document.querySelectorAll("a[href]")).slice(0, 15)
          .map(a => ({ href: (a as HTMLAnchorElement).href, text: a.textContent?.trim().slice(0, 50) }))
      );
      console.log("  Links:");
      links.forEach(l => console.log(`    "${l.text}" → ${l.href}`));

      // Elementos de navegación del E-14
      const navItems = await page.evaluate(() => {
        const selectors = [
          "select", "input[type='number']", "input[type='text']",
          "[class*='departamento']", "[class*='municipio']", "[class*='zona']",
          "[class*='puesto']", "[class*='mesa']", "[class*='acta']",
          "table th", "ul li", "nav a",
        ];
        const found: string[] = [];
        for (const sel of selectors) {
          const els = document.querySelectorAll(sel);
          if (els.length > 0 && els.length < 50) {
            els.forEach(el => {
              const t = el.textContent?.trim().slice(0, 60);
              if (t) found.push(`${el.tagName}[${sel}]: ${t}`);
            });
          }
        }
        return found.slice(0, 20);
      });
      if (navItems.length > 0) {
        console.log("  Navegación E-14:");
        navItems.forEach(n => console.log(`    ${n}`));
      }

      // Descargar bundle principal y buscar endpoints
      const mainBundle = scripts.find(s => s.includes("main") || s.includes("app") || s.includes("chunk") || s.includes("index")) ?? scripts[0];
      if (mainBundle) {
        console.log(`  Descargando: ${mainBundle.replace(portal.base, "")}`);
        const bundleText = await page.evaluate(async (url) => {
          try {
            const r = await fetch(url);
            return r.ok ? r.text() : "";
          } catch { return ""; }
        }, mainBundle);

        if (bundleText.length > 1000) {
          const bundlePath = `/tmp/${portal.name}-bundle.js`;
          writeFileSync(bundlePath, bundleText);
          console.log(`  Bundle: ${bundleText.length.toLocaleString()} chars → ${bundlePath}`);

          // Extraer endpoints de API
          const apiPaths = [...new Set([
            ...[...bundleText.matchAll(/["'`](\/[a-z][a-z0-9/_:-]{2,60})["'`]/g)].map(m => m[1] ?? ""),
            ...[...bundleText.matchAll(/path:\s*["'`]([^"'`]{5,80})["'`]/g)].map(m => m[1] ?? ""),
            ...[...bundleText.matchAll(/url:\s*["'`]([^"'`]{5,80})["'`]/g)].map(m => m[1] ?? ""),
          ]).filter(p => p.includes("api") || p.includes("acta") || p.includes("e14") || p.includes("mesa") || p.includes("dpto") || p.includes("muni") || p.includes("zona") || p.includes("puesto"))];

          if (apiPaths.length > 0) {
            console.log("\n  API ENDPOINTS:");
            apiPaths.forEach(p => console.log(`    ${p}`));
          }

          // Buscar URLs de backends
          const backends = [...new Set([...bundleText.matchAll(/https?:\/\/[a-z0-9.-]+(?:\.[a-z]{2,})(?::\d+)?\/[^\s"'`<>]{5,80}/g)].map(m => m[0]))]
            .filter(u => !u.includes("cdn") && !u.includes("google") && !u.includes("leaflet") && !u.includes("npmjs"));
          if (backends.length > 0) {
            console.log("\n  BACKEND URLs:");
            backends.slice(0, 10).forEach(u => console.log(`    ${u}`));
          }

          // Buscar patrones de actas/imágenes
          const imgPatterns = [...new Set([...bundleText.matchAll(/["'`][^"'`]*(imagen|image|pdf|acta|formulario|e.?14|scan)[^"'`]{0,60}["'`]/gi)].map(m => m[0]))];
          if (imgPatterns.length > 0) {
            console.log("\n  PATRONES DE IMÁGENES:");
            imgPatterns.slice(0, 10).forEach(p => console.log(`    ${p.slice(0, 100)}`));
          }
        }
      }

      // Requests no-200
      const nonOk = allRequests.filter(r => !r.startsWith("[200]") && !r.includes(".css") && !r.includes(".woff"));
      if (nonOk.length > 0) {
        console.log("  Requests no-200:", nonOk.slice(0, 5));
      }

    } catch (e) {
      console.log(`  ERROR: ${e}`);
    }

    await context.close();
  }

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
