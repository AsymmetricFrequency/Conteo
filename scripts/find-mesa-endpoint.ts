/**
 * Navega el SPA de la Registraduría, hace clic en elementos de la lista
 * hasta llegar a nivel de PUESTO/MESA e intercepta los endpoints JSON.
 *
 * Uso: pnpm tsx scripts/find-mesa-endpoint.ts
 */
import { chromium, type Page } from "playwright";
import { writeFileSync } from "node:fs";

const BASE = "https://resultados.registraduria.gov.co";

const capturedUrls = new Map<string, unknown>();

async function attachCapture(page: Page) {
  page.on("response", async (response) => {
    const url = response.url();
    const ct = response.headers()["content-type"] ?? "";
    if (!ct.includes("json") || capturedUrls.has(url)) return;
    try {
      const body = await response.json();
      capturedUrls.set(url, body);
      const path = url.replace(BASE, "");
      if (path.includes("/json/") || path.includes("/v2/")) {
        console.log(`  [JSON] ${path}`);
      }
    } catch {
      /* skip */
    }
  });
}

async function clickFirst(page: Page, selector: string, label: string) {
  try {
    await page.waitForSelector(selector, { timeout: 8000 });
    const items = page.locator(selector);
    const count = await items.count();
    console.log(`  → ${count} elementos "${label}" encontrados`);
    if (count > 0) {
      await items.first().click();
      await page.waitForTimeout(3000);
      return true;
    }
  } catch (e) {
    console.log(`  → No encontrado: ${selector}`);
  }
  return false;
}

async function main() {
  const browser = await chromium.launch({ headless: false }); // headless:false para ver qué pasa
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    locale: "es-CO",
    timezoneId: "America/Bogota",
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();
  attachCapture(page);

  // --- Paso 1: Página nacional ---
  console.log("\n[1] Página nacional...");
  await page.goto(`${BASE}/v2/territorios/0/00/`, {
    waitUntil: "networkidle",
    timeout: 40000,
  });
  await page.waitForTimeout(3000);

  // Snapshot del DOM inicial
  const html0 = await page.content();
  const snippet0 = html0.slice(0, 2000);
  console.log("DOM inicial (2k chars):", snippet0);

  // --- Paso 2: Encontrar la lista de departamentos y hacer clic ---
  console.log("\n[2] Buscando lista de departamentos...");
  const deptSelectors = [
    "li[data-code]",
    "li[data-id]",
    ".departamento",
    ".territory-item",
    "[class*='territorio']",
    "[class*='department']",
    "li:has(span)",
    "li > button",
    "ul > li",
    "[role='listitem']",
    "a[href*='01']",
    "a[href*='departamento']",
  ];

  let clicked = false;
  for (const sel of deptSelectors) {
    clicked = await clickFirst(page, sel, sel);
    if (clicked) {
      console.log(`  Hicimos clic con selector: ${sel}`);
      break;
    }
  }

  if (!clicked) {
    // Intentar navegar directo a Antioquia
    console.log("\n[2b] Navegando directo a Antioquia...");
    await page.goto(`${BASE}/v2/territorios/0/01/`, {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    await page.waitForTimeout(3000);
  }

  // Snapshot DOM en dept
  const htmlDept = await page.content();
  console.log("\nDOM en dept (lista de municipios):");
  // Buscar cualquier elemento de lista
  const listItems = await page.evaluate(() => {
    const items = document.querySelectorAll("li, tr, [class*='row'], [class*='item']");
    return Array.from(items)
      .slice(0, 10)
      .map((el) => ({
        tag: el.tagName,
        class: el.className.slice(0, 80),
        text: el.textContent?.trim().slice(0, 60),
        attrs: Array.from(el.attributes).map((a) => `${a.name}=${a.value}`).join(", "),
      }));
  });
  listItems.forEach((i) =>
    console.log(`  <${i.tag} class="${i.class}"> "${i.text}" | ${i.attrs}`)
  );

  // --- Paso 3: Hacer clic en Medellín (mun 01001) ---
  console.log("\n[3] Buscando y haciendo clic en Medellín...");
  const munSelectors = [
    "li[data-code='01001']",
    "li[data-municipio='01001']",
    "a[href*='01001']",
    "li:has-text('MEDELLÍN')",
    "li:has-text('Medellín')",
    "li:has-text('MEDELLIN')",
    "[class*='municipio']:has-text('Medellín')",
    "tr:has-text('Medellín')",
  ];

  let clickedMun = false;
  for (const sel of munSelectors) {
    try {
      const el = page.locator(sel).first();
      if ((await el.count()) > 0) {
        await el.click();
        console.log(`  Clic en Medellín con: ${sel}`);
        await page.waitForTimeout(3000);
        clickedMun = true;
        break;
      }
    } catch {
      /* skip */
    }
  }

  if (!clickedMun) {
    console.log("\n[3b] Navegando directo a Medellín...");
    await page.goto(`${BASE}/v2/territorios/0/01001/`, {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    await page.waitForTimeout(3000);
  }

  // --- Paso 4: Inspeccionar DOM en nivel municipio y hacer clic en primera zona ---
  console.log("\n[4] En Medellín — buscando zonas...");
  const domMun = await page.evaluate(() => {
    const all = document.querySelectorAll("li, tr, [class*='zona'], [class*='zone'], button");
    return Array.from(all)
      .slice(0, 20)
      .map((el) => ({
        tag: el.tagName,
        class: el.className.slice(0, 100),
        text: el.textContent?.trim().slice(0, 60),
        attrs: Array.from(el.attributes).map((a) => `${a.name}=${a.value}`).join(", "),
      }));
  });
  domMun.forEach((i) =>
    console.log(`  <${i.tag} class="${i.class}"> "${i.text}" | ${i.attrs}`)
  );

  // Intentar clic en primera zona
  const zonaSelectors = [
    "li[data-code]",
    "[class*='zona']",
    "[class*='zone']",
    "li:has-text('Zona')",
    "li:has-text('ZONA')",
    "ul > li",
    "tr",
  ];

  for (const sel of zonaSelectors) {
    const clicked4 = await clickFirst(page, sel, sel);
    if (clicked4) {
      console.log(`  Clic en zona con: ${sel}`);
      break;
    }
  }

  // --- Paso 5: Buscar puestos y hacer clic ---
  console.log("\n[5] Buscando puestos...");
  const domZona = await page.evaluate(() => {
    const all = document.querySelectorAll("li, tr, [class*='puesto'], [class*='position']");
    return Array.from(all)
      .slice(0, 20)
      .map((el) => ({
        tag: el.tagName,
        class: el.className.slice(0, 100),
        text: el.textContent?.trim().slice(0, 60),
        attrs: Array.from(el.attributes).map((a) => `${a.name}=${a.value}`).join(", "),
      }));
  });
  domZona.forEach((i) =>
    console.log(`  <${i.tag} class="${i.class}"> "${i.text}" | ${i.attrs}`)
  );

  // Clic en primer puesto
  for (const sel of ["li[data-code]", "[class*='puesto']", "ul > li", "tr"]) {
    const clicked5 = await clickFirst(page, sel, sel);
    if (clicked5) {
      console.log(`  Clic en puesto con: ${sel}`);
      break;
    }
  }

  // --- Paso 6: Captura final - mesas ---
  console.log("\n[6] Buscando mesas...");
  await page.waitForTimeout(3000);

  const currentUrl = page.url();
  console.log("URL actual:", currentUrl);

  // Listar todos los endpoints JSON capturados hasta ahora
  console.log("\n\n=== TODOS LOS ENDPOINTS JSON CAPTURADOS ===");
  const actData: Record<string, unknown> = {};
  for (const [url, data] of capturedUrls) {
    const path = url.replace(BASE, "");
    if (path.includes("/json/") || path.includes("/v2/")) {
      console.log("\n→", path);
      const dataStr = JSON.stringify(data, null, 2);
      console.log(dataStr.slice(0, 400));
      actData[path] = data;
    }
  }

  await browser.close();

  writeFileSync(
    "/tmp/mesa-endpoints.json",
    JSON.stringify({ urls: [...capturedUrls.keys()], data: actData }, null, 2)
  );
  console.log("\nGuardado en /tmp/mesa-endpoints.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
