/**
 * 1. Descarga el bundle JS de la SPA para encontrar el bucket S3
 * 2. Hace clic correcto en "Ver" de la mesa 1 y captura la URL del PDF
 * 3. Descarga allTransmissionCodes.json completo
 */
import { firefox } from "playwright";
import { writeFileSync, readFileSync, existsSync } from "node:fs";

const BASE = "https://e14segundavueltapresidente.registraduria.gov.co";

async function selectOption(page: import("playwright").Page, placeholderFragment: string, selectFirst = false, selectText = "") {
  const input = page.locator(`input.custom-input[placeholder*="${placeholderFragment}" i]`).first();
  await input.waitFor({ state: "visible", timeout: 8000 });
  await input.click();
  await page.waitForTimeout(600);

  if (selectText) {
    await input.fill(selectText.slice(0, 4));
    await page.waitForTimeout(400);
  }

  const dropdown = page.locator(".dropdown-list ul li, .options-list li");
  await dropdown.first().waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(300);

  if (selectText) {
    const opt = dropdown.filter({ hasText: new RegExp(selectText.slice(0, 8), "i") }).first();
    const c = await opt.count();
    if (c > 0) {
      await opt.click();
      return;
    }
  }

  if (selectFirst) {
    const allOpts = await dropdown.allTextContents();
    console.log(`    Opciones (${allOpts.length}): ${allOpts.slice(0, 5).join(", ")}`);
    await dropdown.first().click();
  }
}

async function main() {
  const browser = await firefox.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:125.0) Gecko/20100101 Firefox/125.0",
    locale: "es-CO",
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  let awsCreds: { AccessKeyId: string; SecretKey: string; SessionToken: string; Expiration: number } | null = null;
  const capturedRequests: Array<{ url: string; method: string }> = [];
  let transmissionCodesData: unknown = null;

  page.on("request", (req) => {
    const url = req.url();
    if (!url.includes("recaptcha") && !url.includes("google") && !url.includes(".css") && !url.includes(".woff") && !url.includes(".png") && !url.includes(".jpg") && !url.includes(".svg") && !url.includes("boomerang")) {
      capturedRequests.push({ url: url.replace(BASE, ""), method: req.method() });
    }
  });

  page.on("response", async (res) => {
    const url = res.url();
    const ct = res.headers()["content-type"] ?? "";

    if (ct.includes("json") || url.endsWith(".json")) {
      try {
        const body = await res.json();
        if (url.includes("cognito") && typeof body === "object" && body !== null && "Credentials" in body) {
          awsCreds = (body as Record<string, unknown>).Credentials as typeof awsCreds;
          console.log("  [COGNITO] ✓");
        }
        if (url.includes("allTransmissionCodes")) {
          transmissionCodesData = body;
          const s = JSON.stringify(body);
          writeFileSync("/tmp/e14-allTransmissionCodes.json", s);
          console.log(`  [TRANSMISSION] allTransmissionCodes.json (${s.length.toLocaleString()} chars)`);
          const d = body as Record<string, unknown>;
          const nodes = ((d.data as Record<string, unknown>)?.status3 as Record<string, unknown>)?.nodes as Record<string, unknown>[];
          if (nodes) {
            console.log(`    Total nodos: ${nodes.length}`);
            console.log(`    Primer PDF: ${nodes[0]?.expectedName}`);
            console.log(`    idStand[0]: ${nodes[0]?.idStand}`);
          }
        }
      } catch { /**/ }
    }
    // Capturar cualquier URL de PDF o S3
    if (url.includes(".pdf") || url.includes("s3.amazonaws") || url.includes("cloudfront.net") || ct.includes("pdf")) {
      console.log(`\n  *** PDF/S3 FOUND: ${url} ***\n`);
      writeFileSync("/tmp/e14-pdf-url.txt", url);
    }
  });

  // Cargar departamento 11 (Cauca - usado antes, tiene el formulario con datos)
  console.log("=== Cargando departamento/11 ===");
  await page.goto(`${BASE}/departamento/11`, { waitUntil: "networkidle", timeout: 40000 });
  await page.waitForTimeout(3000);

  // Descargar el bundle JS para buscar el bucket S3
  console.log("\n=== Buscando bundle JS principal ===");
  const scripts = await page.evaluate(() =>
    Array.from(document.querySelectorAll("script[src]")).map(s => (s as HTMLScriptElement).src)
  );
  console.log("Scripts encontrados:", scripts.map(s => s.replace(BASE, "")).join(", "));

  // El bundle principal generalmente se llama main.*.js
  const mainBundle = scripts.find(s => s.includes("main") && s.endsWith(".js")) ??
                     scripts.find(s => s.endsWith(".js")) ??
                     scripts[0];

  if (mainBundle) {
    console.log(`\nDescargando: ${mainBundle.replace(BASE, "")}`);
    const bundleText = await page.evaluate(async (url) => {
      const r = await fetch(url);
      return r.ok ? r.text() : "";
    }, mainBundle);

    if (bundleText.length > 500) {
      writeFileSync("/tmp/e14-main-bundle.js", bundleText);
      console.log(`  Bundle: ${bundleText.length.toLocaleString()} chars`);

      // Buscar S3 bucket y región
      const searches = [
        { label: "S3 bucket URLs", re: /https?:\/\/[a-z0-9._-]+\.s3[.\-a-z0-9-]*amazonaws\.com[^"'`\s]{0,100}/g },
        { label: "CloudFront", re: /https?:\/\/[a-z0-9._-]+\.cloudfront\.net[^"'`\s]{0,100}/g },
        { label: "bucket name", re: /[Bb]ucket[Nn]ame\s*[:=]\s*["'`]([^"'`]{3,60})["'`]/g },
        { label: "S3 bucket var", re: /["'`]([a-z0-9][a-z0-9-]{5,40}-(?:bucket|acta|e14|form|registr)[a-z0-9-]*)["'`]/gi },
        { label: "presign/getObject", re: /(getSignedUrl|presign|getObject|putObject)[^"'`]{0,200}/g },
        { label: "region AWS", re: /us-east-[12]|sa-east-1|us-west-[12]/g },
        { label: "S3 key prefix", re: /["'`]([a-z0-9/._-]{3,60}\/[a-f0-9]{40,}\.pdf)["'`]/g },
        { label: "PDF base URL", re: /https?:\/\/[^"'`\s]{10,100}\/[a-f0-9]{40,}\.pdf/g },
        { label: "getFile/downloadFile", re: /(getFile|downloadFile|getUrl|fileUrl)[^"'`]{0,200}/g },
        { label: "allTransmission", re: /allTransmission[^"'`]{0,200}/g },
      ];

      for (const { label, re } of searches) {
        const matches = [...new Set([...bundleText.matchAll(re)].map(m => m[0].trim()))];
        if (matches.length > 0) {
          console.log(`\n  ${label}:`);
          matches.slice(0, 5).forEach(m => console.log(`    ${m.slice(0, 120)}`));
        }
      }
    }
  }

  // Seleccionar Municipio (primero disponible)
  console.log("\n=== Seleccionando Municipio (primer disponible) ===");
  await selectOption(page, "municipio", true);

  // Seleccionar Zona
  console.log("=== Seleccionando Zona ===");
  await selectOption(page, "zona", true);

  // Seleccionar Puesto
  console.log("=== Seleccionando Puesto ===");
  await selectOption(page, "puesto", true);

  // Clic en Consultar
  console.log("\n=== Consultando mesas ===");
  const consultarBtn = page.locator("button").filter({ hasText: /^Consultar$/ }).first();
  const btnOk = await consultarBtn.count();
  if (btnOk === 0) {
    // Probar con texto parcial
    const btn2 = page.locator("button:has-text('Consultar')").first();
    await btn2.click();
  } else {
    await consultarBtn.click();
  }
  await page.waitForTimeout(5000);

  // Debería haber cargado allTransmissionCodes.json
  console.log(`\nallTransmissionCodes.json capturado: ${transmissionCodesData ? "✓" : "✗"}`);

  // Ver mesas disponibles
  const mesaList = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("h3"))
      .filter(h => h.textContent?.includes("Mesa"))
      .map(h => h.textContent?.trim());
  });
  console.log(`Mesas visibles: ${mesaList.length}`, mesaList);

  // Hacer clic en "Ver" de la primera mesa (NO "Volver a inicio")
  console.log("\n=== Clicando 'Ver' en Mesa 1 ===");
  const allButtons = await page.locator("button").allTextContents();
  console.log("Todos los botones:", allButtons.map(t => `"${t.trim()}"`).join(", "));

  // Buscar el botón "Ver" que NO sea "Volver a inicio"
  const verBtns = page.locator("button").filter({ hasText: /^[\s]*Ver[\s]*$/ });
  const verCount = await verBtns.count();
  console.log(`Botones "Ver": ${verCount}`);

  if (verCount > 0) {
    // Capturar requests antes del clic
    const reqsBefore = capturedRequests.length;

    await verBtns.first().click();
    console.log("  Clic en Ver mesa 1...");
    await page.waitForTimeout(6000);

    // Ver nuevos requests
    const newReqs = capturedRequests.slice(reqsBefore);
    console.log("\nNuevos requests después del clic en Ver:");
    newReqs.forEach(r => console.log(`  ${r.method} ${r.url}`));

    // Guardar HTML después del clic
    const htmlAfterVer = await page.content();
    writeFileSync("/tmp/e14-after-ver.html", htmlAfterVer);

    // Buscar modal o iframe con el PDF
    const modalInfo = await page.evaluate(() => {
      const modals = document.querySelectorAll("[class*='modal'], [class*='overlay'], [class*='pdf'], dialog, .pdf-body, .pdf-header");
      const iframes = document.querySelectorAll("iframe");
      const pdfEmbeds = document.querySelectorAll("embed[type*='pdf'], object[type*='pdf']");
      const imgs = document.querySelectorAll("img[src*='.pdf'], img[src*='s3'], img[src*='amazonaws']");

      return {
        modals: Array.from(modals).map(el => ({
          tag: el.tagName, class: el.className.slice(0, 60),
          visible: (el as HTMLElement).offsetWidth > 0,
          text: el.textContent?.trim().slice(0, 100),
          src: (el as HTMLIFrameElement).src ?? ""
        })).filter(m => m.visible),
        iframes: Array.from(iframes).map(el => ({ src: el.src, class: el.className.slice(0, 40) })),
        pdfEmbeds: Array.from(pdfEmbeds).map(el => ({ src: (el as HTMLEmbedElement).src ?? "", data: (el as HTMLObjectElement).data ?? "" })),
        imgs: Array.from(imgs).map(el => ({ src: (el as HTMLImageElement).src })),
      };
    });
    console.log("\nModal/PDF info:");
    console.log("Modals visibles:", JSON.stringify(modalInfo.modals.slice(0, 3), null, 2));
    console.log("Iframes:", JSON.stringify(modalInfo.iframes.slice(0, 3), null, 2));
    console.log("PDF embeds:", JSON.stringify(modalInfo.pdfEmbeds, null, 2));
    console.log("Imgs S3:", JSON.stringify(modalInfo.imgs, null, 2));

    // Si hay un modal visible con el PDF, hacer screenshot
    if (modalInfo.modals.length > 0 || modalInfo.iframes.length > 0) {
      writeFileSync("/tmp/e14-after-ver-screenshot.png", await page.screenshot({ fullPage: true }));
      console.log("\nScreenshot guardado: /tmp/e14-after-ver-screenshot.png");
    }
  }

  // También hacer clic en el botón de descarga (div.open-pdf)
  console.log("\n=== Clicando botón de descarga (div.open-pdf) ===");
  const downloadBtns = page.locator(".open-pdf");
  const dlCount = await downloadBtns.count();
  console.log(`Botones de descarga: ${dlCount}`);
  if (dlCount > 0) {
    const reqsBefore2 = capturedRequests.length;
    await downloadBtns.first().click();
    await page.waitForTimeout(5000);
    const newReqs2 = capturedRequests.slice(reqsBefore2);
    console.log("Nuevos requests (descarga):");
    newReqs2.forEach(r => console.log(`  ${r.method} ${r.url}`));
  }

  // Verificar si el PDF está en /tmp
  if (existsSync("/tmp/e14-pdf-url.txt")) {
    console.log("\n*** PDF URL ENCONTRADA ***");
    console.log(readFileSync("/tmp/e14-pdf-url.txt", "utf8"));
  }

  console.log("\n=== TODOS LOS REQUESTS CAPTURADOS ===");
  capturedRequests.forEach(r => console.log(`  ${r.method} ${r.url}`));

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
