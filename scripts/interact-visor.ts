/**
 * Interactúa con el formulario del Visor E-14 para llegar a una acta específica.
 * El portal es una SPA Angular con routing interno.
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
  const s3Urls: string[] = [];
  let awsCreds: unknown = null;

  page.on("response", async (res) => {
    const url = res.url();
    const ct = res.headers()["content-type"] ?? "";
    if (ct.includes("json") || url.endsWith(".json")) {
      try {
        const body = await res.json();
        allJson[url] = body;
        if (url.includes("cognito") && typeof body === "object" && body !== null && "Credentials" in body) {
          awsCreds = (body as Record<string, unknown>).Credentials;
          console.log("  [AWS CREDS] Captured!");
        }
        const path = url.replace(BASE, "");
        // Solo mostrar JSON relevantes (no los estáticos ya conocidos)
        if (!path.includes("allDep") && !path.includes("allCorp") && !path.includes("CorpIndex") && !path.includes("cognito") && !path.includes("main.json")) {
          console.log(`  [JSON] ${path.slice(0, 80)}: ${JSON.stringify(body).slice(0, 200)}`);
        }
      } catch { /**/ }
    }
    if (url.includes("s3.amazonaws") || url.includes("cloudfront.net")) {
      s3Urls.push(url);
      console.log(`  [S3!] ${url}`);
    }
  });

  // 1. Cargar la home
  await page.goto(`${BASE}/home`, { waitUntil: "networkidle", timeout: 40000 });
  await page.waitForTimeout(3000);
  console.log("Home cargado. Title:", await page.title());

  // Inspeccionar el formulario del home
  const homeContent = await page.evaluate(() => {
    const selects = Array.from(document.querySelectorAll("select, mat-select, ng-select, [class*='select'], [class*='dropdown']"));
    const inputs = Array.from(document.querySelectorAll("input"));
    const buttons = Array.from(document.querySelectorAll("button, a.btn, [type='submit']"));

    return {
      selects: selects.slice(0, 10).map(el => ({
        tag: el.tagName, id: el.id, name: (el as HTMLSelectElement).name ?? "",
        class: el.className.slice(0, 80), options: Array.from((el as HTMLSelectElement).options ?? []).slice(0, 5).map(o => o.text),
        text: el.textContent?.trim().slice(0, 60)
      })),
      inputs: inputs.slice(0, 5).map(el => ({
        tag: el.tagName, id: el.id, type: el.type, name: el.name, placeholder: el.placeholder
      })),
      buttons: buttons.filter(b => (b as HTMLElement).offsetWidth > 0).slice(0, 10).map(b => ({
        tag: b.tagName, text: b.textContent?.trim().slice(0, 50), class: b.className.slice(0, 60)
      })),
    };
  });

  console.log("\n=== DOM del home ===");
  console.log("Selects:", JSON.stringify(homeContent.selects, null, 2));
  console.log("Inputs:", JSON.stringify(homeContent.inputs, null, 2));
  console.log("Buttons:", JSON.stringify(homeContent.buttons, null, 2));

  // Guardar HTML del home
  writeFileSync("/tmp/e14-home-full.html", await page.content());

  // 2. Navegar a /departamento/01 (la SPA debe reconocer este fragmento)
  console.log("\n=== Navegando a departamento/01 ===");
  await page.goto(`${BASE}/departamento/01`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(5000);
  console.log("URL:", page.url());
  writeFileSync("/tmp/e14-dept-dom.html", await page.content());

  // Inspeccionar el DOM del departamento más profundamente
  const deptContent = await page.evaluate(() => {
    // Buscar la tabla/lista de municipios
    const allText = document.body.innerText;
    const selects = Array.from(document.querySelectorAll("select, mat-select, ng-select, [class*='dropdown'], [formcontrolname], [ng-model]"));
    const municipios = Array.from(document.querySelectorAll("[class*='municipio'], [class*='muni'], [class*='city'], [class*='item'], li"));
    const clickables = Array.from(document.querySelectorAll("a, button, div[tabindex], [click]")).filter(el => (el as HTMLElement).offsetWidth > 0 && el.textContent?.trim().length > 0);

    return {
      textSnippet: allText.slice(0, 500),
      selects: selects.slice(0, 5).map(el => ({
        tag: el.tagName, id: el.id, formControl: el.getAttribute("formcontrolname") ?? "",
        class: el.className.slice(0, 60)
      })),
      municipios: municipios.slice(0, 10).map(el => ({
        tag: el.tagName, text: el.textContent?.trim().slice(0, 40), class: el.className.slice(0, 60),
        href: (el as HTMLAnchorElement).href ?? ""
      })),
      clickables: clickables.slice(0, 20).map(el => ({
        tag: el.tagName, text: el.textContent?.trim().slice(0, 50), class: el.className.slice(0, 60),
        href: (el as HTMLAnchorElement).href ?? ""
      }))
    };
  });

  console.log("\nTexto:", deptContent.textSnippet.replace(/\s+/g, " "));
  console.log("\nSelects:", deptContent.selects);
  console.log("\nMunicipios:", deptContent.municipios.slice(0, 5));
  console.log("\nClickables:", deptContent.clickables.slice(0, 10));

  // 3. Intentar hacer clic en el primer municipio de Antioquia
  console.log("\n=== Buscando y clicando en MEDELLIN ===");

  // Intentar buscar MEDELLIN en el texto del DOM y hacer clic
  try {
    // Usar el locator de texto
    const munLocator = page.locator("text=MEDELLIN").first();
    const count = await munLocator.count();
    console.log(`Elementos con "MEDELLIN": ${count}`);
    if (count > 0) {
      await munLocator.click();
      await page.waitForTimeout(5000);
      console.log("URL después de clic:", page.url());
      writeFileSync("/tmp/e14-after-medellin-click.html", await page.content());
    }
  } catch (e) {
    console.log("Error al clicar MEDELLIN:", e);
  }

  // 4. Ver el main bundle para entender las rutas del SPA
  console.log("\n=== Analizando bundle de la SPA ===");
  const mainBundle = await page.evaluate(async () => {
    const scriptTags = Array.from(document.querySelectorAll("script[src]")).map(s => (s as HTMLScriptElement).src);
    const mainScript = scriptTags.find(s => s.includes("main"));
    if (!mainScript) return { url: "", content: "" };
    const r = await fetch(mainScript);
    return { url: mainScript, content: r.ok ? await r.text() : "" };
  });

  if (mainBundle.content.length > 1000) {
    writeFileSync("/tmp/e14-main-bundle.js", mainBundle.content);
    console.log(`Bundle JS: ${mainBundle.url.replace(BASE, "")} (${mainBundle.content.length.toLocaleString()} chars)`);

    // Buscar rutas del router Angular
    const routePatterns = [
      /path:\s*["'`]([^"'`]{2,60})["'`]/g,
      /\{ path:\s*["'`]([^"'`]{2,60})["'`]/g,
      /routerLink:\s*["'`\[]([^"'`\]]{2,80})/g,
      /navigate\(\[["'`]([^"'`\]]{2,80})/g,
      /"\/departamento\/"[^"]{0,50}/g,
      /departamento.*municipio.*zona.*puesto/g,
      /s3\.[^'"]{5,80}/g,
      /amazonaws[^'"]{5,80}/g,
      /bucketName[^'"]{5,80}/gi,
      /bucket[^'"]{5,80}/gi,
      /getObject|putObject|presigned/g,
    ];

    for (const pat of routePatterns) {
      const matches = [...new Set([...mainBundle.content.matchAll(pat)].map(m => m[0]))];
      if (matches.length > 0) {
        console.log(`\n  Pattern /${pat.source.slice(0, 35)}/:`);
        matches.slice(0, 8).forEach(m => console.log(`    ${m.slice(0, 120)}`));
      }
    }
  }

  // Guardar resumen
  writeFileSync("/tmp/e14-aws-creds.json", JSON.stringify(awsCreds, null, 2));
  writeFileSync("/tmp/e14-s3-urls.json", JSON.stringify(s3Urls, null, 2));

  console.log(`\n=== FIN ===`);
  console.log(`S3 URLs: ${s3Urls.length}`);
  console.log(`AWS Creds: ${awsCreds ? "✓" : "✗"}`);

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
