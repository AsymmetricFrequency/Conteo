/**
 * Navega a Antioquia dept/01 en el visor E-14 y captura la URL exacta del PDF
 * para entender el patrón correcto de la URL.
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

  const pdfUrls: string[] = [];
  page.on("response", async (res) => {
    const url = res.url();
    if (url.includes("/assets/temis/pdf/")) {
      const ct = res.headers()["content-type"] ?? "";
      const size = (await res.body().catch(() => Buffer.alloc(0))).length;
      pdfUrls.push(url);
      console.log(`\n[PDF] ${url.replace(BASE, "")} CT=${ct} size=${size}`);
    }
  });

  // Cargar departamento 01 (Antioquia)
  console.log("=== Cargando Antioquia (dept 01) ===");
  await page.goto(`${BASE}/departamento/01`, { waitUntil: "networkidle", timeout: 40000 });
  await page.waitForTimeout(3000);

  // Ver los municipios disponibles
  const munInput = page.locator("input.custom-input").nth(2);
  await munInput.click();
  await page.waitForTimeout(500);
  const munOpts = await page.locator(".dropdown-list ul li, .options-list li").allTextContents();
  console.log(`\nMunicipios disponibles (${munOpts.length}):`);
  munOpts.slice(0, 10).forEach(m => console.log(`  "${m.trim()}"`));

  // Buscar el municipio 190 (Urrao o similar en Antioquia)
  // Los datos del JSON dicen munCode=190, pero en el dropdown puede aparecer diferente
  // Seleccionar el PRIMER municipio para simplicidad
  await page.locator(".dropdown-list ul li, .options-list li").first().click();
  await page.waitForTimeout(500);

  // Seleccionar zona
  const zonaInput = page.locator("input.custom-input").nth(3);
  await zonaInput.click();
  await page.waitForTimeout(500);
  const zonaOpts = await page.locator(".dropdown-list ul li, .options-list li").allTextContents();
  console.log(`\nZonas (${zonaOpts.length}):`, zonaOpts.slice(0, 5).map(z => z.trim()));

  // Seleccionar la última zona (no la primera/cabecera) para ver un puesto real
  const zonaIdx = zonaOpts.length > 1 ? zonaOpts.length - 1 : 0;
  await page.locator(".dropdown-list ul li, .options-list li").nth(zonaIdx).click();
  await page.waitForTimeout(500);

  // Seleccionar puesto
  const puestoInput = page.locator("input.custom-input").nth(4);
  await puestoInput.click();
  await page.waitForTimeout(500);
  const puestoOpts = await page.locator(".dropdown-list ul li, .options-list li").allTextContents();
  console.log(`Puestos (${puestoOpts.length}):`, puestoOpts.slice(0, 5).map(p => p.trim()));

  // Seleccionar un puesto específico (no cabecera)
  const puestoIdx = puestoOpts.length > 1 ? 1 : 0;
  await page.locator(".dropdown-list ul li, .options-list li").nth(puestoIdx).click();
  await page.waitForTimeout(500);

  // Consultar
  for (const btn of await page.locator("button").all()) {
    if ((await btn.textContent())?.includes("Consultar")) {
      await btn.click();
      break;
    }
  }
  await page.waitForTimeout(5000);

  // Estado del formulario
  const formState = await page.evaluate(() =>
    Array.from(document.querySelectorAll("input.custom-input")).map(inp => ({
      ph: inp.getAttribute("placeholder"),
      val: (inp as HTMLInputElement).value,
    }))
  );
  console.log("\nEstado del formulario:", formState);

  // Ver primera mesa
  for (const btn of await page.locator("button").all()) {
    if ((await btn.textContent())?.trim() === "Ver") {
      await btn.click();
      break;
    }
  }
  await page.waitForTimeout(6000);

  console.log("\n=== URLs de PDF capturadas ===");
  pdfUrls.forEach(u => console.log(`  ${u.replace(BASE, "")}`));

  // También capturar via fetch directo varios PDFs del allTransmissionCodes
  // para el departamento 01 con zona!=00
  console.log("\n=== Verificando PDFs de Antioquia directamente ===");
  const import_json = await import("node:fs");
  const txData = JSON.parse(import_json.readFileSync("/tmp/e14-allTransmissionCodes.json", "utf8"));
  const nodes = txData.data.status11.nodes;

  // Filtrar nodos de Antioquia con zona!=00
  const antioquiaNodes = nodes.filter((n: Record<string,string>) => n.idDepartmentCode === "01" && n.idZoneCode !== "00" && n.idZoneCode !== "99").slice(0, 5);
  console.log(`Nodos Antioquia con zona especial: ${antioquiaNodes.length}`);
  antioquiaNodes.forEach((n: Record<string,string>) => console.log(`  ${JSON.stringify(n)}`));

  // Probar variaciones de URL para el primer nodo de Antioquia
  const target = nodes.find((n: Record<string,string>) => n.idDepartmentCode === "01");
  if (target) {
    const urlVariations = [
      `${BASE}/assets/temis/pdf/${target.idDepartmentCode}/${target.municipalityCode}/${target.standCode.padStart(3, "0")}/${target.idZoneCode}/${target.numberStand}/PRE/${target.expectedName}`,
      `${BASE}/assets/temis/pdf/${target.idDepartmentCode}/${target.municipalityCode}/${target.standCode}/${target.idZoneCode}/${target.numberStand}/PRE/${target.expectedName}`,
      `${BASE}/assets/temis/pdf/${target.idDepartmentCode}/${target.municipalityCode}/${target.idZoneCode}/${target.standCode}/${target.numberStand}/PRE/${target.expectedName}`,
      `${BASE}/assets/temis/pdf/${target.idDepartmentCode}/${target.municipalityCode}/${target.idZoneCode}/${target.standCode.padStart(3, "0")}/${target.numberStand}/PRE/${target.expectedName}`,
    ];

    console.log(`\nTarget: ${JSON.stringify(target)}`);
    for (const url of urlVariations) {
      const result = await page.evaluate(async ({ u, base }: { u: string; base: string }) => {
        const r = await fetch(u, {
          credentials: "include",
          headers: { "Accept": "application/pdf,*/*", "Referer": `${base}/departamento/01` },
        });
        const ab = await r.arrayBuffer();
        return {
          status: r.status,
          ct: r.headers.get("content-type"),
          size: ab.byteLength,
          isPDF: String.fromCharCode(...new Uint8Array(ab.slice(0, 4))).startsWith("%PDF"),
        };
      }, { u: url, base: BASE });

      const p = url.replace(`${BASE}/assets/temis/pdf/`, "").replace(target.expectedName, "hash.pdf");
      console.log(`  ${result.isPDF ? "✓" : "✗"} [${result.status} ${result.ct}] ${p}`);
    }
  }

  writeFileSync("/tmp/e14-antioquia-pdfs.json", JSON.stringify(pdfUrls, null, 2));
  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
