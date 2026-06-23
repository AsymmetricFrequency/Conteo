/**
 * Captura todos los chunks JS cargados al navegar el SPA y busca el bucket S3.
 * También descarga el init-config.js y analiza el source del PDF al hacer click en Ver.
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
  let awsCreds: Record<string, unknown> | null = null;
  const pdfUrls: string[] = [];

  // Interceptar TODOS los JS
  page.on("response", async (res) => {
    const url = res.url();
    const ct = res.headers()["content-type"] ?? "";

    if ((ct.includes("javascript") || url.endsWith(".js")) && !url.includes("recaptcha") && !url.includes("gstatic") && !url.includes("boomerang")) {
      try {
        const text = await res.text();
        capturedJS[url.replace(BASE, "")] = text;
      } catch { /**/ }
    }

    if (ct.includes("json") || url.endsWith(".json")) {
      try {
        const body = await res.json();
        if (url.includes("cognito") && typeof body === "object" && body !== null && "Credentials" in body) {
          awsCreds = (body as Record<string, unknown>).Credentials as Record<string, unknown>;
        }
      } catch { /**/ }
    }

    // PDF detectado
    if (url.includes(".pdf") || ct.includes("pdf")) {
      pdfUrls.push(url);
      console.log(`\n*** PDF FOUND: ${url} ***\n`);
    }
  });

  // Navegar por el SPA completo para cargar todos los chunks
  console.log("=== Cargando home ===");
  await page.goto(`${BASE}/home`, { waitUntil: "networkidle", timeout: 40000 });
  await page.waitForTimeout(2000);

  console.log("=== Cargando departamento/11 (Cauca) ===");
  await page.goto(`${BASE}/departamento/11`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(3000);

  // Seleccionar municipio, zona, puesto y consultar
  async function selectFirst(placeholder: string) {
    const input = page.locator(`input.custom-input[placeholder*="${placeholder}" i]`).first();
    await input.click().catch(() => {});
    await page.waitForTimeout(500);
    const items = page.locator(".dropdown-list ul li, .options-list li");
    await items.first().waitFor({ state: "visible", timeout: 3000 }).catch(() => {});
    await items.first().click().catch(() => {});
    await page.waitForTimeout(400);
  }

  await selectFirst("municipio");
  await selectFirst("zona");
  await selectFirst("puesto");

  console.log("=== Consultando ===");
  await page.locator("button").filter({ hasText: /^Consultar$/ }).first().click();
  await page.waitForTimeout(5000);

  // Clic en Ver mesa 1
  console.log("=== Clic en Ver mesa 1 ===");
  const verBtns = page.locator("button").filter({ hasText: /^[\s]*Ver[\s]*$/ });
  const cnt = await verBtns.count();
  console.log(`Botones Ver: ${cnt}`);
  if (cnt > 0) {
    await verBtns.first().click();
    await page.waitForTimeout(8000);

    // Examinar el DOM del modal
    const modalSrc = await page.evaluate(() => {
      // Buscar el contenido del modal PDF
      const pdfBody = document.querySelector(".pdf-body");
      const iframe = pdfBody?.querySelector("iframe");
      const embed = pdfBody?.querySelector("embed");
      const obj = pdfBody?.querySelector("object");
      const img = pdfBody?.querySelector("img[src*='s3'], img[src*='amazonaws'], img[src*='pdf']");
      const allIframes = Array.from(document.querySelectorAll("iframe")).map(f => f.src);
      const allObjects = Array.from(document.querySelectorAll("object, embed")).map(e => (e as HTMLObjectElement).data ?? (e as HTMLEmbedElement).src ?? "");

      return {
        pdfBodyHtml: pdfBody?.innerHTML?.slice(0, 500) ?? "no .pdf-body",
        iframeSrc: iframe?.src ?? "none",
        embedSrc: embed?.src ?? "none",
        objData: obj?.data ?? "none",
        imgSrc: img?.src ?? "none",
        allIframes,
        allObjects,
      };
    });

    console.log("\nModal PDF content:");
    console.log(JSON.stringify(modalSrc, null, 2));

    // Screenshot
    writeFileSync("/tmp/e14-modal-screenshot.png", await page.screenshot({ fullPage: true }));
  }

  // Guardar todos los JS capturados
  let allJS = "";
  for (const [path, content] of Object.entries(capturedJS)) {
    allJS += `/* === ${path} === */\n${content}\n`;
    console.log(`  JS: ${path} (${content.length.toLocaleString()} chars)`);
  }
  writeFileSync("/tmp/e14-all-dynamic-js.js", allJS);
  console.log(`\nTotal JS: ${allJS.length.toLocaleString()} chars → /tmp/e14-all-dynamic-js.js`);

  // Buscar S3 en el JS acumulado
  const patterns = [
    { label: "S3 URLs", re: /https?:\/\/[a-z0-9._-]+\.s3[.\-a-z0-9-]*amazonaws\.com[^"'`\s]{0,80}/gi },
    { label: "CloudFront", re: /https?:\/\/[a-z0-9._-]+\.cloudfront\.net[^"'`\s]{0,80}/gi },
    { label: "bucket", re: /bucket[A-Za-z]*['":\s]+['"]([^'"]{3,60})['"]/gi },
    { label: "amazonaws", re: /[a-z0-9._-]+\.amazonaws\.com[^"'`\s]{0,80}/gi },
    { label: "region", re: /["'](us-east-[12]|sa-east-1|us-west-[12])["']/gi },
    { label: "getSignedUrl", re: /getSignedUrl[^"'`]{0,200}/gi },
    { label: "presign", re: /presign[^"'`]{0,200}/gi },
    { label: "pdfUrl", re: /pdfUrl[^"'`]{0,100}/gi },
    { label: "fileUrl", re: /fileUrl[^"'`]{0,100}/gi },
    { label: "acta URL", re: /acta[^"'`]{0,100}url/gi },
    { label: "getObject S3", re: /GetObject|getObject[^"'`]{0,100}/g },
    { label: "apiUrl environ", re: /apiUrl["':]+\s*["']([^"']{5,80})["']/gi },
    { label: "temis", re: /temis[^"'`\s]{0,80}/gi },
    { label: "cognito Pool", re: /identityPoolId[^"'`]{0,80}/gi },
    { label: "init-config content", re: /[Cc]onfig\s*=\s*\{[^}]{0,500}\}/g },
  ];

  console.log("\n=== ANÁLISIS DEL JS ===");
  for (const { label, re } of patterns) {
    const matches = [...new Set([...allJS.matchAll(re)].map(m => m[0]))];
    if (matches.length > 0) {
      console.log(`\n  ${label} (${matches.length}):`);
      matches.slice(0, 5).forEach(m => console.log(`    ${m.slice(0, 120)}`));
    }
  }

  // Descargar init-config.js específicamente
  const initConfig = await page.evaluate(async (base) => {
    const r = await fetch(`${base}/assets/js/init-config.js`);
    return r.ok ? r.text() : "";
  }, BASE);
  if (initConfig.length > 10) {
    writeFileSync("/tmp/e14-init-config.js", initConfig);
    console.log(`\ninit-config.js: ${initConfig.length.toLocaleString()} chars`);
    console.log("Contenido:", initConfig.slice(0, 1000));
  }

  console.log(`\n=== FIN ===`);
  console.log(`PDF URLs encontradas: ${pdfUrls.length}`);
  pdfUrls.forEach(u => console.log(`  ${u}`));
  console.log(`AWS Creds: ${awsCreds ? "✓" : "✗"}`);

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
