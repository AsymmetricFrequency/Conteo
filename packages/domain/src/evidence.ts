import { z } from "zod";

/**
 * Origen del documento. La prevalencia jurídica difiere por fuente:
 * el E-14 oficial prevalece sobre el preconteo; las fotos de testigos
 * son insumo de contraste, no prueba autónoma.
 */
export const SourceTypeSchema = z.enum([
  "REGISTRADURIA_OFICIAL",
  "PRECONTEO",
  "TESTIGO_FOTO",
  "DATOS_ABIERTOS",
  "CARGA_MANUAL",
]);
export type SourceType = z.infer<typeof SourceTypeSchema>;

/**
 * Referencia inmutable a la evidencia original almacenada en object
 * storage. Es la base de la cadena de custodia: archivo original +
 * hash + URL fuente + momento de captura.
 */
export const EvidenceRefSchema = z.object({
  sourceType: SourceTypeSchema,
  /** URL oficial de donde se descargó (cuando aplica). */
  sourceUrl: z.string().url().optional(),
  /** Llave en el bucket inmutable (S3/R2/MinIO). */
  storageKey: z.string().min(1),
  /** SHA-256 hex del archivo original (64 chars). */
  sha256: z.string().regex(/^[a-f0-9]{64}$/i, "SHA-256 hex de 64 chars"),
  mimeType: z.string().min(1),
  /** Momento de descarga o captura, ISO 8601. */
  capturedAt: z.string().datetime(),
  fileName: z.string().optional(),
  byteSize: z.number().int().nonnegative().optional(),
});

export type EvidenceRef = z.infer<typeof EvidenceRefSchema>;

/**
 * Metadatos de la extracción (OCR/visión). Se versiona para que cada
 * reporte sea reproducible y auditable.
 */
export const ExtractionMetaSchema = z.object({
  ocrProvider: z.string().min(1),
  ocrVersion: z.string().min(1),
  extractedAt: z.string().datetime(),
  overallConfidence: z.number().min(0).max(1).optional(),
});

export type ExtractionMeta = z.infer<typeof ExtractionMetaSchema>;
