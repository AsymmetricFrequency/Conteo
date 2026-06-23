/**
 * Re-procesa actas ya OCR'd con el prompt mejorado que incluye:
 * - tipoCopia (CLAVEROS | DELEGADOS)
 * - nivelación de mesa (E-11, urna, incinerados)
 * - detección forense de enmiendas visuales
 * - sumaTotal, votosNoMarcados
 *
 * Uso:
 *   npx tsx scripts/reocr-enhanced.ts [limit]
 */
import { PrismaClient } from "@prisma/client";
import { ocrE14 } from "./ocr-e14";

const prisma = new PrismaClient();

async function main() {
  const limit = parseInt(process.argv[2] ?? "50");

  const actas = await prisma.e14ActaIndex.findMany({
    where: { status: "ocr_done", pdfPath: { not: null } },
    take: limit,
    orderBy: { processedAt: "asc" },
  });

  if (actas.length === 0) {
    console.log("No hay actas con OCR para reprocesar.");
    await prisma.$disconnect();
    return;
  }

  console.log(`Re-OCR mejorado para ${actas.length} actas...\n`);

  let ok = 0, errors = 0;

  for (let i = 0; i < actas.length; i++) {
    const acta = actas[i];
    process.stdout.write(`[${i + 1}/${actas.length}] ${acta.idTransmissionCode} `);

    try {
      const ocrResult = await ocrE14(acta.pdfPath!, acta.idTransmissionCode);

      if (ocrResult._error) throw new Error(ocrResult._error);

      await prisma.e14ActaIndex.update({
        where: { id: acta.id },
        data: {
          ocrResult: ocrResult as unknown as import("@prisma/client").Prisma.JsonObject,
          processedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const c = ocrResult.candidatos;
      const cepeda = c.find(x => x.nombre.toUpperCase().includes("CEPEDA"))?.votos ?? "?";
      const espriella = c.find(x => x.nombre.toUpperCase().includes("ESPRIELLA") || x.nombre.toUpperCase().includes("ESPRI"))?.votos ?? "?";
      const flag = ocrResult.hayEnmiendas ? ` ⚠ ENMIENDA[${ocrResult.severidadAnomalia}]` : "";
      console.log(`✓ ${ocrResult.tipoCopia} Mesa${ocrResult.mesa} ${ocrResult.municipio} | Cepeda:${cepeda} Espriella:${espriella}${flag}`);
      ok++;
    } catch (e) {
      errors++;
      console.log(`✗ ${e}`);
    }
  }

  console.log(`\n=== Re-OCR completado: ${ok} OK, ${errors} errores ===`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
