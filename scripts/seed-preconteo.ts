/**
 * Seed directo a Postgres desde el JSONL del crawler (sin pasar por HTTP).
 * Usa el PrismaClient de @conteo/db.
 *
 * Uso: pnpm tsx scripts/seed-preconteo.ts [jsonl-file]
 */
import { PrismaClient } from "@conteo/db";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

const file = process.argv[2] ?? "/tmp/preconteo-completo.jsonl";
const ELECCION_ID = "PR-2026-2";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL ?? "postgresql://conteo:conteo@localhost:5432/conteo?schema=public" } },
});

interface MunicipioRow {
  code: string;
  nombre: string;
  deptCode: string;
  dept: string;
  mesas: { total: number; escrutadas: number; pct: string };
  sufragantes: number;
  votos: Array<{ codcan: string; cedula: string; nombre: string; vot: number; pvot: string }>;
  votnul: number;
  votblan: number;
  capturedAt: string;
  numact: string;
}

async function main() {
  console.log(`Seeding preconteo from ${file}...`);

  const rl = createInterface({ input: createReadStream(file), crlfDelay: Infinity });

  let total = 0;
  let created = 0;
  let skipped = 0;
  let errors = 0;

  for await (const line of rl) {
    if (!line.trim()) continue;
    let data: MunicipioRow;
    try {
      const parsed = JSON.parse(line) as Record<string, unknown>;
      if ("meta" in parsed) continue;
      data = parsed as unknown as MunicipioRow;
    } catch {
      continue;
    }

    total++;
    try {
      const existing = await prisma.preconteoMunicipio.findUnique({
        where: {
          eleccion_munCodigo_numact: {
            eleccion: ELECCION_ID,
            munCodigo: data.code,
            numact: data.numact,
          },
        },
        select: { id: true },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await prisma.preconteoMunicipio.create({
        data: {
          eleccion: ELECCION_ID,
          munCodigo: data.code,
          munNombre: data.nombre,
          deptCodigo: data.deptCode,
          deptNombre: data.dept,
          mesasTotal: data.mesas.total,
          mesasEsc: data.mesas.escrutadas,
          sufragantes: data.sufragantes,
          votnul: data.votnul,
          votblan: data.votblan,
          numact: data.numact,
          capturedAt: new Date(data.capturedAt),
          votos: {
            create: data.votos.map((v) => ({
              codcan: v.codcan,
              cedula: v.cedula,
              nombre: v.nombre,
              vot: v.vot,
              pvot: v.pvot,
            })),
          },
        },
      });
      created++;

      if (created % 100 === 0) {
        console.log(`  ${created}/${total} municipios ingresados...`);
      }
    } catch (e) {
      errors++;
      console.error(`  ✗ ${data.code} ${data.nombre}: ${e}`);
    }
  }

  await prisma.$disconnect();

  console.log(`\nCompletado:`);
  console.log(`  Procesados: ${total}`);
  console.log(`  Creados: ${created}`);
  console.log(`  Saltados (ya existían): ${skipped}`);
  console.log(`  Errores: ${errors}`);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
