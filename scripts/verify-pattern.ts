import { firefox } from "playwright";

const BASE = "https://e14segundavueltapresidente.registraduria.gov.co";

// Corrected pattern: {dept}/{mun}/{zone3}/{stand}/{mesa}/PRE/{hash}
const tests = [
  { desc: "Antioquia zone=99/stand=07",  url: `${BASE}/assets/temis/pdf/01/190/099/07/003/PRE/b9abd4233a49a27afdf52d32dc9e497ec448f11c1d37f333a3e39e6ad7fd1d68.pdf` },
  { desc: "Bolivar zone=00/stand=01",    url: `${BASE}/assets/temis/pdf/13/061/000/01/043/PRE/83f511d10e86e1d0330a5b485b8aded785b524fb5956f0bbfae3e10ddd095ce8.pdf` },
  { desc: "Cundinamarca zone=99/stand=01", url: `${BASE}/assets/temis/pdf/25/100/099/01/003/PRE/c705a62c7217bfac9fa145eddceb25a05dbd57eb15d2b41ae4109cd4aa9c66a6.pdf` },
  { desc: "Choco zone=00/stand=00",      url: `${BASE}/assets/temis/pdf/27/058/000/00/012/PRE/64438a2aca1c6c6c04bf9e48a3b537696192be267305c748b5e347cb65e34a35.pdf` },
  // Antioquia with zone=02/stand=01
  { desc: "Antioquia zone=02/stand=01",  url: `${BASE}/assets/temis/pdf/01/043/002/01/007/PRE/83b88ae49eddad7f7870fb1e11985582e2470960ce62e3b0be7d35f4c60a6511.pdf` },
];

async function main() {
  const browser = await firefox.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:125.0) Gecko/20100101 Firefox/125.0",
    ignoreHTTPSErrors: true,
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/home`, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForTimeout(1000);

  for (const t of tests) {
    const result = await page.evaluate(async ({ u, base }: { u: string; base: string }) => {
      const r = await fetch(u, {
        credentials: "include",
        headers: { "Accept": "application/pdf,*/*", "Referer": `${base}/home` },
      });
      const ab = await r.arrayBuffer();
      const h = String.fromCharCode(...new Uint8Array(ab.slice(0, 5)));
      return { status: r.status, ct: r.headers.get("content-type"), size: ab.byteLength, isPDF: h.startsWith("%PDF") };
    }, { u: t.url, base: BASE });

    const mark = result.isPDF ? "✓" : "✗";
    console.log(`${mark} ${t.desc}: ${result.size.toLocaleString()} bytes [${result.ct}]`);
  }

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
