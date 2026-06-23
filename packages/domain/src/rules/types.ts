import type { E14 } from "../e14";
import type { Finding } from "../findings";
import type { PreconteoResult } from "../preconteo";

/**
 * Umbrales configurables para mapear magnitudes a severidad. Permiten
 * absorber ruido del OCR (diferencias mínimas) sin disparar alertas ALTA.
 */
export interface Thresholds {
  /** Confianza mínima del OCR; por debajo se marca BAJA_CONFIANZA_OCR. */
  ocrMinConfidence: number;
  /** |diferencia| <= este valor => BAJA. */
  arithmeticDiffBaja: number;
  /** |diferencia| <= este valor => MEDIA; por encima => ALTA. */
  arithmeticDiffMedia: number;
  /** Umbrales equivalentes para la comparación contra preconteo. */
  preconteoDiffBaja: number;
  preconteoDiffMedia: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = {
  ocrMinConfidence: 0.6,
  arithmeticDiffBaja: 2,
  arithmeticDiffMedia: 9,
  preconteoDiffBaja: 2,
  preconteoDiffMedia: 9,
};

export interface RuleContext {
  rulesVersion: string;
  thresholds: Thresholds;
  /** Resultado de preconteo de la misma mesa (si está disponible). */
  preconteo?: PreconteoResult;
}

/**
 * Una regla determinística. Recibe el E-14 normalizado y el contexto, y
 * devuelve cero o más hallazgos. NUNCA decide "fraude": describe hechos.
 */
export interface Rule {
  id: string;
  descripcion: string;
  evaluate(form: E14, ctx: RuleContext): Finding[];
}
