/**
 * Descarga los archivos JSON de estructura del portal de E-14:
 *  - departmentsTree.json   → jerarquía completa dept→mun→zona→puesto→mesa
 *  - allMviewGetProgress... → progreso de publicación
 *  - Navega a un departamento para interceptar los endpoints de imágenes
 */
import { firefox } from "playwright";
import { writeFileSync } from "node:fs";

const BASE = "https://e14segundavueltapresidente.registraduria.gov.co";
const ASSETS = `${BASE}/assets/temis/divipol_json`;

async function main() {
  const browser = await firefox.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:125.0) Gecko/20100101 Firefox/125.0",
    locale: "es-CO",
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  const capturedJson: Record<string, unknown> = {};
  const capturedImgs: string[] = [];

  page.on("response", async (res) => {
    const url = res.url();
    const ct = res.headers()["content-type"] ?? "";
    if (capturedJson[url]) return;

    if (ct.includes("json") || url.endsWith(".json")) {
      try {
        const body = await res.json();
        capturedJson[url] = body;
        const path = url.replace(BASE, "");
        if (!path.includes("main.json") && !path.includes("Credentials")) {
          console.log(`  [JSON] ${path}`);
        }
      } catch { /**/ }
    }

    // Imágenes de E-14
    if (ct.includes("image") || url.includes(".jpg") || url.includes(".png") || url.includes(".pdf") || url.includes("s3.amazonaws") || url.includes("s3-") || url.includes("cloudfront")) {
      capturedImgs.push(url);
      console.log(`  [IMG] ${url.slice(0, 120)}`);
    }
  });

  // 1. Cargar home
  console.log("\n=== Cargando home ===");
  await page.goto(`${BASE}/home`, { waitUntil: "networkidle", timeout: 40000 });
  await page.waitForTimeout(2000);

  // 2. Descargar archivos de estructura directamente
  console.log("\n=== Descargando archivos de estructura ===");
  const structureFiles = [
    "allDepartments.json",
    "departmentsTree.json",
    "allMviewGetProgressByCorporations.json",
    "allMviewGetProgressByDepartmentAndCorporations.json",
    "allMviewGetProgressByMunicipalityAndCorporations.json",
    "allCorporations.json",
  ];

  for (const fname of structureFiles) {
    const url = `${ASSETS}/${fname}`;
    const data = await page.evaluate(async (u) => {
      const r = await fetch(u);
      if (!r.ok) return null;
      return r.json();
    }, url);

    if (data) {
      const outPath = `/tmp/e14-${fname}`;
      writeFileSync(outPath, JSON.stringify(data, null, 2));
      const size = JSON.stringify(data).length;
      console.log(`  ✓ ${fname} (${size.toLocaleString()} chars) → ${outPath}`);
      capturedJson[url] = data;
    } else {
      console.log(`  ✗ ${fname}`);
    }
  }

  // 3. Navegar a Antioquia para ver qué endpoint llama al seleccionar un municipio
  console.log("\n=== Navegando a Antioquia (dept 01) ===");
  await page.goto(`${BASE}/departamento/01`, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(3000);

  const deptUrl = page.url();
  console.log("URL:", deptUrl);
  const htmlDept = await page.content();
  writeFileSync("/tmp/e14-dept01.html", htmlDept);

  // Ver los nuevos JSON cargados
  const newJsons = Object.keys(capturedJson).filter(k => k.includes("01") && !k.includes("allDept") && !k.includes("allCorp"));
  console.log("Nuevos JSON para dept 01:", newJsons);
  newJsons.forEach(k => {
    const v = capturedJson[k];
    console.log(`  ${k.replace(BASE, "")}: ${JSON.stringify(v).slice(0, 300)}`);
  });

  // Links en la página del departamento (lista de municipios)
  const links = await page.evaluate(() =>
    Array.from(document.querySelectorAll("a[href]")).slice(0, 20)
      .map(a => ({ href: (a as HTMLAnchorElement).href, text: a.textContent?.trim().slice(0, 50) }))
  );
  console.log("\nLinks en /departamento/01:");
  links.forEach(l => console.log(`  "${l.text}" → ${l.href}`));

  // 4. Navegar a Medellín
  const medellinLink = links.find(l => l.text?.includes("MEDELLIN") || l.href.includes("medellin") || l.href.includes("Medellin"));
  const medellinUrl = medellinLink?.href ?? `${BASE}/departamento/01/municipio/004`;
  console.log(`\n=== Navegando a Medellín: ${medellinUrl} ===`);
  await page.goto(medellinUrl, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(3000);

  const htmlMun = await page.content();
  writeFileSync("/tmp/e14-medellin.html", htmlMun);

  const munLinks = await page.evaluate(() =>
    Array.from(document.querySelectorAll("a[href]")).slice(0, 20)
      .map(a => ({ href: (a as HTMLAnchorElement).href, text: a.textContent?.trim().slice(0, 50) }))
  );
  console.log("Links en Medellín:");
  munLinks.forEach(l => console.log(`  "${l.text}" → ${l.href}`));

  // Nuevos JSON para municipio
  const munJsons = Object.keys(capturedJson).filter(k => !newJsons.includes(k) && !structureFiles.some(f => k.includes(f)) && !k.includes("main.json") && !k.includes("Credentials") && !k.includes("cognito"));
  console.log("\nNuevos JSON para municipio:", munJsons.slice(0, 5));
  munJsons.forEach(k => {
    const v = capturedJson[k];
    console.log(`  ${k.replace(BASE, "")}: ${JSON.stringify(v).slice(0, 300)}`);
  });

  // 5. Hacer clic en un puesto para ver las actas
  console.log("\n=== Intentando navegar a zona/puesto/mesa ===");
  const firstLink = munLinks.find(l => l.href.includes(`${BASE}/`) && !l.href.includes("departamento/01") && l.href !== `${BASE}/home`);
  if (firstLink) {
    console.log(`Clic en: ${firstLink.href}`);
    await page.goto(firstLink.href, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(3000);

    const htmlZona = await page.content();
    writeFileSync("/tmp/e14-zona.html", htmlZona);

    const zonaLinks = await page.evaluate(() =>
      Array.from(document.querySelectorAll("a[href]")).slice(0, 15)
        .map(a => ({ href: (a as HTMLAnchorElement).href, text: a.textContent?.trim().slice(0, 50) }))
    );
    console.log("Links en zona:");
    zonaLinks.forEach(l => console.log(`  "${l.text}" → ${l.href}`));

    // Clic en primer puesto
    const puestoLink = zonaLinks.find(l => l.href.includes(`${BASE}/`) && l.href !== `${BASE}/home` && !l.href.includes("departamento"));
    if (puestoLink) {
      console.log(`\nNavegando a puesto: ${puestoLink.href}`);
      await page.goto(puestoLink.href, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(5000);

      const htmlPuesto = await page.content();
      writeFileSync("/tmp/e14-puesto.html", htmlPuesto);

      // Buscar botones de "Ver acta" o similar
      const actaButtons = await page.evaluate(() =>
        Array.from(document.querySelectorAll("a, button, [class*='acta'], [class*='mesa'], [class*='version']"))
          .slice(0, 20)
          .map(el => ({
            tag: el.tagName,
            text: el.textContent?.trim().slice(0, 60),
            href: (el as HTMLAnchorElement).href ?? "",
            class: el.className.slice(0, 60),
          }))
      );
      console.log("Elementos de acta en puesto:");
      actaButtons.forEach(b => console.log(`  <${b.tag} class="${b.class}"> "${b.text}" href=${b.href}`));

      // URLs de imágenes capturadas hasta ahora
      console.log("\nImágenes capturadas:", capturedImgs.length);
      capturedImgs.forEach(u => console.log(`  ${u}`));

      const puestoJsons = Object.keys(capturedJson).filter(k =>
        !newJsons.includes(k) && !munJsons.includes(k) &&
        !structureFiles.some(f => k.includes(f)) &&
        !k.includes("main.json") && !k.includes("Credentials") && !k.includes("cognito")
      );
      console.log("\nNuevos JSON en puesto:", puestoJsons.slice(0, 10));
      puestoJsons.slice(0, 5).forEach(k => {
        console.log(`  ${k.replace(BASE, "")}: ${JSON.stringify(capturedJson[k]).slice(0, 400)}`);
      });
    }
  }

  await browser.close();

  // Guardar resumen
  const summary = {
    capturedJsonUrls: Object.keys(capturedJson),
    capturedImgs,
  };
  writeFileSync("/tmp/e14-summary.json", JSON.stringify(summary, null, 2));
  console.log("\n\nResumen guardado en /tmp/e14-summary.json");
}

main().catch(e => { console.error(e); process.exit(1); });
