/**
 * Descarga un PDF usando la URL exacta interceptada del SPA.
 * Verifica si se necesita cookie de sesión o si la URL es suficiente.
 */
import { firefox } from "playwright";
import { writeFileSync } from "node:fs";

const BASE = "https://e14segundavueltapresidente.registraduria.gov.co";
const EXACT_PDF_URL = `${BASE}/assets/temis/pdf/11/004/000/00/001/PRE/38431c66766f4b554f88648f0971cd813cd3b22535f2e92399739fa954c17926.pdf`;

async function main() {
  const browser = await firefox.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:125.0) Gecko/20100101 Firefox/125.0",
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  // Test 1: Sin sesión previa
  console.log("=== Test 1: Sin sesión previa ===");
  const r1 = await page.evaluate(async (url) => {
    const r = await fetch(url, { headers: { "Accept": "application/pdf,*/*" } });
    const buf = await r.arrayBuffer();
    const b = new Uint8Array(buf);
    return {
      status: r.status,
      ct: r.headers.get("content-type"),
      size: buf.byteLength,
      header: String.fromCharCode(...b.slice(0, 8)),
    };
  }, EXACT_PDF_URL);
  console.log(r1);

  // Test 2: Con sesión del portal
  console.log("\n=== Test 2: Cargando home para establecer sesión ===");
  await page.goto(`${BASE}/home`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(2000);

  const r2 = await page.evaluate(async (url) => {
    const r = await fetch(url, {
      headers: {
        "Accept": "application/pdf,*/*",
        "Referer": "https://e14segundavueltapresidente.registraduria.gov.co/departamento/11",
      },
      credentials: "include",
    });
    const buf = await r.arrayBuffer();
    const b = new Uint8Array(buf);
    return {
      status: r.status,
      ct: r.headers.get("content-type"),
      size: buf.byteLength,
      header: String.fromCharCode(...b.slice(0, 8)),
    };
  }, EXACT_PDF_URL);
  console.log(r2);

  if (r2.header?.startsWith("%PDF")) {
    // Guardar el PDF
    const pdfData = await page.evaluate(async (url) => {
      const r = await fetch(url, { credentials: "include" });
      return Array.from(new Uint8Array(await r.arrayBuffer()));
    }, EXACT_PDF_URL);
    writeFileSync("/tmp/e14-acta-direct.pdf", Buffer.from(pdfData));
    console.log(`\n✓ PDF guardado: /tmp/e14-acta-direct.pdf`);
  }

  // Test 3: Navegar directamente al PDF con page.goto
  console.log("\n=== Test 3: page.goto directo ===");
  const pdfResponse = await page.goto(EXACT_PDF_URL, { timeout: 20000 });
  console.log("Status:", pdfResponse?.status(), "CT:", pdfResponse?.headers()["content-type"]);
  const content = await pdfResponse?.body();
  if (content) {
    const header = String.fromCharCode(...content.slice(0, 8));
    console.log("Header:", header, "Size:", content.length);
    if (header.startsWith("%PDF")) {
      writeFileSync("/tmp/e14-acta-goto.pdf", content);
      console.log("✓ PDF guardado via goto!");
    }
  }

  // Test 4: Verificar qué headers envía el SPA al descargar PDF
  console.log("\n=== Test 4: Interceptar headers del PDF original ===");
  const page2 = await context.newPage();
  let pdfHeaders: Record<string, string> = {};

  page2.on("response", async (res) => {
    if (res.url().includes(".pdf")) {
      pdfHeaders = res.headers();
      const body = await res.body();
      const header = String.fromCharCode(...body.slice(0, 8));
      console.log(`  PDF interceptado: ${res.url().split("/PRE/")[1]?.slice(0, 30)}`);
      console.log(`  Headers respuesta:`, pdfHeaders);
      console.log(`  Size: ${body.length}, Header: "${header}"`);
      if (header.startsWith("%PDF")) {
        writeFileSync("/tmp/e14-acta-intercepted.pdf", body);
        console.log(`  ✓ PDF guardado!`);
      }
    }
  });

  page2.on("request", (req) => {
    if (req.url().includes(".pdf")) {
      const headers = req.headers();
      console.log(`  Request headers para PDF:`, Object.entries(headers).filter(([k]) => !k.includes("sec-") && !k.includes("accept-lang")).slice(0, 10));
    }
  });

  await page2.goto(`${BASE}/departamento/11`, { waitUntil: "networkidle", timeout: 30000 });
  await page2.waitForTimeout(2000);

  // Seleccionar formulario y consultar
  const munInput = page2.locator("input.custom-input").nth(2);
  await munInput.click();
  await page2.waitForTimeout(400);
  await page2.locator(".dropdown-list ul li, .options-list li").first().click();
  await page2.waitForTimeout(400);
  const zonaInput = page2.locator("input.custom-input").nth(3);
  await zonaInput.click();
  await page2.waitForTimeout(400);
  await page2.locator(".dropdown-list ul li, .options-list li").first().click();
  await page2.waitForTimeout(400);
  const puestoInput = page2.locator("input.custom-input").nth(4);
  await puestoInput.click();
  await page2.waitForTimeout(400);
  await page2.locator(".dropdown-list ul li, .options-list li").first().click();
  await page2.waitForTimeout(400);

  const btns = await page2.locator("button").all();
  for (const b of btns) {
    const t = await b.textContent();
    if (t?.includes("Consultar")) { await b.click(); break; }
  }
  await page2.waitForTimeout(4000);

  // Ver mesa 1
  const verBtns = await page2.locator("button").all();
  for (const b of verBtns) {
    const t = (await b.textContent())?.trim();
    if (t === "Ver") { await b.click(); break; }
  }
  await page2.waitForTimeout(5000);

  // Descargar usando el botón de descarga
  const dlBtns = await page2.locator(".open-pdf").all();
  console.log(`\nBotones de descarga: ${dlBtns.length}`);
  if (dlBtns.length > 0) {
    await dlBtns[0].click();
    await page2.waitForTimeout(5000);
  }

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
