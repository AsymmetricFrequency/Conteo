/**
 * Extrae cookies/headers de sesión del portal E-14 y prueba descargar PDFs
 * sin depender del browser para cada acta.
 *
 * Si las cookies son suficientes → podemos usar undici/node-fetch para masivo.
 * Si no → usamos workers paralelos de Playwright.
 */
import { firefox } from "playwright";
import { writeFileSync } from "node:fs";

const BASE = "https://e14segundavueltapresidente.registraduria.gov.co";
const TEST_PDF = `${BASE}/assets/temis/pdf/11/004/000/00/001/PRE/38431c66766f4b554f88648f0971cd813cd3b22535f2e92399739fa954c17926.pdf`;

async function main() {
  const browser = await firefox.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:125.0) Gecko/20100101 Firefox/125.0",
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  // Capturar los headers exactos que el browser usa para el PDF
  let pdfRequestHeaders: Record<string, string> = {};
  let pdfResponseHeaders: Record<string, string> = {};

  page.on("request", (req) => {
    if (req.url().includes("/assets/temis/pdf/")) {
      pdfRequestHeaders = req.headers();
      console.log("\n[REQ HEADERS para PDF]:");
      Object.entries(pdfRequestHeaders).forEach(([k, v]) => {
        console.log(`  ${k}: ${v.slice(0, 80)}`);
      });
    }
  });

  page.on("response", async (res) => {
    if (res.url().includes("/assets/temis/pdf/")) {
      pdfResponseHeaders = res.headers();
    }
  });

  // Cargar portal y hacer la navegación para obtener la sesión
  console.log("=== Estableciendo sesión ===");
  await page.goto(`${BASE}/home`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(2000);

  // Extraer cookies del contexto
  const cookies = await context.cookies([BASE]);
  console.log(`\nCookies (${cookies.length}):`);
  cookies.forEach(c => console.log(`  ${c.name}: ${c.value.slice(0, 40)}...`));

  // Extraer storage de sesión para ver si hay tokens
  const sessionStorage = await page.evaluate(() => {
    const result: Record<string, string> = {};
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const k = window.sessionStorage.key(i)!;
      result[k] = window.sessionStorage.getItem(k)?.slice(0, 100) ?? "";
    }
    return result;
  });
  console.log(`\nsessionStorage keys: ${Object.keys(sessionStorage).join(", ")}`);

  const localStorage = await page.evaluate(() => {
    const result: Record<string, string> = {};
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)!;
      result[k] = window.localStorage.getItem(k)?.slice(0, 100) ?? "";
    }
    return result;
  });
  console.log(`localStorage keys: ${Object.keys(localStorage).join(", ")}`);

  // Ir al departamento y ejecutar el flujo para obtener el PDF interceptado
  console.log("\n=== Navegando para obtener PDF real ===");
  await page.goto(`${BASE}/departamento/11`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(2000);

  const munInput = page.locator("input.custom-input").nth(2);
  await munInput.click(); await page.waitForTimeout(400);
  await page.locator(".dropdown-list ul li, .options-list li").first().click();
  await page.waitForTimeout(400);
  const zonaInput = page.locator("input.custom-input").nth(3);
  await zonaInput.click(); await page.waitForTimeout(400);
  await page.locator(".dropdown-list ul li, .options-list li").first().click();
  await page.waitForTimeout(400);
  const puestoInput = page.locator("input.custom-input").nth(4);
  await puestoInput.click(); await page.waitForTimeout(400);
  await page.locator(".dropdown-list ul li, .options-list li").first().click();
  await page.waitForTimeout(400);

  for (const btn of await page.locator("button").all()) {
    if ((await btn.textContent())?.includes("Consultar")) { await btn.click(); break; }
  }
  await page.waitForTimeout(4000);
  for (const btn of await page.locator("button").all()) {
    if ((await btn.textContent())?.trim() === "Ver") { await btn.click(); break; }
  }
  await page.waitForTimeout(4000);

  // Ahora intentar descargar PDF directamente con el contexto
  console.log("\n=== Descargando otro PDF directamente (mismo contexto) ===");
  const testResult = await page.evaluate(async (url) => {
    const r = await fetch(url, { credentials: "include" });
    const ab = await r.arrayBuffer();
    return {
      status: r.status,
      ct: r.headers.get("content-type"),
      size: ab.byteLength,
      header: Array.from(new Uint8Array(ab.slice(0, 8))).map(b => String.fromCharCode(b)).join(""),
    };
  }, `${BASE}/assets/temis/pdf/13/061/001/00/043/PRE/83f511d10e86e1d0330a5b485b8aded785b524fb5956f0bbfae3e10ddd095ce8.pdf`);

  console.log("Test PDF #2:", testResult);

  // Guardar sesión completa
  const sessionData = {
    cookies,
    pdfRequestHeaders,
    pdfResponseHeaders,
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:125.0) Gecko/20100101 Firefox/125.0",
  };
  writeFileSync("/tmp/e14-session.json", JSON.stringify(sessionData, null, 2));
  console.log("\nSesión guardada en /tmp/e14-session.json");

  // Intentar usar undici/node:https directamente con las cookies del browser
  console.log("\n=== Probando descarga directa con node:https ===");
  const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join("; ");
  const https = await import("node:https");
  await new Promise<void>((resolve) => {
    const req = https.default.get(TEST_PDF, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:125.0) Gecko/20100101 Firefox/125.0",
        "Accept": "application/pdf,*/*",
        "Referer": `${BASE}/departamento/11`,
        "Cookie": cookieStr,
      },
    }, (res) => {
      console.log(`  node:https → Status: ${res.statusCode}, CT: ${res.headers["content-type"]}`);
      let data = Buffer.alloc(0);
      res.on("data", (chunk: Buffer) => { data = Buffer.concat([data, chunk]); });
      res.on("end", () => {
        console.log(`  Size: ${data.length.toLocaleString()} bytes`);
        const h = data.slice(0, 8).toString("ascii");
        console.log(`  Header: "${h}"`);
        if (h.startsWith("%PDF")) {
          writeFileSync("/tmp/e14-acta-node-https.pdf", data);
          console.log(`  ✓ PDF descargado con node:https!`);
        }
        resolve();
      });
    });
    req.on("error", (e) => { console.log("  Error:", e.message); resolve(); });
  });

  await browser.close();
  console.log("\n=== DONE ===");
  console.log("PDF request headers:", Object.keys(pdfRequestHeaders).join(", "));
}

main().catch(e => { console.error(e); process.exit(1); });
