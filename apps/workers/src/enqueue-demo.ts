import { ocrQueue } from "./queues";
import type { OcrJobData } from "./ocr/types";

/**
 * Encola un job de OCR de demostración. Útil para probar el pipeline
 * completo una vez que Redis + API + DB están arriba:
 *
 *   pnpm --filter @conteo/workers enqueue:demo
 *
 * El worker de OCR (stub) producirá un E-14 con una inconsistencia y lo
 * POSTeará a la API, que lo validará y lo persistirá con sus hallazgos.
 */
async function main() {
  const data: OcrJobData = {
    eleccion: { tipo: "PRESIDENCIAL", vuelta: 1, fecha: "2026-05-31" },
    ubicacion: {
      departamentoCodigo: "76",
      departamento: "Valle del Cauca",
      municipioCodigo: "001",
      municipio: "Cali",
      zonaCodigo: "02",
      puestoCodigo: "05",
      puesto: "I.E. Ejemplo",
      mesa: "07",
    },
    candidatos: [
      { candidateId: "A", nombre: "Candidata A", partido: "Partido 1" },
      { candidateId: "B", nombre: "Candidato B", partido: "Partido 2" },
    ],
    evidencia: {
      sourceType: "REGISTRADURIA_OFICIAL",
      sourceUrl: "https://example.org/e14/76-001-02-05-07.pdf",
      storageKey: "evidence/76-001-02-05-07/original.pdf",
      sha256: "b".repeat(64),
      mimeType: "application/pdf",
      capturedAt: new Date().toISOString(),
      fileName: "e14.pdf",
      byteSize: 123456,
    },
  };

  const job = await ocrQueue.add("demo", data);
  console.log(`Encolado job de OCR demo: ${job.id}`);
  await ocrQueue.close();
  process.exit(0);
}

void main();
