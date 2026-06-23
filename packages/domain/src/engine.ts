import { E14Schema, type E14 } from "./e14";
import { ubicacionKey } from "./geography";
import {
  FindingCategory,
  maxSeverity,
  Severity,
  type Finding,
} from "./findings";
import {
  DEFAULT_THRESHOLDS,
  type Rule,
  type RuleContext,
  type Thresholds,
} from "./rules/types";
import { DEFAULT_RULES } from "./rules";
import type { PreconteoResult } from "./preconteo";
import type { EvidenceRef, ExtractionMeta } from "./evidence";

/** Versión por defecto del conjunto de reglas (se sella en cada reporte). */
export const DEFAULT_RULES_VERSION = "2026.06.0";

export interface ValidationOptions {
  rulesVersion?: string;
  /** ISO 8601; permite reportes deterministas/reproducibles en tests. */
  evaluatedAt?: string;
  thresholds?: Partial<Thresholds>;
  preconteo?: PreconteoResult;
  /** Sobrescribe el conjunto de reglas (por defecto DEFAULT_RULES). */
  rules?: Rule[];
}

export interface ValidationReport {
  formId: string;
  ubicacionKey: string;
  rulesVersion: string;
  evaluatedAt: string;
  findings: Finding[];
  maxSeverity: Severity | null;
  resumen: {
    total: number;
    porSeveridad: Record<Severity, number>;
    porCategoria: Partial<Record<FindingCategory, number>>;
  };
  /** Se arrastra la evidencia para cerrar la cadena de custodia en el reporte. */
  evidencia: EvidenceRef;
  extraccion: ExtractionMeta;
}

/**
 * Punto de entrada del motor de validación. Valida la forma del E-14,
 * corre todas las reglas y agrega los hallazgos en un reporte auditable.
 *
 * No emite veredictos de "fraude": produce hallazgos descriptivos para
 * revisión humana. Si hay al menos un hallazgo ALTA, sugiere revisión
 * jurídica (categoría CASO_PARA_REVISION_JURIDICA).
 */
export function validateE14(
  input: E14 | unknown,
  options: ValidationOptions = {},
): ValidationReport {
  const form = E14Schema.parse(input);

  const ctx: RuleContext = {
    rulesVersion: options.rulesVersion ?? DEFAULT_RULES_VERSION,
    thresholds: { ...DEFAULT_THRESHOLDS, ...(options.thresholds ?? {}) },
    preconteo: options.preconteo,
  };

  const rules = options.rules ?? DEFAULT_RULES;
  const findings: Finding[] = rules.flatMap((r) => r.evaluate(form, ctx));

  let max: Severity | null = null;
  for (const f of findings) {
    max = max === null ? f.severity : maxSeverity(max, f.severity);
  }

  if (max === Severity.ALTA) {
    findings.push({
      ruleId: "engine-escalation",
      category: FindingCategory.CASO_PARA_REVISION_JURIDICA,
      severity: Severity.ALTA,
      message:
        "Este caso presenta al menos un hallazgo de severidad ALTA. Se recomienda revisión jurídica y eventual reclamación, sustentada en la evidencia original, ante la comisión escrutadora.",
      fields: [],
    });
  }

  const porSeveridad: Record<Severity, number> = { BAJA: 0, MEDIA: 0, ALTA: 0 };
  const porCategoria: Partial<Record<FindingCategory, number>> = {};
  for (const f of findings) {
    porSeveridad[f.severity] += 1;
    porCategoria[f.category] = (porCategoria[f.category] ?? 0) + 1;
  }

  return {
    formId: form.id,
    ubicacionKey: ubicacionKey(form.ubicacion),
    rulesVersion: ctx.rulesVersion,
    evaluatedAt: options.evaluatedAt ?? new Date().toISOString(),
    findings,
    maxSeverity: max,
    resumen: { total: findings.length, porSeveridad, porCategoria },
    evidencia: form.evidencia,
    extraccion: form.extraccion,
  };
}
