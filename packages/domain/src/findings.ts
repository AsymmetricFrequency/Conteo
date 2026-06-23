/**
 * Severidad de un hallazgo. Determina la priorización en el dashboard.
 */
export const Severity = {
  BAJA: "BAJA",
  MEDIA: "MEDIA",
  ALTA: "ALTA",
} as const;
export type Severity = (typeof Severity)[keyof typeof Severity];

export const SEVERITY_ORDER: Record<Severity, number> = {
  BAJA: 1,
  MEDIA: 2,
  ALTA: 3,
};

export function maxSeverity(a: Severity, b: Severity): Severity {
  return SEVERITY_ORDER[a] >= SEVERITY_ORDER[b] ? a : b;
}

/**
 * Categorías de hallazgo. Deliberadamente NO existe "FRAUDE": el
 * sistema describe inconsistencias y posibles causales, nunca emite un
 * veredicto. La decisión jurídica es siempre humana.
 */
export const FindingCategory = {
  INCONSISTENCIA_ARITMETICA: "INCONSISTENCIA_ARITMETICA",
  CAMPO_OBLIGATORIO_FALTANTE: "CAMPO_OBLIGATORIO_FALTANTE",
  POSIBLE_ERROR_DILIGENCIAMIENTO: "POSIBLE_ERROR_DILIGENCIAMIENTO",
  DOCUMENTO_CON_ENMENDADURAS: "DOCUMENTO_CON_ENMENDADURAS",
  DIFERENCIA_PRECONTEO_E14: "DIFERENCIA_PRECONTEO_E14",
  BAJA_CONFIANZA_OCR: "BAJA_CONFIANZA_OCR",
  CASO_PARA_REVISION_JURIDICA: "CASO_PARA_REVISION_JURIDICA",
} as const;
export type FindingCategory =
  (typeof FindingCategory)[keyof typeof FindingCategory];

/**
 * Un hallazgo individual producido por una regla. Cada hallazgo apunta
 * a los campos implicados y trae los números que lo sustentan, para que
 * un revisor humano pueda verificarlo contra la evidencia original.
 */
export interface Finding {
  ruleId: string;
  category: FindingCategory;
  severity: Severity;
  message: string;
  /** Campos del E-14 implicados (para resaltar en el visor). */
  fields: string[];
  /** Datos numéricos de soporte (suma, diferencia, etc.). */
  details?: Record<string, unknown>;
}
