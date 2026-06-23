import { FindingCategory, Severity, type Finding } from "../findings";
import { listCells } from "../e14";
import type { Rule } from "./types";

const RULE_ID = "required-fields";

/**
 * Regla de CAMPOS OBLIGATORIOS: verifica que las celdas clave estén
 * diligenciadas y legibles, marca baja confianza del OCR, y revisa que
 * el acta tenga las firmas de jurados esperadas.
 */
export const requiredFieldsRule: Rule = {
  id: RULE_ID,
  descripcion:
    "Verifica campos obligatorios diligenciados, legibilidad, confianza mínima del OCR y firmas de jurados.",
  evaluate(form, ctx) {
    const findings: Finding[] = [];

    for (const { field, cell } of listCells(form)) {
      if (cell.value === null) {
        findings.push({
          ruleId: RULE_ID,
          category: FindingCategory.CAMPO_OBLIGATORIO_FALTANTE,
          severity: Severity.MEDIA,
          message: cell.illegible
            ? `El campo "${field}" está ilegible y requiere lectura humana.`
            : `El campo obligatorio "${field}" no está diligenciado o no pudo extraerse.`,
          fields: [field],
          details: { illegible: cell.illegible === true },
        });
        continue;
      }

      if (
        cell.confidence !== undefined &&
        cell.confidence < ctx.thresholds.ocrMinConfidence
      ) {
        findings.push({
          ruleId: RULE_ID,
          category: FindingCategory.BAJA_CONFIANZA_OCR,
          severity: Severity.BAJA,
          message: `El campo "${field}" se extrajo con baja confianza (${cell.confidence.toFixed(
            2,
          )}). Se recomienda verificación humana.`,
          fields: [field],
          details: { confidence: cell.confidence, umbral: ctx.thresholds.ocrMinConfidence },
        });
      }
    }

    if (form.jurados && form.jurados.firmasPresentes < form.jurados.esperados) {
      findings.push({
        ruleId: RULE_ID,
        category: FindingCategory.POSIBLE_ERROR_DILIGENCIAMIENTO,
        severity: Severity.MEDIA,
        message: `Faltan firmas de jurados: ${form.jurados.firmasPresentes} de ${form.jurados.esperados} esperadas.`,
        fields: ["jurados"],
        details: { ...form.jurados },
      });
    }

    return findings;
  },
};
