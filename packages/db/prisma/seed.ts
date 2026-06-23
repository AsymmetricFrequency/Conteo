import { PrismaClient, SourceType } from "@prisma/client";
import { validateE14, cell, type E14 } from "@conteo/domain";

const prisma = new PrismaClient();

/**
 * Semilla de demostración: crea una mesa con un E-14 que tiene una
 * inconsistencia aritmética (suma 271 vs total 276), corre el motor de
 * validación y persiste el reporte con sus hallazgos. Sirve para ver el
 * dashboard con datos reales de extremo a extremo.
 */
async function main() {
  const fecha = new Date("2026-05-31T00:00:00.000Z");

  const eleccion = await prisma.eleccion.upsert({
    where: { tipo_vuelta_fecha: { tipo: "PRESIDENCIAL", vuelta: 1, fecha } },
    update: {},
    create: { tipo: "PRESIDENCIAL", vuelta: 1, fecha },
  });

  const mesa = await prisma.mesa.upsert({
    where: { ubicacionKey: "76-001-02-05-01" },
    update: {},
    create: {
      departamentoCodigo: "76",
      departamento: "Valle del Cauca",
      municipioCodigo: "001",
      municipio: "Cali",
      zonaCodigo: "02",
      puestoCodigo: "05",
      puesto: "I.E. Ejemplo",
      mesa: "01",
      ubicacionKey: "76-001-02-05-01",
    },
  });

  const candA = await prisma.candidato.upsert({
    where: { externalId: "A" },
    update: {},
    create: { externalId: "A", nombre: "Candidata A", partido: "Partido 1" },
  });
  const candB = await prisma.candidato.upsert({
    where: { externalId: "B" },
    update: {},
    create: { externalId: "B", nombre: "Candidato B", partido: "Partido 2" },
  });

  // E-14 con inconsistencia: 150 + 95 + 20 + 5 + 1 = 271, pero total = 276.
  const e14: E14 = {
    id: "seed-e14-001",
    formType: "E14_PRESIDENCIA",
    eleccion: { tipo: "PRESIDENCIAL", vuelta: 1, fecha: "2026-05-31" },
    ubicacion: {
      departamentoCodigo: "76",
      departamento: "Valle del Cauca",
      municipioCodigo: "001",
      municipio: "Cali",
      zonaCodigo: "02",
      puestoCodigo: "05",
      puesto: "I.E. Ejemplo",
      mesa: "01",
    },
    totalSufragantesE11: cell(276),
    candidatos: [
      { candidateId: "A", nombre: "Candidata A", partido: "Partido 1", votos: cell(150) },
      { candidateId: "B", nombre: "Candidato B", partido: "Partido 2", votos: cell(95) },
    ],
    votosEnBlanco: cell(20),
    votosNulos: cell(5),
    votosNoMarcados: cell(1),
    totalVotosUrna: cell(276),
    jurados: { esperados: 3, firmasPresentes: 3 },
    evidencia: {
      sourceType: "REGISTRADURIA_OFICIAL",
      sourceUrl: "https://example.org/e14/76-001-02-05-01.pdf",
      storageKey: "evidence/76-001-02-05-01/original.pdf",
      sha256: "a".repeat(64),
      mimeType: "application/pdf",
      capturedAt: "2026-05-31T20:00:00.000Z",
      fileName: "e14.pdf",
      byteSize: 123456,
    },
    extraccion: {
      ocrProvider: "stub",
      ocrVersion: "0.1.0",
      extractedAt: "2026-05-31T20:05:00.000Z",
      overallConfidence: 0.95,
    },
  };

  const report = validateE14(e14, { evaluatedAt: "2026-05-31T21:00:00.000Z" });

  // Idempotencia básica para re-ejecutar la semilla.
  await prisma.formE14.deleteMany({ where: { id: e14.id } });

  const form = await prisma.formE14.create({
    data: {
      id: e14.id,
      formType: e14.formType,
      source: SourceType.REGISTRADURIA_OFICIAL,
      eleccionId: eleccion.id,
      mesaId: mesa.id,
      totalSufragantesE11: e14.totalSufragantesE11,
      votosEnBlanco: e14.votosEnBlanco,
      votosNulos: e14.votosNulos,
      votosNoMarcados: e14.votosNoMarcados,
      totalVotosUrna: e14.totalVotosUrna,
      juradosEsperados: e14.jurados?.esperados,
      juradosFirmasPresentes: e14.jurados?.firmasPresentes,
      votos: {
        create: [
          { candidatoId: candA.id, value: 150 },
          { candidatoId: candB.id, value: 95 },
        ],
      },
      evidencia: {
        create: {
          sourceType: SourceType.REGISTRADURIA_OFICIAL,
          sourceUrl: e14.evidencia.sourceUrl,
          storageKey: e14.evidencia.storageKey,
          sha256: e14.evidencia.sha256,
          mimeType: e14.evidencia.mimeType,
          capturedAt: new Date(e14.evidencia.capturedAt),
          fileName: e14.evidencia.fileName,
          byteSize: e14.evidencia.byteSize,
        },
      },
      extraccion: {
        create: {
          ocrProvider: e14.extraccion.ocrProvider,
          ocrVersion: e14.extraccion.ocrVersion,
          extractedAt: new Date(e14.extraccion.extractedAt),
          overallConfidence: e14.extraccion.overallConfidence,
        },
      },
    },
  });

  await prisma.validationReport.create({
    data: {
      formId: form.id,
      rulesVersion: report.rulesVersion,
      evaluatedAt: new Date(report.evaluatedAt),
      maxSeverity: report.maxSeverity ?? undefined,
      resumen: report.resumen,
      findings: {
        create: report.findings.map((f) => ({
          ruleId: f.ruleId,
          category: f.category,
          severity: f.severity,
          message: f.message,
          fields: f.fields,
          details: f.details ?? undefined,
        })),
      },
    },
  });

  console.log(
    `Seed OK → form=${form.id} hallazgos=${report.findings.length} maxSeverity=${report.maxSeverity}`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
