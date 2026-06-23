/**
 * Crawl masivo de los 121,942 PDFs de actas E-14.
 *
 * Patrón de URL confirmado:
 *   /assets/temis/pdf/{deptCode}/{munCode}/{zoneCode.padStart(3,'0')}/{standCode}/{numberStand}/PRE/{expectedName}
 *
 * Uso: npx tsx scripts/crawl-e14-pdfs.ts [--start 0] [--limit 100] [--outdir /tmp/e14-pdfs]
 *
 * El crawl guarda los PDFs en outdir con nombre {idTransmissionCode}.pdf
 * y registra progreso en /tmp/e14-crawl-progress.jsonl
 */
import { firefox } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";

const BASE = "https://e14segundavueltapresidente.registraduria.gov.co";
const CONCURRENCY = 8; // descargas paralelas por instancia
const TX_FILE = "/tmp/e14-allTransmissionCodes.json";
const PROGRESS_FILE = "/tmp/e14-crawl-progress.jsonl";

interface TxNode {
  idTransmissionCode: string;
  numberStand: string;
  expectedName: string;
  idTransmissionCodeStatus: number;
  idCorporationCode: string;
  idStand: string;
  standCode: string;
  idZoneCode: string;
  idDepartmentCode: string;
  municipalityCode: string;
}

function buildUrl(n: TxNode): string {
  const zone3 = n.idZoneCode.padStart(3, "0");
  return `${BASE}/assets/temis/pdf/${n.idDepartmentCode}/${n.municipalityCode}/${zone3}/${n.standCode}/${n.numberStand}/PRE/${n.expectedName}`;
}

function parseArgs() {
  const args = process.argv.slice(2);
  let start = 0, limit = 100, outdir = "/tmp/e14-pdfs";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--start") start = parseInt(args[++i]);
    if (args[i] === "--limit") limit = parseInt(args[++i]);
    if (args[i] === "--outdir") outdir = args[++i];
  }
  return { start, limit, outdir };
}

async function downloadBatch(page: import("playwright").Page, nodes: TxNode[], outdir: string) {
  const results = await page.evaluate(async ({ items, base, dir }: { items: TxNode[]; base: string; dir: string }) => {
    const results = [];
    for (const n of items) {
      const zone3 = n.idZoneCode.padStart(3, "0");
      const url = `${base}/assets/temis/pdf/${n.idDepartmentCode}/${n.municipalityCode}/${zone3}/${n.standCode}/${n.numberStand}/PRE/${n.expectedName}`;
      try {
        const r = await fetch(url, {
          credentials: "include",
          headers: { "Accept": "application/pdf,*/*", "Referer": `${base}/home` },
        });
        const ab = await r.arrayBuffer();
        const bytes = new Uint8Array(ab);
        const isPDF = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
        results.push({
          id: n.idTransmissionCode,
          url,
          status: r.status,
          ct: r.headers.get("content-type"),
          size: ab.byteLength,
          isPDF,
          bytes: isPDF ? Array.from(bytes) : null,
        });
      } catch (e) {
        results.push({ id: n.idTransmissionCode, url, status: -1, ct: "ERROR", size: 0, isPDF: false, bytes: null, error: String(e) });
      }
    }
    return results;
  }, { items: nodes, base: BASE, dir: outdir });

  // Save to disk
  for (const r of results) {
    if (r.isPDF && r.bytes) {
      const fname = path.join(outdir, `${r.id}.pdf`);
      fs.writeFileSync(fname, Buffer.from(r.bytes));
    }
    // Log progress
    const { bytes: _, ...logEntry } = r;
    fs.appendFileSync(PROGRESS_FILE, JSON.stringify(logEntry) + "\n");
  }

  return results;
}

async function main() {
  const { start, limit, outdir } = parseArgs();

  // Load transmission codes
  if (!fs.existsSync(TX_FILE)) {
    console.error(`Missing ${TX_FILE}. Run get-chunks.ts first.`);
    process.exit(1);
  }
  const txData = JSON.parse(fs.readFileSync(TX_FILE, "utf8"));
  const nodes: TxNode[] = [
    ...(txData.data.status11?.nodes ?? []),
    ...(txData.data.status3?.nodes ?? []),
  ];
  console.log(`Total actas: ${nodes.length}`);

  // Filter already downloaded
  const downloaded = new Set<string>();
  if (fs.existsSync(PROGRESS_FILE)) {
    for (const line of fs.readFileSync(PROGRESS_FILE, "utf8").split("\n").filter(Boolean)) {
      const entry = JSON.parse(line);
      if (entry.isPDF) downloaded.add(entry.id);
    }
    console.log(`Ya descargadas: ${downloaded.size}`);
  }

  const toProcess = nodes.slice(start, start + limit).filter(n => !downloaded.has(n.idTransmissionCode));
  console.log(`Por procesar: ${toProcess.length} (start=${start}, limit=${limit})`);

  if (toProcess.length === 0) {
    console.log("Nada que procesar.");
    return;
  }

  // Ensure output directory
  fs.mkdirSync(outdir, { recursive: true });

  const browser = await firefox.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:125.0) Gecko/20100101 Firefox/125.0",
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  // Establish session
  await page.goto(`${BASE}/home`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);
  console.log("Sesión establecida.");

  let ok = 0, fail = 0;
  const BATCH = CONCURRENCY;

  for (let i = 0; i < toProcess.length; i += BATCH) {
    const batch = toProcess.slice(i, i + BATCH);
    const results = await downloadBatch(page, batch, outdir);

    for (const r of results) {
      if (r.isPDF) ok++;
      else fail++;
    }

    const pct = Math.round(((i + batch.length) / toProcess.length) * 100);
    const status = results.map(r => r.isPDF ? "✓" : `✗(${r.status})`).join(" ");
    console.log(`[${pct}%] ${i + 1}-${Math.min(i + BATCH, toProcess.length)}/${toProcess.length}: ${status} (ok=${ok} fail=${fail})`);

    // Refresh session every 500 downloads
    if (i > 0 && i % 500 === 0) {
      console.log("  Refreshing session...");
      await page.goto(`${BASE}/home`, { waitUntil: "domcontentloaded", timeout: 20000 });
      await page.waitForTimeout(1000);
    }
  }

  await browser.close();

  console.log(`\n=== DONE ===`);
  console.log(`Éxitos: ${ok}, Fallos: ${fail}`);
  console.log(`PDFs en: ${outdir}`);
  console.log(`Progreso en: ${PROGRESS_FILE}`);
}

main().catch(e => { console.error(e); process.exit(1); });
