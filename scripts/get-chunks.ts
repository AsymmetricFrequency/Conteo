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
  await page.goto(`${BASE}/home`, { waitUntil: "networkidle", timeout: 30000 });

  const scripts = await page.evaluate(() =>
    Array.from(document.querySelectorAll("script[src]")).map(s => (s as HTMLScriptElement).src)
  );

  const chunks = scripts.filter(s => s.includes("chunk") || s.includes("main") || s.includes("polyfill"));
  console.log("Chunks:", chunks.map(s => s.replace(BASE, "")));

  let combined = "";
  for (const url of chunks) {
    const text = await page.evaluate(async (u) => {
      const r = await fetch(u);
      return r.ok ? r.text() : "";
    }, url);
    if (text.length > 100) {
      combined += text;
      console.log(`  ${url.replace(BASE, "")}: ${text.length.toLocaleString()} chars`);
    }
  }

  writeFileSync("/tmp/e14-all-chunks.js", combined);
  console.log(`\nTotal: ${combined.length.toLocaleString()} chars`);

  // Also download allTransmissionCodes.json
  const txCodes = await page.evaluate(async (base) => {
    const r = await fetch(`${base}/assets/temis/divipol_json/allTransmissionCodes.json`);
    return r.ok ? r.text() : "";
  }, BASE);
  if (txCodes.length > 10) {
    writeFileSync("/tmp/e14-allTransmissionCodes.json", txCodes);
    console.log(`\nallTransmissionCodes.json: ${txCodes.length.toLocaleString()} chars`);
    const d = JSON.parse(txCodes);
    const nodes = d?.data?.status3?.nodes ?? [];
    console.log(`  Total actas: ${nodes.length}`);
    console.log(`  Muestra[0]:`, JSON.stringify(nodes[0]).slice(0, 200));
  }

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
