import type { E14 } from "@conteo/domain";

/**
 * Datos de entrada de un job de OCR: la mesa, la elección, la definición
 * de la tarjeta (candidatos) y la evidencia YA almacenada de forma
 * inmutable (storageKey + sha256 + sourceUrl). El proveedor de OCR lee la
 * imagen referenciada y devuelve el E-14 normalizado.
 */
export interface OcrJobData {
  eleccion: E14["eleccion"];
  ubicacion: E14["ubicacion"];
  candidatos: Array<{ candidateId: string; nombre: string; partido?: string }>;
  evidencia: E14["evidencia"];
}

export interface OcrProvider {
  readonly name: string;
  readonly version: string;
  /** Extrae los campos del acta a partir de la evidencia. */
  extract(data: OcrJobData): Promise<E14>;
}
