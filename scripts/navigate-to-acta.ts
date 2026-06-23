/**
 * Navega hasta un puesto de Medellín en el Visor E-14 e intercepta
 * la URL de la imagen del formulario E-14.
 *
 * Jerarquía de IDs descubierta:
 *   idMunicipality = municipalityCode(3) + deptCode(2)   → "00101" (Medellín)
 *   idZone         = zoneCode(2) + idMunicipality(5)      → "1000101" (zona 10)
 *   idStand        = standCode(2) + idZone(7)             → "011000101" (puesto 01)
 */
import { firefox } from "playwright";
import { writeFileSync } from "node:fs";

const BASE = "https://e14segundavueltapresidente.registraduria.gov.co";

async function main() {
  const browser = await firefox.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:125.0) Gecko/20100101 Firefox/125.0",
    locale: "es-CO",
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  const allJson: Record<string, unknown> = {};
  const allImgs: string[] = [];
  let awsCredentials: { AccessKeyId?: string; SecretKey?: string; SessionToken?: string } | null = null;

  page.on("response", async (res) => {
    const url = res.url();
    const ct = res.headers()["content-type"] ?? "";

    if (ct.includes("json") || url.endsWith(".json")) {
      try {
        const body = await res.json();
        allJson[url] = body;
        // Capturar credenciales AWS Cognito
        if (url.includes("cognito") && (body as Record<string, unknown>).Credentials) {
          awsCredentials = (body as { Credentials: typeof awsCredentials }).Credentials;
          console.log("  [COGNITO] Credenciales AWS capturadas!");
        }
        const path = url.replace(BASE, "");
        if (!path.includes("main.json") && !path.includes("CorpIndex") && !path.includes("allDept") && !path.includes("allCorp") && !path.includes("Progress")) {
          console.log(`  [JSON] ${path}: ${JSON.stringify(body).slice(0, 150)}`);
        }
      } catch { /**/ }
    }

    if (url.includes("s3.amazonaws") || url.includes("s3-") || url.includes("cloudfront.net") ||
        ct.includes("image") || url.includes(".jpg") || url.includes(".jpeg") || url.includes(".pdf")) {
      allImgs.push(url);
      console.log(`  [IMG/S3] ${url}`);
    }
  });

  // 1. Home
  console.log("\n=== Home ===");
  await page.goto(`${BASE}/home`, { waitUntil: "networkidle", timeout: 40000 });
  await page.waitForTimeout(2000);

  // 2. Navegar a Antioquia
  console.log("\n=== /departamento/01 ===");
  await page.goto(`${BASE}/departamento/01`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(4000);
  writeFileSync("/tmp/e14-dept01-full.html", await page.content());

  // Ver elementos clickables
  const deptItems = await page.evaluate(() =>
    Array.from(document.querySelectorAll("a, button, li, [class*='municipio'], [class*='muni'], [class*='item'], [class*='card'], [routerLink]"))
      .filter(el => el.textContent?.trim() && (el as HTMLElement).offsetWidth > 0)
      .slice(0, 20)
      .map(el => ({
        tag: el.tagName,
        text: el.textContent?.trim().slice(0, 50),
        href: (el as HTMLAnchorElement).href ?? "",
        class: el.className.slice(0, 80),
        routerLink: el.getAttribute("routerlink") ?? el.getAttribute("ng-reflect-router-link") ?? "",
        ngClick: el.getAttribute("(click)") ?? "",
      }))
  );
  console.log("Items en dept:");
  deptItems.forEach(i => console.log(`  <${i.tag} routerLink="${i.routerLink}"> "${i.text}" href=${i.href}`));

  // 3. Intentar navegar a Medellín
  // La URL interna del portal: /departamento/01/municipio/001 (usando municipalityCode)
  const munUrls = [
    `${BASE}/departamento/01/municipio/001`,      // municipalityCode=001
    `${BASE}/departamento/01/municipio/00101`,    // idMunicipality
    `${BASE}/departamento/01/municipio/01001`,    // DIVIPOLA
  ];

  let workingMunUrl = "";
  for (const url of munUrls) {
    console.log(`\n=== Probando ${url} ===`);
    await page.goto(url, { waitUntil: "networkidle", timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(3000);
    const finalUrl = page.url();
    const title = await page.title().catch(() => "");
    const bodyText = await page.evaluate(() => document.body.innerText?.slice(0, 200));
    console.log(`  Final: ${finalUrl}, title: "${title}"`);
    console.log(`  Body: ${bodyText?.replace(/\s+/g, " ")}`);
    if (!finalUrl.includes("error") && finalUrl.includes(BASE)) {
      workingMunUrl = url;
      break;
    }
  }

  if (workingMunUrl) {
    // 4. Buscar la primera zona y navegar
    const munItems = await page.evaluate(() =>
      Array.from(document.querySelectorAll("a[href], [routerLink], button"))
        .filter(el => {
          const href = (el as HTMLAnchorElement).href ?? "";
          const rl = el.getAttribute("routerlink") ?? el.getAttribute("ng-reflect-router-link") ?? "";
          return href.includes("/zona/") || rl.includes("/zona/") || href.includes("/puesto/") || rl.includes("/puesto/");
        })
        .slice(0, 5)
        .map(el => ({
          href: (el as HTMLAnchorElement).href ?? el.getAttribute("routerlink") ?? "",
          text: el.textContent?.trim().slice(0, 50)
        }))
    );
    console.log("\nLinks de zona/puesto:", munItems);
  }

  // 5. Probar URL de zona directamente
  console.log("\n=== Probando zona de Medellín ===");
  const zonaUrls = [
    `${BASE}/departamento/01/municipio/001/zona/10`,     // zona 10 (primera de Medellín)
    `${BASE}/departamento/01/municipio/001/zona/1000101`, // idZone
    `${BASE}/departamento/01/municipio/00101/zona/10`,
  ];

  for (const url of zonaUrls) {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(3000);
    const finalUrl = page.url();
    const body = await page.evaluate(() => document.body.innerText?.slice(0, 100));
    console.log(`  ${url.replace(BASE, "")} → ${finalUrl.replace(BASE, "")} | ${body?.replace(/\s+/g, " ").slice(0, 80)}`);
    if (!finalUrl.includes("error") && body && body.length > 50 && !body.includes("404")) {
      console.log("  ✓ FUNCIONA!");
      break;
    }
  }

  // 6. Navegar directo al puesto
  console.log("\n=== Probando puesto de Medellín ===");
  const puestoUrls = [
    `${BASE}/departamento/01/municipio/001/zona/10/puesto/01`,
    `${BASE}/departamento/01/municipio/001/zona/10/puesto/011000101`,
    `${BASE}/departamento/01/municipio/00101/zona/10/puesto/01`,
  ];

  for (const url of puestoUrls) {
    await page.goto(url, { waitUntil: "networkidle", timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(5000);
    const finalUrl = page.url();
    const bodyText = await page.evaluate(() => document.body.innerText?.slice(0, 300));
    console.log(`\n  ${url.replace(BASE, "")}`);
    console.log(`  → ${finalUrl.replace(BASE, "")}`);
    console.log(`  Contenido: ${bodyText?.replace(/\s+/g, " ").slice(0, 150)}`);

    // Ver nuevos JSON cargados en el puesto
    const puestoJsons = Object.keys(allJson).filter(k =>
      !k.includes("/assets/") && !k.includes("cognito")
    );
    puestoJsons.slice(-5).forEach(k => {
      console.log(`  [JSON NEW] ${k.replace(BASE, "")}: ${JSON.stringify(allJson[k]).slice(0, 200)}`);
    });

    // Botones para ver la acta
    const actaBtns = await page.evaluate(() =>
      Array.from(document.querySelectorAll("a, button, [class*='acta'], [class*='mesa'], [class*='ver'], [class*='version']"))
        .filter(el => (el as HTMLElement).offsetWidth > 0)
        .slice(0, 20)
        .map(el => ({
          tag: el.tagName, text: el.textContent?.trim().slice(0, 60),
          href: (el as HTMLAnchorElement).href ?? "", class: el.className.slice(0, 60)
        }))
    );
    if (actaBtns.length > 0) {
      console.log("  Botones de acta:");
      actaBtns.forEach(b => console.log(`    "${b.text}" href=${b.href}`));

      // Clic en el primer botón de acta/versión
      const versBtn = actaBtns.find(b => b.text?.toLowerCase().includes("ver") || b.text?.toLowerCase().includes("acta") || b.text?.toLowerCase().includes("mesa"));
      if (versBtn && versBtn.href && versBtn.href !== `${BASE}/` && versBtn.href !== "") {
        console.log(`  \n  *** Clicando en: "${versBtn.text}" → ${versBtn.href} ***`);
        await page.click(`a[href*="${versBtn.href.replace(BASE, "")}"], button`).catch(() => {});
        await page.waitForTimeout(5000);
        console.log("  Imágenes S3 después del clic:", allImgs);
      }
    }

    if (allImgs.length > 0) {
      console.log("\n  *** IMÁGENES E-14 ENCONTRADAS ***");
      allImgs.forEach(u => console.log(`  ${u}`));
      break;
    }
  }

  // 7. Guardar credenciales AWS y resumen
  writeFileSync("/tmp/e14-aws-creds.json", JSON.stringify(awsCredentials, null, 2));
  writeFileSync("/tmp/e14-all-imgs.json", JSON.stringify(allImgs, null, 2));
  writeFileSync("/tmp/e14-nav-json.json", JSON.stringify(
    Object.fromEntries(Object.entries(allJson).filter(([k]) => !k.includes("/assets/") && !k.includes("cognito"))),
    null, 2
  ));

  console.log(`\n\n=== RESUMEN ===`);
  console.log(`Imágenes capturadas: ${allImgs.length}`);
  console.log(`JSON no-estáticos: ${Object.keys(allJson).filter(k => !k.includes("/assets/") && !k.includes("cognito")).length}`);
  console.log(`AWS Credentials: ${awsCredentials ? "✓ capturadas" : "✗ no capturadas"}`);

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
