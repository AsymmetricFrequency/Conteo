import { firefox } from "playwright";
import { writeFileSync } from "node:fs";

const URLS = [
  "https://e14segundavueltapresidente.registraduria.gov.co/assets/temis/pdf/01/190/007/99/003/PRE/b9abd4233a49a27afdf52d32dc9e497ec448f11c1d37f333a3e39e6ad7fd1d68.pdf",
  "https://e14segundavueltapresidente.registraduria.gov.co/assets/temis/pdf/13/061/001/00/043/PRE/83f511d10e86e1d0330a5b485b8aded785b524fb5956f0bbfae3e10ddd095ce8.pdf",
];

async function main() {
  const browser = await firefox.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:125.0) Gecko/20100101 Firefox/125.0",
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  await page.goto("https://e14segundavueltapresidente.registraduria.gov.co/home", {
    waitUntil: "domcontentloaded", timeout: 20000,
  });
  await page.waitForTimeout(2000);

  for (const url of URLS) {
    const result = await page.evaluate(async (u) => {
      try {
        const r = await fetch(u);
        const buffer = await r.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        const header = Array.from(bytes.slice(0, 8)).map(b => String.fromCharCode(b)).join("");
        return {
          status: r.status,
          contentType: r.headers.get("content-type"),
          size: buffer.byteLength,
          header,
          isPDF: header.startsWith("%PDF"),
        };
      } catch (e) {
        return { error: String(e) };
      }
    }, url);

    console.log(`\nURL: ${url.split("/PRE/")[0].replace("https://e14segundavueltapresidente.registraduria.gov.co/assets/temis/pdf", "")}`);
    console.log("Result:", JSON.stringify(result, null, 2));

    // Save first PDF to disk
    if ((result as { isPDF?: boolean }).isPDF) {
      const pdfData = await page.evaluate(async (u) => {
        const r = await fetch(u);
        const ab = await r.arrayBuffer();
        return Array.from(new Uint8Array(ab));
      }, url);
      const buf = Buffer.from(pdfData);
      const fname = `/tmp/e14-test-acta.pdf`;
      writeFileSync(fname, buf);
      console.log(`  ✓ PDF saved to ${fname} (${buf.length.toLocaleString()} bytes)`);
      break;
    }
  }

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
