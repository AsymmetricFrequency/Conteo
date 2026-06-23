/**
 * Prueba descargar múltiples PDFs con una sola sesión Firefox.
 * Verifica si el patrón de URL es correcto y las cookies son suficientes.
 */
import { firefox } from "playwright";
import { writeFileSync } from "node:fs";
import * as fs from "node:fs";

const BASE = "https://e14segundavueltapresidente.registraduria.gov.co";

// 5 PDFs de diferentes departamentos para verificar el patrón
const TEST_PDFS = [
  { dept: "11", mun: "004", stand: "00", zone: "00", mesa: "001", hash: "38431c66766f4b554f88648f0971cd813cd3b22535f2e92399739fa954c17926.pdf", label: "Almaguer Cauca Mesa1" },
  { dept: "01", mun: "190", stand: "07", zone: "99", mesa: "003", hash: "b9abd4233a49a27afdf52d32dc9e497ec448f11c1d37f333a3e39e6ad7fd1d68.pdf", label: "Antioquia Mesa3" },
  { dept: "13", mun: "061", stand: "01", zone: "00", mesa: "043", hash: "83f511d10e86e1d0330a5b485b8aded785b524fb5956f0bbfae3e10ddd095ce8.pdf", label: "Bolivar Mesa43" },
  { dept: "25", mun: "100", stand: "01", zone: "99", mesa: "003", hash: "c705a62c7217bfac9fa145eddceb25a05dbd57eb15d2b41ae4109cd4aa9c66a6.pdf", label: "Cundinamarca Mesa3" },
  { dept: "27", mun: "058", stand: "00", zone: "00", mesa: "012", hash: "64438a2aca1c6c6c04bf9e48a3b537696192be267305c748b5e347cb65e34a35.pdf", label: "Choco Mesa12" },
];

function buildUrl(p: typeof TEST_PDFS[0]) {
  const standPadded = p.stand.padStart(3, "0");
  return `${BASE}/assets/temis/pdf/${p.dept}/${p.mun}/${standPadded}/${p.zone}/${p.mesa}/PRE/${p.hash}`;
}

async function main() {
  const browser = await firefox.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:125.0) Gecko/20100101 Firefox/125.0",
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  // Establecer sesión
  await page.goto(`${BASE}/home`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(2000);

  const results: Array<{ label: string; url: string; status: number; ct: string; size: number; isPDF: boolean }> = [];

  for (const pdf of TEST_PDFS) {
    const url = buildUrl(pdf);
    console.log(`\n--- ${pdf.label} ---`);
    console.log(`URL: .../${pdf.dept}/${pdf.mun}/${pdf.stand}/${pdf.zone}/${pdf.mesa}/PRE/${pdf.hash.slice(0, 20)}...`);

    const deptCode = pdf.dept;
    const result = await page.evaluate(async ({ u, base, dept }: { u: string; base: string; dept: string }) => {
      try {
        const r = await fetch(u, {
          credentials: "include",
          headers: {
            "Accept": "application/pdf,*/*",
            "Referer": `${base}/departamento/${dept}`,
          },
        });
        const ab = await r.arrayBuffer();
        const bytes = new Uint8Array(ab);
        return {
          status: r.status,
          ct: r.headers.get("content-type") ?? "",
          size: ab.byteLength,
          header: String.fromCharCode(...bytes.slice(0, 8)),
        };
      } catch (e) {
        return { status: -1, ct: "ERROR", size: 0, header: "", error: String(e) };
      }
    }, { u: url, base: BASE, dept: deptCode });

    const isPDF = result.header?.startsWith("%PDF") ?? false;
    results.push({ label: pdf.label, url, status: result.status, ct: result.ct, size: result.size, isPDF });

    console.log(`  Status: ${result.status}, CT: ${result.ct}, Size: ${result.size.toLocaleString()}, PDF: ${isPDF}`);
    if ("error" in result) console.log(`  Error: ${(result as { error: string }).error}`);

    if (isPDF) {
      // Download the actual bytes
      const pdfBytes = await page.evaluate(async (u: string) => {
        const r = await fetch(u, { credentials: "include" });
        return Array.from(new Uint8Array(await r.arrayBuffer()));
      }, url);
      const fname = `/tmp/e14-test-${pdf.label.replace(/\s/g, "-")}.pdf`;
      writeFileSync(fname, Buffer.from(pdfBytes));
      console.log(`  ✓ Guardado: ${fname}`);
    }
  }

  console.log("\n=== RESUMEN ===");
  results.forEach(r => {
    const status = r.isPDF ? "✓ PDF" : "✗ NO PDF";
    console.log(`  ${status} - ${r.label}: ${r.size.toLocaleString()} bytes [${r.ct}]`);
  });

  const success = results.filter(r => r.isPDF).length;
  const total = results.length;
  console.log(`\n${success}/${total} PDFs descargados exitosamente`);

  if (success === 0) {
    // Alternativa: cargar el PDF directamente con page.goto y capturarlo
    console.log("\n=== Intentando con page.goto (descarga del browser) ===");
    const dlPage = await context.newPage();
    const downloadPromise = context.waitForEvent("download", { timeout: 15000 }).catch(() => null);
    await dlPage.goto(buildUrl(TEST_PDFS[0]), { timeout: 15000 }).catch(() => {});
    const dl = await downloadPromise;
    if (dl) {
      console.log(`  Download started: ${dl.suggestedFilename()}`);
      const path = `/tmp/e14-test-download.pdf`;
      await dl.saveAs(path);
      console.log(`  ✓ Guardado via download: ${path}`);
    }
    await dlPage.close();
  }

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
