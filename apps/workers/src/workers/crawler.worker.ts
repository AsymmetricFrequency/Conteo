import { Worker } from "bullmq";
import { QUEUES, newConnection, ocrQueue } from "../queues";
import { config } from "../config";

/** Job de crawl: una mesa a descargar del portal oficial. */
export interface CrawlJobData {
  ubicacionKey: string;
  sourceUrl: string;
}

/**
 * Worker del CRAWLER CONTROLADO (stub). En la implementación real:
 *   1. fetch(sourceUrl) con User-Agent de cortesía y rate-limit.
 *   2. Guardar el binario original en object storage (storageKey).
 *   3. Calcular SHA-256 y sellar la evidencia (capturedAt, sourceUrl).
 *   4. Encolar un job de OCR con la referencia de evidencia.
 *
 * El limiter impone un máximo de peticiones por segundo para no agredir
 * el portal oficial.
 */
export function startCrawlerWorker(): Worker<CrawlJobData> {
  const worker = new Worker<CrawlJobData>(
    QUEUES.CRAWLER,
    async (job) => {
      console.log(
        `[crawler] (stub) descargaría ${job.data.sourceUrl} (${job.data.ubicacionKey}) ` +
          `UA="${config.crawler.userAgent}"`,
      );
      // En real, aquí se encolaría el OCR tras almacenar la evidencia:
      // await ocrQueue.add("ocr", { ...evidencia });
      void ocrQueue;
      return { ok: true, ubicacionKey: job.data.ubicacionKey };
    },
    {
      connection: newConnection(),
      concurrency: config.crawler.concurrency,
      limiter: { max: config.crawler.maxRps, duration: 1000 },
    },
  );

  worker.on("failed", (job, err) =>
    console.error(`[crawler] falló ${job?.id}:`, err.message),
  );
  return worker;
}
