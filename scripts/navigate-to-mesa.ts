/**
 * Script definitivo para descubrir el endpoint de mesa.
 * Navega el SPA de la Registraduría con Playwright y hace clic
 * en la lista de territorios paso a paso hasta llegar a PUESTO.
 * Captura todos los endpoints JSON que se llaman en cada paso.
 */
import { chromium, type Page } from "playwright";
import { writeFileSync } from "node:fs";

const BASE = "https://resultados.registraduria.gov.co";
const capturedJson: Record<string, unknown> = {};

async function setupCapture(page: Page) {
  page.on("response", async (response) => {
    const url = response.url();
    const ct = response.headers()["content-type"] ?? "";
    if (!ct.includes("json") && !url.endsWith(".json")) return;
    if (capturedJson[url]) return;
    try {
      const body = await response.json();
      capturedJson[url] = body;
      const path = url.replace(BASE, "");
      if (path.includes("/json/") && !path.includes("locales")) {
        console.log(`  [CAPTURADO] ${path}`);
      }
    } catch {
      /* skip */
    }
  });
}

async function waitAndDump(page: Page, label: string) {
  await page.waitForTimeout(4000);
  console.log(`\n--- DOM en "${label}" ---`);
  const url = page.url();
  console.log(`URL actual: ${url}`);

  const items = await page.evaluate(() => {
    // Buscar todos los elementos de lista relevantes
    const selectors = [
      "[data-testid*='territorio']",
      "[data-testid*='municipio']",
      "[data-testid*='zona']",
      "[data-testid*='puesto']",
      "[data-testid*='mesa']",
      "[class*='territori']",
      "[class*='card']",
      "li[class]",
      "button[class*='item']",
      "button[class*='card']",
      "a[class*='card']",
      "a[class*='item']",
    ];

    const found: Array<{
      sel: string;
      tag: string;
      class: string;
      text: string;
      testId: string;
      href: string;
    }> = [];

    for (const sel of selectors) {
      try {
        const els = document.querySelectorAll(sel);
        if (els.length > 0 && els.length < 100) {
          Array.from(els)
            .slice(0, 5)
            .forEach((el) => {
              found.push({
                sel,
                tag: el.tagName,
                class: el.className.slice(0, 80),
                text: el.textContent?.trim().slice(0, 50) ?? "",
                testId: el.getAttribute("data-testid") ?? "",
                href: (el as HTMLAnchorElement).href ?? "",
              });
            });
        }
      } catch {
        /* skip */
      }
    }
    return found;
  });

  if (items.length > 0) {
    console.log("Elementos encontrados:");
    items.slice(0, 8).forEach((i) =>
      console.log(
        `  <${i.tag}> testid="${i.testId}" class="${i.class.slice(0, 50)}" text="${i.text}"`
      )
    );
  } else {
    console.log("  (sin elementos de lista reconocibles)");
    // Dump del body para entender el DOM
    const bodySnippet = await page.evaluate(
      () => document.body.innerHTML.slice(0, 3000)
    );
    console.log("  DOM snippet:", bodySnippet.slice(0, 500));
  }
  return items;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    locale: "es-CO",
    timezoneId: "America/Bogota",
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  await setupCapture(page);

  // 1. Cargar la URL de territorios con Antioquia seleccionado
  // El SPA route es: /territorios/$electionIndex/$scopeCode/$
  // electionIndex=0 (presidencia), scopeCode=01 (Antioquia)
  const routes = [
    `${BASE}/v2/territorios/0/01/`,       // Antioquia
    `${BASE}/v2/territorios/0/01001/`,    // Medellín
  ];

  for (const route of routes) {
    console.log(`\n=== Navegando a ${route} ===`);
    await page.goto(route, { waitUntil: "networkidle", timeout: 40000 });
    await waitAndDump(page, route);
  }

  // 2. Intentar hacer clic en el mapa o la lista de territorios
  // Buscar la sección de "territorios-list"
  console.log("\n=== Buscando la lista de territorios en Medellín ===");

  // Esperar que cargue el SPA completamente
  await page.waitForTimeout(3000);

  // Buscar el tab "Territorios" si existe
  try {
    const tabLocator = page.locator("button, [role='tab']").filter({
      hasText: /territorio/i,
    });
    const tabCount = await tabLocator.count();
    console.log(`Tabs con 'territorios': ${tabCount}`);
    if (tabCount > 0) {
      await tabLocator.first().click();
      await page.waitForTimeout(2000);
    }
  } catch (e) {
    console.log("  No hay tab de territorios");
  }

  // Obtener todos los elementos clickables relevantes
  const allClickable = await page.evaluate(() => {
    const all = document.querySelectorAll("button, a, li, [onclick]");
    return Array.from(all)
      .filter((el) => {
        const text = el.textContent?.trim() ?? "";
        const cls = el.className ?? "";
        // Filtrar elementos que parezcan territorios
        return (
          text.length > 2 &&
          text.length < 100 &&
          (cls.includes("card") ||
            cls.includes("item") ||
            cls.includes("list") ||
            cls.includes("territorio") ||
            cls.includes("zona") ||
            cls.includes("puesto") ||
            el.tagName === "LI")
        );
      })
      .slice(0, 20)
      .map((el) => ({
        tag: el.tagName,
        text: el.textContent?.trim().slice(0, 50),
        class: el.className.slice(0, 80),
        id: el.id,
        testId: el.getAttribute("data-testid"),
        rect: el.getBoundingClientRect().toJSON(),
      }));
  });

  console.log("\nElementos clickables de territorio:");
  allClickable.forEach((e) =>
    console.log(`  <${e.tag}> "${e.text}" class="${e.class.slice(0, 40)}"`)
  );

  // 3. Intentar fetch directo de códigos de zona (adivinando el patrón)
  // Si Medellín = 01001 (5 chars), probamos zona como 6,7,8,9 chars
  console.log("\n=== Probando códigos de zona/puesto (fetch directo) ===");

  const testCodes = [
    // Medellín zona 001
    "01001001",   // 8 chars
    "0100101",    // 7 chars
    "010011",     // 6 chars
    "010010",     // 6 chars
    // Antioquia zona
    "0101",       // 4 chars (dept + zona 2 chars)
    "01001001001", // 11 chars
    // Con leading zeros
    "0100101001",  // 10 chars
    "01001010010001", // 14 chars
    // DIVIPOL format: dept(2)+mun(3)+puesto(4) = 9
    "010010001",  // 9 chars = Medellín puesto 0001
    "010010002",  // 9 chars = Medellín puesto 0002
  ];

  for (const code of testCodes) {
    const result = await page.evaluate(
      async (url) => {
        const res = await fetch(url, {
          headers: { Accept: "application/json, */*" },
        });
        return { status: res.status, ok: res.ok };
      },
      `${BASE}/v2/json/ACT/PR/${code}.json`
    );
    if (result.ok) {
      console.log(`  ✓ ${code}: ${result.status}`);
    } else {
      process.stdout.write(`  ✗ ${code}: ${result.status}  `);
    }
  }

  // 4. Navegar a la URL interna del SPA para zona
  // El router tiene: /territorios/$electionIndex/$scopeCode/$
  console.log("\n\n=== Navegando SPA a nivel zona ===");
  const spaRoutes = [
    `${BASE}/v2/territorios/0/0100101/`,   // zona 01 de Medellín
    `${BASE}/v2/territorios/0/010011/`,    // alternativo
    `${BASE}/v2/territorios/0/010010/`,    // alternativo
    `${BASE}/v2/territorios/0/01001001/`,  // zona 001
    `${BASE}/v2/territorios/0/010010001/`, // puesto 0001
  ];

  for (const route of spaRoutes) {
    await page.goto(route, { waitUntil: "networkidle", timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2000);
    const curUrl = page.url();
    const isError = await page
      .locator("text=404, text=not found, text=error")
      .count()
      .catch(() => 0);
    const newJsonUrls = Object.keys(capturedJson).filter(
      (u) => u.includes("/json/") && u.includes("ACT")
    );
    console.log(`\n  Ruta: ${route}`);
    console.log(`  URL real: ${curUrl}`);
    console.log(`  Nuevos ACT capturados: ${newJsonUrls.slice(-3)}`);
  }

  await browser.close();

  // Guardar resultados
  writeFileSync(
    "/tmp/mesa-discovery.json",
    JSON.stringify(capturedJson, null, 2).slice(0, 10_000_000)
  );

  console.log("\n\n=== RESUMEN FINAL ===");
  const actUrls = Object.keys(capturedJson).filter((u) => u.includes("/ACT/"));
  console.log(`Endpoints ACT capturados (${actUrls.length}):`);
  actUrls.forEach((u) => console.log(`  ${u.replace(BASE, "")}`));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
