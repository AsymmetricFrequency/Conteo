import { Worker } from "bullmq";
import { QUEUES, newConnection } from "../queues";
import { getOcrProvider } from "../ocr";
import { config } from "../config";
import type { OcrJobData } from "../ocr/types";

/**
 * Worker de OCR: extrae el E-14 de la evidencia y lo POSTea a la API para
 * ingesta+validación+persistencia. La API es el único escritor; así la
 * lógica de negocio y la cadena de custodia viven en un solo lugar.
 */
export function startOcrWorker(): Worker<OcrJobData> {
  const provider = getOcrProvider();

  const worker = new Worker<OcrJobData>(
    QUEUES.OCR,
    async (job) => {
      const e14 = await provider.extract(job.data);
      const res = await fetch(`${config.apiUrl}/forms`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(e14),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Ingesta falló (${res.status}): ${text}`);
      }
      return (await res.json()) as unknown;
    },
    { connection: newConnection(), concurrency: 4 },
  );

  worker.on("completed", (job) => console.log(`[ocr] completado ${job.id}`));
  worker.on("failed", (job, err) =>
    console.error(`[ocr] falló ${job?.id}:`, err.message),
  );
  return worker;
}
