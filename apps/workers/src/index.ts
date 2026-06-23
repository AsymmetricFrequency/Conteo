import { startCrawlerWorker } from "./workers/crawler.worker";
import { startOcrWorker } from "./workers/ocr.worker";
import { config } from "./config";

/**
 * Proceso persistente de workers. Es el "backend de procesamiento":
 * corre por horas/días, con reintentos y rate-limit, fuera del ciclo
 * request/response.
 */
const crawler = startCrawlerWorker();
const ocr = startOcrWorker();

console.log(
  `Workers de Conteo arriba (redis=${config.redisUrl}, api=${config.apiUrl}, ocr=${config.ocrProvider})`,
);

async function shutdown() {
  console.log("Cerrando workers...");
  await Promise.all([crawler.close(), ocr.close()]);
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
