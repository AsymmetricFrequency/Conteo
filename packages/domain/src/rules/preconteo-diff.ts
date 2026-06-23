import { FindingCategory, Severity, type Finding } from "../findings";
import { ubicacionKey } from "../geography";
import type { Rule, Thresholds } from "./types";

const RULE_ID = "preconteo-diff";

function severityForDiff(absDiff: number, t: Thresholds): Severity {
  if (absDiff <= t.preconteoDiffBaja) return Severity.BAJA;
  if (absDiff <= t.preconteoDiffMedia) return Severity.MEDIA;
  return Severity.ALTA;
}

/**
 * Regla de DIFERENCIA PRECONTEO ↔ E-14. Sólo corre si hay preconteo de la
 * misma mesa. El E-14 PREVALECE jurídicamente sobre el preconteo; las
 * diferencias son insumo de revisión, no prueba de irregularidad.
 */
export const preconteoDiffRule: Rule = {
  id: RULE_ID,
  descripcion:
    "Contrasta votos por candidato entre E-14 y preconteo. El E-14 prevalece; las diferencias se señalan para verificación.",
  evaluate(form, ctx) {
    const pre = ctx.preconteo;
    if (!pre) return [];
    if (pre.ubicacionKey !== ubicacionKey(form.ubicacion)) return [];

    const findings: Finding[] = [];
    const preById = new Map(pre.porCandidato.map((p) => [p.candidateId, p.votos]));

    for (const c of form.candidatos) {
      const preVotos = preById.get(c.candidateId);
      if (preVotos === undefined || c.votos.value === null) continue;
      const diff = c.votos.value - preVotos;
      if (diff !== 0) {
        findings.push({
          ruleId: RULE_ID,
          category: FindingCategory.DIFERENCIA_PRECONTEO_E14,
          severity: severityForDiff(Math.abs(diff), ctx.thresholds),
          message: `Diferencia entre E-14 (${c.votos.value}) y preconteo (${preVotos}) para "${c.nombre}": ${diff}. El E-14 prevalece; verificar.`,
          fields: [`candidato:${c.candidateId}`],
          details: {
            candidato: c.nombre,
            e14: c.votos.value,
            preconteo: preVotos,
            diferencia: diff,
          },
        });
      }
    }

    return findings;
  },
};
