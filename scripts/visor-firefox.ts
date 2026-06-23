/**
 * Usa Firefox en Playwright (evita problemas HTTP/2 de Chromium con Akamai).
 */
import { firefox } from "playwright";
import { writeFileSync } from "node:fs";

const TARGETS = [
  "https://e14segundavueltapresidente.registraduria.gov.co",
  "https://divulgacione14presidente.registraduria.gov.co",
  "https://escrutinios2vueltapresidente2026.registraduria.gov.co",
];

async function main() {
  // Instalar Firefox si no está
  const browser = await firefox.launch({
    headless: true,
    firefoxUserPrefs: {
      "network.http.http2.enabled": false,  // Forzar HTTP/1.1
      "network.http.http2.allow-reuse": false,
    },
  });

  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:125.0) Gecko/20100101 Firefox/125.0",
    locale: "es-CO",
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  const jsonCaptured: Record<string, unknown> = {};
  page.on("response", async (res) => {
    const url = res.url();
    const ct = res.headers()["content-type"] ?? "";
    if (ct.includes("json") || url.endsWith(".json")) {
      try {
        const body = await res.json();
        jsonCaptured[url] = body;
        console.log(`  [JSON] ${url}: ${JSON.stringify(body).slice(0, 200)}`);
      } catch { /**/ }
    }
  });

  for (const target of TARGETS) {
    console.log(`\n=== ${target} ===`);
    try {
      const resp = await page.goto(target, { waitUntil: "commit", timeout: 20000 });
      await page.waitForTimeout(5000);
      const title = await page.title().catch(() => "");
      const finalUrl = page.url();
      console.log(`  Status: ${resp?.status()}, Final: ${finalUrl}, Title: "${title}"`);

      const html = await page.content().catch(() => "");
      if (html.length > 200 && !html.includes("chrome-error")) {
        const fname = `/tmp/ff-${target.replace(/https?:\/\//, "").replace(/\./g, "-").slice(0, 40)}.html`;
        writeFileSync(fname, html);
        console.log(`  HTML (${html.length}): ${fname}`);

        const links = await page.evaluate(() =>
          Array.from(document.querySelectorAll("a[href]")).slice(0, 10)
            .map(a => `${a.textContent?.trim().slice(0, 30)} → ${(a as HTMLAnchorElement).href}`)
        );
        links.forEach(l => console.log(`  ${l}`));

        const scripts = await page.evaluate(() =>
          Array.from(document.querySelectorAll("script[src]")).map(s => (s as HTMLScriptElement).src)
        );
        console.log(`  Scripts: ${scripts.slice(0, 3).join(", ")}`);
      }
    } catch (e) {
      console.log(`  ERROR: ${e}`);
    }
  }

  writeFileSync("/tmp/visor-ff-captured.json", JSON.stringify(jsonCaptured, null, 2));
  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
