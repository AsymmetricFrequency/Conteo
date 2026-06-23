/**
 * Interactúa con el formulario del Visor E-14:
 * Corporación=PRESIDENTE, Municipio=BOGOTA, Zona=01, Puesto=01 → captura URL de imagen
 *
 * Estructura del formulario (app-custom-select):
 *   Buscar Departamento | Corporación=PRESIDENTE | Municipio | Zona | Puesto → Consultar
 */
import { firefox } from "playwright";
import { writeFileSync } from "node:fs";

const BASE = "https://e14segundavueltapresidente.registraduria.gov.co";

async function selectOption(page: import("playwright").Page, placeholderFragment: string, optionText: string) {
  console.log(`  Seleccionando "${optionText}" en "${placeholderFragment}"...`);

  // Click the input to open the dropdown
  const input = page.locator(`input.custom-input[placeholder*="${placeholderFragment}" i]`).first();
  await input.waitFor({ state: "visible", timeout: 10000 });
  await input.click();
  await page.waitForTimeout(800);

  // Type to filter options
  await input.fill(optionText.slice(0, 4));
  await page.waitForTimeout(600);

  // Wait for dropdown list to appear
  const dropdown = page.locator(".dropdown-list ul, .options-list").first();
  await dropdown.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(400);

  // Find and click the matching option
  const option = page.locator(`.dropdown-list ul li, .options-list li`).filter({ hasText: optionText }).first();
  const count = await option.count();
  if (count === 0) {
    // Try without filter text
    await input.fill("");
    await page.waitForTimeout(400);
    const allOpts = await page.locator(".dropdown-list ul li, .options-list li").allTextContents();
    console.log(`    Opciones disponibles (${allOpts.length}):`, allOpts.slice(0, 10));

    // Try exact text match
    const opt2 = page.locator(".dropdown-list ul li, .options-list li").filter({ hasText: optionText }).first();
    const c2 = await opt2.count();
    if (c2 > 0) {
      await opt2.click();
      console.log(`    ✓ Seleccionado con texto filtrado: "${optionText}"`);
    } else {
      // Click first available option
      const firstOpt = page.locator(".dropdown-list ul li, .options-list li").first();
      const firstText = await firstOpt.textContent();
      await firstOpt.click();
      console.log(`    ⚠ Seleccionando primera opción: "${firstText?.trim()}"`);
    }
  } else {
    await option.click();
    console.log(`    ✓ Seleccionado`);
  }
  await page.waitForTimeout(600);
}

async function main() {
  const browser = await firefox.launch({ headless: false }); // headless: false para ver la interacción
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:125.0) Gecko/20100101 Firefox/125.0",
    locale: "es-CO",
    ignoreHTTPSErrors: true,
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  const capturedUrls: string[] = [];
  const capturedJsonUrls: Array<{ url: string, body: unknown }> = [];
  let awsCreds: unknown = null;

  page.on("response", async (res) => {
    const url = res.url();
    const ct = res.headers()["content-type"] ?? "";

    if (ct.includes("json") || url.endsWith(".json")) {
      try {
        const body = await res.json();
        if (url.includes("cognito") && typeof body === "object" && body !== null && "Credentials" in body) {
          awsCreds = (body as Record<string, unknown>).Credentials;
          console.log("  [AWS] Credenciales Cognito capturadas!");
        }
        const path = url.replace(BASE, "");
        if (!path.includes("main.json") && !path.includes("allDept") && !path.includes("allCorp") && !path.includes("CorpIndex") && !path.includes("Progress")) {
          capturedJsonUrls.push({ url, body });
          console.log(`  [JSON] ${path.slice(0, 100)}`);
          console.log(`         ${JSON.stringify(body).slice(0, 300)}`);
        }
      } catch { /**/ }
    }

    // Capturar URLs de imágenes/PDFs (E-14 actas)
    if (
      url.includes("s3.amazonaws") || url.includes("cloudfront.net") ||
      url.includes(".pdf") || url.includes(".jpg") || url.includes(".jpeg") ||
      url.includes(".png") || url.includes("acta") || url.includes("formulario") ||
      ct.includes("image") || ct.includes("pdf") || ct.includes("octet")
    ) {
      capturedUrls.push(url);
      console.log(`\n  *** [IMAGEN/S3] ${url} ***\n`);
    }
  });

  // 1. Navegar a departamento de ANTIOQUIA para cargar el formulario con municipios de Antioquia
  // O navegar al home y buscar BOGOTA (Cundinamarca es más conocida)
  console.log("\n=== Cargando portal E-14 ===");
  await page.goto(`${BASE}/home`, { waitUntil: "networkidle", timeout: 40000 });
  await page.waitForTimeout(3000);
  console.log("Home cargado. URL:", page.url());

  // Mostrar estructura del formulario
  const formInfo = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll("input.custom-input"));
    return inputs.map(inp => ({
      placeholder: inp.getAttribute("placeholder"),
      value: (inp as HTMLInputElement).value,
      visible: (inp as HTMLElement).offsetWidth > 0,
    }));
  });
  console.log("Inputs del formulario:", formInfo);

  // 2. PASO 1: Corporación ya debe estar en PRESIDENTE. Verificar y seleccionar si no.
  const corpInput = await page.locator("input.custom-input").all();
  for (const inp of corpInput) {
    const ph = await inp.getAttribute("placeholder");
    const val = await inp.inputValue().catch(() => "");
    console.log(`  Input: placeholder="${ph}" value="${val}"`);
  }

  // La corporación suele estar pre-seleccionada como PRESIDENTE
  // Si no, seleccionarla
  const corpPlaceholder = await page.locator("input.custom-input").first().getAttribute("placeholder");
  if (corpPlaceholder?.includes("Buscar Departamento")) {
    // El primer input es búsqueda de departamento (en la sidebar/mapa)
    // El segundo es Corporación
    console.log("\n  La SPA muestra el formulario en departamento...");
  }

  // 3. Navegar a Cundinamarca (Bogotá) → dept 11
  console.log("\n=== Navegando a Cundinamarca (dept 11) ===");
  await page.goto(`${BASE}/departamento/11`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(4000);
  console.log("URL:", page.url());

  // Ver opciones del formulario
  const formState = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll("input.custom-input"));
    return inputs.map(inp => ({
      placeholder: inp.getAttribute("placeholder"),
      value: (inp as HTMLInputElement).value,
      disabled: (inp as HTMLInputElement).disabled,
      visible: (inp as HTMLElement).offsetWidth > 0,
    }));
  });
  console.log("\nEstado del formulario en dept 11:");
  formState.forEach(i => console.log(`  "${i.placeholder}" = "${i.value}" disabled=${i.disabled} visible=${i.visible}`));

  // Guardar HTML
  writeFileSync("/tmp/e14-dept11.html", await page.content());

  // 4. PASO 2: Seleccionar Municipio = BOGOTA
  console.log("\n=== Seleccionando Municipio ===");
  try {
    await selectOption(page, "municipio", "BOGOTA");
    await page.waitForTimeout(1000);
  } catch (e) {
    console.log("Error seleccionando municipio:", e);

    // Plan B: Ver qué municipios hay disponibles
    const munInput = page.locator(`input.custom-input[placeholder*="municipio" i]`).first();
    await munInput.click().catch(() => {});
    await page.waitForTimeout(800);
    const allMuns = await page.locator(".dropdown-list ul li, .options-list li").allTextContents();
    console.log("Municipios disponibles (primeros 10):", allMuns.slice(0, 10));
    // Seleccionar el primero
    if (allMuns.length > 0) {
      await page.locator(".dropdown-list ul li, .options-list li").first().click();
      console.log(`  Seleccionado: "${allMuns[0]}"`);
    }
    await page.waitForTimeout(800);
  }

  // Estado del formulario después de municipio
  const afterMun = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("input.custom-input")).map(inp => ({
      placeholder: inp.getAttribute("placeholder"),
      value: (inp as HTMLInputElement).value,
    }));
  });
  console.log("Formulario después de municipio:", afterMun);

  // 5. PASO 3: Seleccionar Zona
  console.log("\n=== Seleccionando Zona ===");
  try {
    // Primero ver qué zonas hay disponibles
    const zonaInput = page.locator(`input.custom-input[placeholder*="zona" i]`).first();
    await zonaInput.click().catch(() => {});
    await page.waitForTimeout(800);
    const zonas = await page.locator(".dropdown-list ul li, .options-list li").allTextContents();
    console.log("Zonas disponibles:", zonas.slice(0, 10));
    if (zonas.length > 0) {
      await page.locator(".dropdown-list ul li, .options-list li").first().click();
      console.log(`  Zona seleccionada: "${zonas[0]}"`);
    }
    await page.waitForTimeout(800);
  } catch (e) {
    console.log("Error seleccionando zona:", e);
  }

  // 6. PASO 4: Seleccionar Puesto
  console.log("\n=== Seleccionando Puesto ===");
  try {
    const puestoInput = page.locator(`input.custom-input[placeholder*="puesto" i]`).first();
    await puestoInput.click().catch(() => {});
    await page.waitForTimeout(800);
    const puestos = await page.locator(".dropdown-list ul li, .options-list li").allTextContents();
    console.log("Puestos disponibles:", puestos.slice(0, 10));
    if (puestos.length > 0) {
      await page.locator(".dropdown-list ul li, .options-list li").first().click();
      console.log(`  Puesto seleccionado: "${puestos[0]}"`);
    }
    await page.waitForTimeout(800);
  } catch (e) {
    console.log("Error seleccionando puesto:", e);
  }

  // Estado final
  const formFinal = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("input.custom-input")).map(inp => ({
      placeholder: inp.getAttribute("placeholder"),
      value: (inp as HTMLInputElement).value,
    }));
  });
  console.log("\nFormulario listo para consultar:", formFinal);

  // 7. Clic en "Consultar"
  console.log("\n=== Clicando Consultar ===");
  writeFileSync("/tmp/e14-before-consultar.html", await page.content());

  const consultarBtn = page.locator("button").filter({ hasText: "Consultar" }).first();
  const btnExists = await consultarBtn.count();
  console.log("Botón Consultar:", btnExists > 0 ? "✓ encontrado" : "✗ no encontrado");

  if (btnExists > 0) {
    await consultarBtn.click();
    console.log("Clic en Consultar!");
    await page.waitForTimeout(6000); // Esperar a que carguen las mesas

    const afterUrl = page.url();
    console.log("URL después de Consultar:", afterUrl);

    const afterContent = await page.content();
    writeFileSync("/tmp/e14-after-consultar.html", afterContent);
    writeFileSync("/tmp/e14-screenshot.png", await page.screenshot({ fullPage: true }));

    // Ver qué hay en la página de resultados
    const resultText = await page.evaluate(() => document.body.innerText?.slice(0, 1000));
    console.log("\nContenido de resultados:", resultText?.replace(/\s+/g, " "));

    // Buscar filas de mesas
    const mesas = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll("tr, [class*='mesa'], [class*='acta'], [class*='row']"))
        .filter(el => (el as HTMLElement).offsetWidth > 0);
      return rows.slice(0, 10).map(el => ({
        tag: el.tagName,
        text: el.textContent?.trim().slice(0, 80),
        class: el.className.slice(0, 60),
      }));
    });
    console.log("\nMesas encontradas:", mesas.length);
    mesas.forEach(m => console.log(`  <${m.tag} class="${m.class}"> "${m.text}"`));

    // Buscar botones de "Ver Acta" o similar
    const actaBtns = await page.locator("button, a").filter({ hasText: /ver|acta|pdf|imagen|formulario/i }).all();
    console.log(`\nBotones de acta: ${actaBtns.length}`);
    for (const btn of actaBtns.slice(0, 5)) {
      const t = await btn.textContent();
      console.log(`  "${t?.trim()}"`, await btn.getAttribute("href") ?? "");
    }

    // Esperar un click en la primera acta si hay
    if (actaBtns.length > 0) {
      console.log("\n=== Clicando en primera acta ===");
      await actaBtns[0].click();
      await page.waitForTimeout(5000);
      console.log("URLs capturadas:", capturedUrls);
    }

    // Ver nuevos JSON cargados
    if (capturedJsonUrls.length > 0) {
      console.log("\nJSON capturados:");
      capturedJsonUrls.slice(0, 5).forEach(j => {
        console.log(`  ${j.url.replace(BASE, "")}`);
        console.log(`  → ${JSON.stringify(j.body).slice(0, 200)}`);
      });
    }
  }

  // Guardar resultados
  writeFileSync("/tmp/e14-captured-urls.json", JSON.stringify({
    awsCreds,
    capturedUrls,
    capturedJsonUrls: capturedJsonUrls.map(j => ({ url: j.url, bodyPreview: JSON.stringify(j.body).slice(0, 200) })),
  }, null, 2));

  console.log(`\n=== RESUMEN FINAL ===`);
  console.log(`URLs de imágenes/S3: ${capturedUrls.length}`);
  console.log(capturedUrls.map(u => `  ${u}`).join("\n"));
  console.log(`AWS Creds: ${awsCreds ? "✓" : "✗"}`);

  await page.waitForTimeout(2000);
  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
