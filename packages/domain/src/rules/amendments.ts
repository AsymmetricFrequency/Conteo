import { FindingCategory, Severity, type Finding } from "../findings";
import { listCells } from "../e14";
import type { Rule } from "./types";

const RULE_ID = "amendments";

/**
 * Regla de ENMENDADURAS: si la visión documental marcó alguna celda con
 * tachadura/enmendadura/sobreescritura, se levanta un hallazgo ALTA.
 *
 * Sustento: la Registraduría reconoce que las tachaduras o enmendaduras
 * pueden ser causal para solicitar recuento ante la comisión escrutadora.
 * La decisión es siempre humana; aquí solo se señala el hecho.
 */
export const amendmentsRule: Rule = {
  id: RULE_ID,
  descripcion:
    "Detecta tachaduras/enmendaduras/sobreescrituras en las celdas. Causal reconocida de recuento.",
  evaluate(form) {
    const afectados = listCells(form)
      .filter(({ cell }) => cell.hasAmendment === true)
      .map(({ field }) => field);

    if (afectados.length === 0) return [];

    const finding: Finding = {
      ruleId: RULE_ID,
      category: FindingCategory.DOCUMENTO_CON_ENMENDADURAS,
      severity: Severity.ALTA,
      message: `Se detectaron tachaduras/enmendaduras en ${afectados.length} campo(s): ${afectados.join(
        ", ",
      )}. Es causal para solicitar recuento.`,
      fields: afectados,
      details: { camposAfectados: afectados },
    };
    return [finding];
  },
};
