import { FindingCategory, Severity, type Finding } from "../findings";
import type { Rule, Thresholds } from "./types";

const RULE_ID = "arithmetic-consistency";

function severityForDiff(absDiff: number, t: Thresholds): Severity {
  if (absDiff <= t.arithmeticDiffBaja) return Severity.BAJA;
  if (absDiff <= t.arithmeticDiffMedia) return Severity.MEDIA;
  return Severity.ALTA;
}

/**
 * Regla de SUMATORIA y consistencia aritmética:
 *  (1) Σ votos candidatos + blanco + nulos + no marcados == total en urna.
 *  (2) total en urna ≈ sufragantes del E-11. Más votos que sufragantes es
 *      especialmente grave (urna con más votos que votantes) => ALTA.
 */
export const arithmeticRule: Rule = {
  id: RULE_ID,
  descripcion:
    "Suma de votos por candidatos + blanco + nulos + no marcados debe igualar el total en urna; y el total debe corresponder a los sufragantes del E-11.",
  evaluate(form, ctx) {
    const findings: Finding[] = [];
    const componentes = [
      ...form.candidatos.map((c) => c.votos),
      form.votosEnBlanco,
      form.votosNulos,
      form.votosNoMarcados,
    ];
    const total = form.totalVotosUrna.value;
    const hayNull = componentes.some((c) => c.value === null);

    // (1) Suma de componentes vs total reportado.
    if (!hayNull && total !== null) {
      const suma = componentes.reduce((acc, c) => acc + (c.value ?? 0), 0);
      const diff = total - suma;
      if (diff !== 0) {
        findings.push({
          ruleId: RULE_ID,
          category: FindingCategory.INCONSISTENCIA_ARITMETICA,
          severity: severityForDiff(Math.abs(diff), ctx.thresholds),
          message: `La suma de votos (${suma}) no coincide con el total reportado en la urna (${total}). Diferencia: ${diff}.`,
          fields: [
            "totalVotosUrna",
            "votosEnBlanco",
            "votosNulos",
            "votosNoMarcados",
            "candidatos",
          ],
          details: { suma, totalReportado: total, diferencia: diff },
        });
      }
    }

    // (2) Sufragantes E-11 vs total en urna.
    const sufragantes = form.totalSufragantesE11.value;
    if (sufragantes !== null && total !== null) {
      const diff = total - sufragantes;
      if (diff !== 0) {
        const masVotosQueSufragantes = diff > 0;
        findings.push({
          ruleId: RULE_ID,
          category: masVotosQueSufragantes
            ? FindingCategory.INCONSISTENCIA_ARITMETICA
            : FindingCategory.POSIBLE_ERROR_DILIGENCIAMIENTO,
          severity: masVotosQueSufragantes
            ? Severity.ALTA
            : severityForDiff(Math.abs(diff), ctx.thresholds),
          message: masVotosQueSufragantes
            ? `Hay más votos en la urna (${total}) que sufragantes registrados en el E-11 (${sufragantes}). Exceso: ${diff}.`
            : `El total de votos en la urna (${total}) es menor que los sufragantes del E-11 (${sufragantes}). Diferencia: ${diff}.`,
          fields: ["totalVotosUrna", "totalSufragantesE11"],
          details: { sufragantesE11: sufragantes, totalUrna: total, diferencia: diff },
        });
      }
    }

    return findings;
  },
};
