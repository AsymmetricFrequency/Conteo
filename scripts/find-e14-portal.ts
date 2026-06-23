/**
 * Busca el portal oficial de E-14 (escrutinio) de la Registraduría.
 */
import { chromium } from "playwright";

async function probe(page: ReturnType<import("playwright").BrowserContext["newPage"]> extends Promise<infer P> ? P : never, url: string) {
  try {
    const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
    const status = res?.status() ?? -1;
    const title = await page.title().catch(() => "");
    const body = await page.content().catch(() => "");
    return { status, title, bodySnippet: body.slice(0, 500) };
  } catch (e) {
    return { status: -1, title: "", bodySnippet: String(e) };
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    locale: "es-CO",
  });
  const page = await context.newPage();

  const candidates = [
    "https://divulgacion.registraduria.gov.co/",
    "https://divulgacion.registraduria.gov.co/divulgacion/",
    "https://resultados.registraduria.gov.co/actas/",
    "https://resultados.registraduria.gov.co/e14/",
    "https://resultados.registraduria.gov.co/escrutinio/",
    "https://esescrutinio.registraduria.gov.co/",
    "https://esescrutinios.registraduria.gov.co/",
    "https://certielectoral.registraduria.gov.co/",
    "https://www.registraduria.gov.co/Escrutinios.html",
    "https://www.registraduria.gov.co/escrutinios/",
    "https://registraduria.gov.co/actas/",
    "https://puntovotacion.registraduria.gov.co/",
    "https://datos.gov.co/resource/",
    "https://resultados.registraduria.gov.co/v2/json/ACT/PR/00.json",
  ];

  for (const url of candidates) {
    const r = await probe(page, url);
    const ok = r.status >= 200 && r.status < 400;
    console.log(`${ok ? "✓" : "✗"} [${r.status}] ${url}`);
    if (ok && r.status !== 404) {
      console.log(`  title: "${r.title}"`);
      if (r.bodySnippet.length > 50) {
        console.log(`  body: ${r.bodySnippet.replace(/\s+/g, " ").slice(0, 200)}`);
      }
    }
  }

  // Buscar en la página principal de la Registraduría links de escrutinio
  console.log("\n=== Links de escrutinio en registraduria.gov.co ===");
  await page.goto("https://www.registraduria.gov.co/", { waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => {});
  const links = await page.evaluate(() =>
    Array.from(document.querySelectorAll("a[href]"))
      .filter(el => {
        const h = (el as HTMLAnchorElement).href.toLowerCase();
        const t = el.textContent?.toLowerCase() ?? "";
        return h.includes("escrutin") || h.includes("e-14") || h.includes("e14") || h.includes("acta") ||
               t.includes("escrutin") || t.includes("e-14") || t.includes("acta");
      })
      .map(el => ({ href: (el as HTMLAnchorElement).href, text: el.textContent?.trim().slice(0, 60) }))
  );
  links.forEach(l => console.log(`  "${l.text}" → ${l.href}`));

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
