import { Queue } from "bullmq";
import { config } from "./config";

function parseRedisUrl(url: string) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 6379,
    password: u.password || undefined,
    db: u.pathname ? Number(u.pathname.replace("/", "")) || 0 : 0,
    maxRetriesPerRequest: null as null,
  };
}

export const QUEUES = {
  CRAWLER: "crawler",
  OCR: "ocr",
} as const;

const connection = parseRedisUrl(config.redisUrl);

export const crawlerQueue = new Queue(QUEUES.CRAWLER, { connection });
export const ocrQueue = new Queue(QUEUES.OCR, { connection });

export function newConnection() {
  return parseRedisUrl(config.redisUrl);
}
