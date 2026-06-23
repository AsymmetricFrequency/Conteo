/**
 * Captura los chunks JS dinámicos del SPA y el URL real del PDF E-14.
 * - Intercepta todos los .js durante la navegación
 * - Navega departamento/11 → selecciona municipio/zona/puesto → Consultar → Ver
 * - Captura el src del iframe/embed con el PDF
 */
import { firefox } from "playwright";
import { writeFileSync } from "node:fs";

const BASE = "https://e14segundavueltapresidente.registraduria.gov.co";

async function main() {
  const browser = await firefox.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:125.0) Gecko/20100101 Firefox/125.0",
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  const capturedJS: Record<string, string> = {};
  const pdfUrls: string[] = [];
  let awsCreds: Record<string, unknown> | null = null;
  const allResponseUrls: string[] = [];

  page.on("response", async (res) => {
    const url = res.url();
    const ct = res.headers()["content-type"] ?? "";
    allResponseUrls.push(`[${res.status()}] ${ct.split(";")[0].trim()} ${url.replace(BASE, "")}`);

    if ((ct.includes("javascript") || url.match(/\/chunk-|\/main-|\/polyfill/)) && !url.includes("recaptcha") && !url.includes("gstatic")) {
      try {
        const text = await res.text();
        const key = url.replace(BASE, "");
        capturedJS[key] = text;
        console.log(`  [JS] ${key} (${text.length.toLocaleString()})`);
      } catch { /**/ }
    }

    if (ct.includes("json") || url.endsWith(".json")) {
      try {
        const body = await res.json();
        if (url.includes("cognito") && typeof body === "object" && body !== null && "Credentials" in body) {
          awsCreds = (body as Record<string, unknown>).Credentials as Record<string, unknown>;
          console.log("  [COGNITO] ✓");
        }
      } catch { /**/ }
    }

    if (url.includes(".pdf") || ct.includes("pdf") || ct.includes("octet-stream")) {
      pdfUrls.push(`${url} [${ct}]`);
      console.log(`\n*** PDF/BINARY: ${url} [${ct}] ***\n`);
    }
  });

  // Página de init-config.js (cargar como fetch desde Firefox para evitar CDN block)
  console.log("=== Cargando home ===");
  await page.goto(`${BASE}/home`, { waitUntil: "networkidle", timeout: 40000 });
  await page.waitForTimeout(1000);

  const initConfig = await page.evaluate(async (base) => {
    try {
      const r = await fetch(`${base}/assets/js/init-config.js`);
      return r.ok ? r.text() : `ERROR ${r.status}`;
    } catch (e) { return `FETCH ERROR: ${e}`; }
  }, BASE);
  console.log("\ninit-config.js:");
  console.log(initConfig.slice(0, 2000));
  writeFileSync("/tmp/e14-init-config.js", initConfig);

  // Navegar a departamento para cargar los chunks del módulo de departamento
  console.log("\n=== Navegando a departamento/11 ===");
  await page.goto(`${BASE}/departamento/11`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(3000);

  // Seleccionar municipio (primer disponible)
  console.log("=== Seleccionando Municipio ===");
  const munInput = page.locator("input.custom-input").nth(2); // índice 2 = municipio
  await munInput.click();
  await page.waitForTimeout(600);
  const munOpts = await page.locator(".dropdown-list ul li, .options-list li").all();
  console.log(`  Municipios: ${munOpts.length}`);
  if (munOpts.length > 0) {
    await munOpts[0].click();
    await page.waitForTimeout(600);
  }

  console.log("=== Seleccionando Zona ===");
  const zonaInput = page.locator("input.custom-input").nth(3);
  await zonaInput.click();
  await page.waitForTimeout(600);
  const zonaOpts = await page.locator(".dropdown-list ul li, .options-list li").all();
  if (zonaOpts.length > 0) {
    await zonaOpts[0].click();
    await page.waitForTimeout(600);
  }

  console.log("=== Seleccionando Puesto ===");
  const puestoInput = page.locator("input.custom-input").nth(4);
  await puestoInput.click();
  await page.waitForTimeout(600);
  const puestoOpts = await page.locator(".dropdown-list ul li, .options-list li").all();
  if (puestoOpts.length > 0) {
    await puestoOpts[0].click();
    await page.waitForTimeout(600);
  }

  // Clic en Consultar con timeout extendido
  console.log("=== Clic en Consultar ===");
  const allBtns = await page.locator("button").all();
  let consultarClicked = false;
  for (const btn of allBtns) {
    const txt = await btn.textContent().catch(() => "");
    if (txt?.includes("Consultar")) {
      await btn.click();
      consultarClicked = true;
      console.log(`  Consultando...`);
      break;
    }
  }

  if (!consultarClicked) {
    console.log("  No se encontró el botón Consultar. Botones disponibles:");
    for (const btn of allBtns) {
      const txt = await btn.textContent().catch(() => "");
      console.log(`    "${txt?.trim()}"`);
    }
  }

  await page.waitForTimeout(6000);

  // Clic en Ver mesa 1
  console.log("\n=== Clic en Ver mesa 1 ===");
  const allBtns2 = await page.locator("button").all();
  let verClicked = false;
  for (const btn of allBtns2) {
    const txt = (await btn.textContent().catch(() => ""))?.trim();
    if (txt === "Ver") {
      await btn.click();
      verClicked = true;
      console.log("  Clic en Ver!");
      break;
    }
  }
  console.log(`  Ver clicked: ${verClicked}`);
  await page.waitForTimeout(10000);

  // Inspeccionar el modal
  const modalInfo = await page.evaluate(() => {
    const pdf = document.querySelector(".pdf-body");
    const allIframes = Array.from(document.querySelectorAll("iframe")).map(f => ({
      src: f.src, width: f.width, height: f.height
    }));
    const allObjects = Array.from(document.querySelectorAll("object, embed")).map(e => ({
      data: (e as HTMLObjectElement).data,
      src: (e as HTMLEmbedElement).src ?? "",
      type: (e as HTMLObjectElement).type ?? ""
    }));

    // Buscar cualquier href con PDF
    const pdfLinks = Array.from(document.querySelectorAll("a[href*='.pdf'], a[href*='s3'], a[href*='amazonaws']")).map(a => ({
      href: (a as HTMLAnchorElement).href,
      text: a.textContent?.trim()
    }));

    return {
      pdfBodyHtml: pdf?.innerHTML?.slice(0, 800) ?? "no .pdf-body",
      iframes: allIframes,
      objects: allObjects,
      pdfLinks,
      bodyText: document.body.innerText.slice(0, 500),
    };
  });

  console.log("\n=== Modal info ===");
  console.log("pdf-body HTML:", modalInfo.pdfBodyHtml.slice(0, 400));
  console.log("Iframes:", JSON.stringify(modalInfo.iframes, null, 2));
  console.log("Objects:", JSON.stringify(modalInfo.objects, null, 2));
  console.log("PDF Links:", JSON.stringify(modalInfo.pdfLinks, null, 2));

  writeFileSync("/tmp/e14-modal-html.html", await page.content());
  writeFileSync("/tmp/e14-modal-screenshot.png", await page.screenshot({ fullPage: true }));

  // Guardar todos los chunks capturados
  let allJS = "";
  for (const [path, content] of Object.entries(capturedJS)) {
    allJS += content;
  }
  writeFileSync("/tmp/e14-all-dynamic-js.js", allJS);
  console.log(`\nTotal JS capturado: ${allJS.length.toLocaleString()} chars (${Object.keys(capturedJS).length} archivos)`);

  // Analizar JS para S3
  import("node:fs").then(({ readFileSync }) => {
    const js = readFileSync("/tmp/e14-all-dynamic-js.js", "utf8");
    const searches: Array<[string, RegExp]> = [
      ["S3 URL", /https?:\/\/[a-z0-9._-]+\.s3[.\-a-z0-9-]*\.amazonaws\.com[^"'`\s]{0,80}/gi],
      ["cloudfront", /https?:\/\/[a-z0-9._-]+\.cloudfront\.net[^"'`\s]{0,80}/gi],
      ["bucket name", /bucket[A-Za-z]*\s*[=:]\s*["']([^"']{3,60})["']/gi],
      ["amazonaws", /[a-z0-9._-]{4,}\.amazonaws\.com[^"'`\s]{0,80}/gi],
      ["region", /["'](us-east-[12]|sa-east-1|us-west-[12])["']/gi],
      ["presign", /presign[A-Za-z]*[^"'`]{0,150}/gi],
      ["getObjectUrl", /getObject[A-Za-z]*[^"'`]{0,100}/gi],
      ["pdfUrl", /pdfUrl[^"'`]{0,100}/gi],
      ["s3Url", /s3Url[^"'`]{0,100}/gi],
      ["identityPool", /identityPoolId[^"'`]{0,80}/gi],
      ["cognitoPool", /us-east-[12]:[0-9a-f-]{30,}/gi],
    ];

    console.log("\n=== ANÁLISIS JS ===");
    for (const [label, re] of searches) {
      const matches = [...new Set([...js.matchAll(re)].map(m => m[0]))];
      if (matches.length > 0) {
        console.log(`\n${label}:`);
        matches.slice(0, 5).forEach(m => console.log(`  ${m.slice(0, 120)}`));
      }
    }
  });

  // Responses resumen
  console.log("\n=== RESPONSES RECIBIDAS ===");
  allResponseUrls.filter(u => !u.includes("text/css") && !u.includes(".woff") && !u.includes(".png") && !u.includes(".jpg") && !u.includes(".svg") && !u.includes("jpeg")).forEach(u => console.log(`  ${u}`));

  console.log(`\nPDF URLs: ${pdfUrls.length}`);
  pdfUrls.forEach(u => console.log(`  ${u}`));

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
