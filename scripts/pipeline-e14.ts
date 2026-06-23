/**
 * Pipeline completo de E-14:
 * 1. Seed del índice desde allTransmissionCodes.json
 * 2. Descarga de PDFs
 * 3. OCR con Claude Vision
 * 4. Ingesta en la DB (E14ActaIndex + FormE14)
 *
 * Uso:
 *   npx tsx scripts/pipeline-e14.ts seed       → carga índice desde JSON
 *   npx tsx scripts/pipeline-e14.ts run [N]    → procesa N actas pendientes
 *   npx tsx scripts/pipeline-e14.ts stats      → muestra estadísticas
 */
import { PrismaClient } from "@prisma/client";
import { firefox } from "playwright";
import { ocrE14 } from "./ocr-e14";
import * as fs from "node:fs";
import * as path from "node:path";

const BASE = "https://e14segundavueltapresidente.registraduria.gov.co";
const TX_FILE = "/tmp/e14-allTransmissionCodes.json";
const PDF_DIR = "/tmp/e14-pdfs";

const prisma = new PrismaClient();

function buildPdfUrl(n: {
  idDepartmentCode: string;
  municipalityCode: string;
  idZoneCode: string;
  standCode: string;
  numberStand: string;
  expectedName: string;
}) {
  const zone3 = n.idZoneCode.padStart(3, "0");
  return `${BASE}/assets/temis/pdf/${n.idDepartmentCode}/${n.municipalityCode}/${zone3}/${n.standCode}/${n.numberStand}/PRE/${n.expectedName}`;
}

// ─── Seed ─────────────────────────────────────────────────────────────────
async function seed() {
  if (!fs.existsSync(TX_FILE)) {
    console.error(`Falta ${TX_FILE}. Ejecuta primero: npx tsx scripts/get-chunks.ts`);
    process.exit(1);
  }

  const txData = JSON.parse(fs.readFileSync(TX_FILE, "utf8"));
  const nodes = [
    ...(txData.data?.status11?.nodes ?? []),
    ...(txData.data?.status3?.nodes ?? []),
  ] as Array<{
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
  }>;

  console.log(`Cargando ${nodes.length} actas en el índice...`);

  // Upsert en lotes de 1000
  const BATCH = 1000;
  let inserted = 0;

  for (let i = 0; i < nodes.length; i += BATCH) {
    const batch = nodes.slice(i, i + BATCH);
    await prisma.$transaction(
      batch.map(n =>
        prisma.e14ActaIndex.upsert({
          where: { idTransmissionCode: n.idTransmissionCode },
          create: {
            idTransmissionCode: n.idTransmissionCode,
            idDepartmentCode: n.idDepartmentCode,
            municipalityCode: n.municipalityCode,
            idZoneCode: n.idZoneCode,
            standCode: n.standCode,
            numberStand: n.numberStand,
            expectedName: n.expectedName,
            idCorporationCode: n.idCorporationCode,
            idStand: n.idStand,
            status: "pending",
          },
          update: {}, // no sobreescribir si ya está procesada
        })
      )
    );
    inserted += batch.length;
    process.stdout.write(`\r  ${inserted.toLocaleString()}/${nodes.length.toLocaleString()}...`);
  }

  console.log(`\n✓ Índice sembrado con ${inserted.toLocaleString()} actas.`);
}

// ─── Stats ─────────────────────────────────────────────────────────────────
async function stats() {
  const counts = await prisma.e14ActaIndex.groupBy({
    by: ["status"],
    _count: { id: true },
  });

  const total = await prisma.e14ActaIndex.count();
  console.log(`\n=== E14 Índice ===`);
  console.log(`Total: ${total.toLocaleString()}`);
  counts.forEach(c => console.log(`  ${c.status}: ${c._count.id.toLocaleString()}`));

  const byDept = await prisma.e14ActaIndex.groupBy({
    by: ["idDepartmentCode"],
    where: { status: "ocr_done" },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
  });
  if (byDept.length > 0) {
    console.log(`\nOCR por departamento (top 5):`);
    byDept.slice(0, 5).forEach(d => console.log(`  Dept ${d.idDepartmentCode}: ${d._count.id}`));
  }
}

// ─── Solo descarga (sin OCR) ─────────────────────────────────────────────
async function downloadOnly(limit: number, deptCode?: string) {
  fs.mkdirSync(PDF_DIR, { recursive: true });

  const where: Record<string, unknown> = { status: "pending" };
  if (deptCode) where.idDepartmentCode = deptCode;

  const pending = await prisma.e14ActaIndex.findMany({
    where,
    take: limit,
    orderBy: [{ idDepartmentCode: "asc" }, { idTransmissionCode: "asc" }],
  });

  if (pending.length === 0) {
    console.log("No hay actas pendientes para descargar.");
    return;
  }

  console.log(`Descargando ${pending.length} PDFs (sin OCR)...`);

  const browser = await firefox.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:125.0) Gecko/20100101 Firefox/125.0",
    ignoreHTTPSErrors: true,
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/home`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);

  let ok = 0, errors = 0;

  for (let i = 0; i < pending.length; i++) {
    const acta = pending[i];
    const pdfPath = path.join(PDF_DIR, `${acta.idTransmissionCode}.pdf`);
    const url = buildPdfUrl(acta);

    process.stdout.write(`[${i + 1}/${pending.length}] ${acta.idTransmissionCode} `);

    if (fs.existsSync(pdfPath)) {
      await prisma.e14ActaIndex.update({
        where: { id: acta.id },
        data: { status: "downloaded", pdfPath, sourceUrl: url, updatedAt: new Date() },
      });
      console.log("💾 ya existe");
      ok++;
      continue;
    }

    try {
      const result = await page.evaluate(async ({ u, base }: { u: string; base: string }) => {
        const r = await fetch(u, {
          credentials: "include",
          headers: { "Accept": "application/pdf,*/*", "Referer": `${base}/home` },
        });
        const ab = await r.arrayBuffer();
        const b = new Uint8Array(ab);
        return { status: r.status, isPDF: b[0] === 0x25 && b[1] === 0x50, bytes: Array.from(b) };
      }, { u: url, base: BASE });

      if (result.isPDF) {
        fs.writeFileSync(pdfPath, Buffer.from(result.bytes));
        await prisma.e14ActaIndex.update({
          where: { id: acta.id },
          data: { status: "downloaded", pdfPath, sourceUrl: url, updatedAt: new Date() },
        });
        console.log("✓ descargado");
        ok++;
      } else {
        throw new Error(`HTTP ${result.status} not-PDF`);
      }
    } catch (e) {
      errors++;
      await prisma.e14ActaIndex.update({
        where: { id: acta.id },
        data: { status: "error", ocrError: `download: ${String(e)}`, updatedAt: new Date() },
      });
      console.log(`✗ ${e}`);
    }

    if ((i + 1) % 200 === 0) {
      await page.goto(`${BASE}/home`, { waitUntil: "domcontentloaded", timeout: 20000 });
      await page.waitForTimeout(1000);
    }
  }

  await browser.close();
  console.log(`\n=== Descargas: ${ok} OK, ${errors} errores ===`);
  console.log(`Ahora ejecuta: python3 scripts/ocr_gemini.py run ${ok}`);
}

// ─── Run pipeline ──────────────────────────────────────────────────────────
async function run(limit: number) {
  fs.mkdirSync(PDF_DIR, { recursive: true });

  // Tomar actas pendientes o descargadas-sin-OCR
  const pending = await prisma.e14ActaIndex.findMany({
    where: { status: { in: ["pending", "downloaded"] } },
    take: limit,
    orderBy: { idDepartmentCode: "asc" },
  });

  if (pending.length === 0) {
    console.log("No hay actas pendientes.");
    return;
  }

  console.log(`Procesando ${pending.length} actas...`);

  // Establecer sesión Firefox para descargar PDFs
  const browser = await firefox.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:125.0) Gecko/20100101 Firefox/125.0",
    ignoreHTTPSErrors: true,
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/home`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);

  let okDownload = 0, okOcr = 0, errors = 0;

  for (let i = 0; i < pending.length; i++) {
    const acta = pending[i];
    const pdfPath = path.join(PDF_DIR, `${acta.idTransmissionCode}.pdf`);
    const url = buildPdfUrl(acta);

    process.stdout.write(`[${i + 1}/${pending.length}] ${acta.idTransmissionCode} `);

    // 1. Descargar PDF si no existe
    if (!fs.existsSync(pdfPath)) {
      try {
        const result = await page.evaluate(async ({ u, base }: { u: string; base: string }) => {
          const r = await fetch(u, {
            credentials: "include",
            headers: { "Accept": "application/pdf,*/*", "Referer": `${base}/home` },
          });
          const ab = await r.arrayBuffer();
          const b = new Uint8Array(ab);
          return { status: r.status, isPDF: b[0] === 0x25 && b[1] === 0x50, bytes: Array.from(b) };
        }, { u: url, base: BASE });

        if (result.isPDF) {
          fs.writeFileSync(pdfPath, Buffer.from(result.bytes));
          okDownload++;
          await prisma.e14ActaIndex.update({
            where: { id: acta.id },
            data: { status: "downloaded", pdfPath, sourceUrl: url, updatedAt: new Date() },
          });
          process.stdout.write("📥 ");
        } else {
          throw new Error(`HTTP ${result.status} not-PDF`);
        }
      } catch (e) {
        errors++;
        await prisma.e14ActaIndex.update({
          where: { id: acta.id },
          data: { status: "error", ocrError: `download: ${String(e)}`, updatedAt: new Date() },
        });
        console.log(`✗ Download: ${e}`);
        continue;
      }
    } else {
      process.stdout.write("💾 ");
    }

    // 2. OCR con Claude Vision
    try {
      const ocrResult = await ocrE14(pdfPath, acta.idTransmissionCode);

      if (ocrResult._error) throw new Error(ocrResult._error);

      await prisma.e14ActaIndex.update({
        where: { id: acta.id },
        data: {
          status: "ocr_done",
          ocrResult: ocrResult as unknown as import("@prisma/client").Prisma.JsonObject,
          processedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      okOcr++;
      const candidatos = ocrResult.candidatos.map(c => `${c.nombre.split(" ")[0]}:${c.votos ?? "?"}`).join(", ");
      console.log(`✓ Mesa${ocrResult.mesa ?? "?"} ${ocrResult.municipio} | ${candidatos}`);
    } catch (e) {
      errors++;
      await prisma.e14ActaIndex.update({
        where: { id: acta.id },
        data: { status: "error", ocrError: `ocr: ${String(e)}`, updatedAt: new Date() },
      });
      console.log(`✗ OCR: ${e}`);
    }

    // Refresh Firefox session cada 200 actas
    if ((i + 1) % 200 === 0) {
      await page.goto(`${BASE}/home`, { waitUntil: "domcontentloaded", timeout: 20000 });
      await page.waitForTimeout(1000);
    }
  }

  await browser.close();

  console.log(`\n=== RESUMEN ===`);
  console.log(`Descargadas: ${okDownload}, OCR OK: ${okOcr}, Errores: ${errors}`);
}

// ─── Entry point ────────────────────────────────────────────────────────────
async function main() {
  const cmd = process.argv[2];
  const n = parseInt(process.argv[3] ?? "20");

  if (cmd === "seed") {
    await seed();
  } else if (cmd === "stats") {
    await stats();
  } else if (cmd === "run") {
    await run(n);
  } else if (cmd === "download") {
    const dept = process.argv[4]; // optional dept code e.g. "01"
    await downloadOnly(n, dept);
  } else {
    console.log("Comandos:");
    console.log("  seed               — carga el índice desde allTransmissionCodes.json");
    console.log("  run [N]            — descarga y OCR con Claude (N actas)");
    console.log("  download [N] [dept] — solo descarga PDFs, sin OCR (luego usar ocr_gemini.py)");
    console.log("  stats              — estadísticas del pipeline");
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
