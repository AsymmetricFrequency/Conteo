/**
 * Descubrimiento profundo: navega hasta nivel de MESA en el portal
 * de la Registraduría interceptando todas las llamadas JSON.
 */
import { chromium } from "playwright";

const BASE = "https://resultados.registraduria.gov.co";
const capturedUrls = new Set<string>();
const capturedData: Record<string, unknown> = {};

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    locale: "es-CO",
    timezoneId: "America/Bogota",
  });
  const page = await context.newPage();

  page.on("response", async (response) => {
    const url = response.url();
    const ct = response.headers()["content-type"] ?? "";
    if (!ct.includes("json") || capturedUrls.has(url)) return;
    try {
      const body = await response.json();
      capturedUrls.add(url);
      capturedData[url] = body;
      // Solo mostrar las que son de datos (ACT, json/)
      if (url.includes("/json/") || url.includes("/ACT/")) {
        const path = url.replace(BASE, "");
        console.log(`  [JSON] ${path}`);
      }
    } catch { /* skip */ }
  });

  // 1. Página principal
  console.log("\n1. Cargando página principal...");
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(2000);

  // 2. Navegar a territorios de Antioquia (dept 01)
  console.log("\n2. Navegando a territorios de Antioquia...");
  await page.goto(`${BASE}/v2/territorios/0/01/`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(3000);

  // 3. Navegar a Medellín (municipio 01001)
  console.log("\n3. Navegando a Medellín...");
  await page.goto(`${BASE}/v2/territorios/0/01001/`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(3000);

  // 4. Intentar navegar a zonas de Medellín - probar rutas del SPA
  const zonaPaths = [
    `${BASE}/v2/territorios/1/01001/`,
    `${BASE}/v2/territorios/2/01001/`,
    `${BASE}/v2/territorios/0/01001/zonas/`,
  ];
  for (const path of zonaPaths) {
    console.log(`\n4. Probando: ${path}`);
    await page.goto(path, { waitUntil: "networkidle", timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2000);
  }

  // 5. Buscar si hay links clickables en la página de Medellín
  await page.goto(`${BASE}/v2/territorios/0/01001/`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(2000);

  const links = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("a[href], [data-href], [onclick]"))
      .map(el => ({
        tag: el.tagName,
        href: (el as HTMLAnchorElement).href || el.getAttribute("data-href") || "",
        text: el.textContent?.trim().slice(0, 50)
      }))
      .filter(l => l.href && !l.href.includes("javascript:void"));
  });
  console.log("\n5. Links en la página de Medellín:");
  links.slice(0, 20).forEach(l => console.log(`   ${l.tag}: "${l.text}" → ${l.href}`));

  // 6. Buscar botones/items que podamos clicar para navegar a zonas
  const clickables = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("li, tr, .territorio, .zona, .municipio, [data-code], [data-id]"))
      .slice(0, 10)
      .map(el => ({
        tag: el.tagName,
        class: el.className,
        text: el.textContent?.trim().slice(0, 50),
        dataCode: el.getAttribute("data-code"),
        dataId: el.getAttribute("data-id"),
      }));
  });
  console.log("\n6. Elementos clickables (territorial):");
  clickables.forEach(c => console.log(`   ${c.tag}.${c.class}: "${c.text}" data-code=${c.dataCode}`));

  await browser.close();

  // Guardar todos los datos capturados
  const fs = await import("node:fs");
  const outFile = "/tmp/registraduria-deep.json";
  fs.writeFileSync(outFile, JSON.stringify({ urls: [...capturedUrls], data: capturedData }, null, 2));

  console.log("\n\n=== RESUMEN ===");
  console.log(`Endpoints capturados: ${capturedUrls.size}`);
  const actUrls = [...capturedUrls].filter(u => u.includes("/ACT/") || u.includes("/json/"));
  console.log("Endpoints de datos:");
  actUrls.forEach(u => console.log("  →", u.replace(BASE, "")));
  console.log(`\nGuardado en ${outFile}`);
}

main().catch(e => { console.error(e); process.exit(1); });
