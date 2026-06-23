/** Configuración de los workers, leída del entorno. */
export const config = {
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  /** API interna a la que se POSTea el E-14 extraído para ingesta+validación. */
  apiUrl: process.env.API_URL ?? "http://localhost:3001/api",
  /** Proveedor de OCR: stub | gcp-documentai | aws-textract | azure-di. */
  ocrProvider: process.env.OCR_PROVIDER ?? "stub",
  crawler: {
    userAgent:
      process.env.CRAWLER_USER_AGENT ?? "ConteoAuditBot/0.1 (+contacto@ejemplo.org)",
    /** Peticiones por segundo (cortesía con el portal oficial). */
    maxRps: Number(process.env.CRAWLER_MAX_RPS ?? "1"),
    concurrency: Number(process.env.CRAWLER_CONCURRENCY ?? "2"),
  },
};
