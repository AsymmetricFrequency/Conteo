/**
 * Descarga el PDF de una acta E-14 directamente desde el CDN del portal.
 */
import { firefox } from "playwright";
import { writeFileSync } from "node:fs";

const BASE = "https://e14segundavueltapresidente.registraduria.gov.co";
const PDF_URL = `${BASE}/assets/temis/pdf/11/004/000/00/001/PRE/38431c66766f4b554f88648f0971cd813cd3b22535f2e92399739fa954c17926.pdf`;

async function main() {
  const browser = await firefox.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:125.0) Gecko/20100101 Firefox/125.0",
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  // Capturar el PDF cuando Playwright lo cargue
  let pdfBody: Buffer | null = null;
  context.on("response", async (res) => {
    if (res.url().includes("/assets/temis/pdf/") && res.headers()["content-type"]?.includes("pdf")) {
      pdfBody = await res.body();
      console.log(`\nPDF interceptado! Size: ${pdfBody.length.toLocaleString()} bytes`);
    }
  });

  // Primero cargar el home para establecer contexto
  await page.goto(`${BASE}/home`, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForTimeout(1500);

  // Navegar directamente al PDF usando page.goto
  console.log("Navegando al PDF...");
  let pdfResp: import("playwright").Response | null = null;
  try {
    pdfResp = await page.goto(PDF_URL, { timeout: 30000 });
    console.log(`Status: ${pdfResp?.status()}`);
    console.log(`Content-Type: ${pdfResp?.headers()["content-type"]}`);
    const size = (await pdfResp?.body())?.length ?? 0;
    console.log(`Size: ${size.toLocaleString()} bytes`);

    const body = await pdfResp?.body();
    if (body && body.length > 1000) {
      const header = String.fromCharCode(...body.slice(0, 8));
      console.log(`Header: "${header}"`);
      if (header.startsWith("%PDF")) {
        writeFileSync("/tmp/e14-acta.pdf", body);
        console.log(`\n✓ PDF guardado en /tmp/e14-acta.pdf!`);
      } else {
        console.log("No es un PDF válido. Contenido:", String.fromCharCode(...body.slice(0, 200)));
      }
    }
  } catch (e) {
    console.log("Error page.goto:", e);
  }

  // Alternativa: usar fetch desde el contexto de la página (ya cargada con sesión)
  if (!pdfBody) {
    console.log("\nIntentando con page.evaluate fetch...");
    try {
      await page.goto(`${BASE}/home`, { waitUntil: "domcontentloaded", timeout: 20000 });
      await page.waitForTimeout(1000);

      const result = await page.evaluate(async (url) => {
        const r = await fetch(url, {
          credentials: "include",
          headers: {
            "Accept": "application/pdf,*/*",
            "Referer": "https://e14segundavueltapresidente.registraduria.gov.co/departamento/11",
          },
        });
        const ab = await r.arrayBuffer();
        return {
          status: r.status,
          ct: r.headers.get("content-type"),
          size: ab.byteLength,
          header: Array.from(new Uint8Array(ab.slice(0, 8))).map(b => String.fromCharCode(b)).join(""),
          bytes: Array.from(new Uint8Array(ab.slice(0, 100000))), // First 100KB
        };
      }, PDF_URL);

      console.log(`Status: ${result.status}, CT: ${result.ct}, Size: ${result.size.toLocaleString()}`);
      console.log(`Header: "${result.header}"`);

      if (result.header?.startsWith("%PDF") && result.bytes.length > 1000) {
        writeFileSync("/tmp/e14-acta-fetch.pdf", Buffer.from(result.bytes));
        console.log(`\n✓ PDF parcial guardado (${result.bytes.length.toLocaleString()} bytes)`);
      }
    } catch (e) {
      console.log("Error fetch:", e);
    }
  }

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
