import { describe, it, expect } from "vitest";
import { validateE14 } from "../engine";
import { FindingCategory, Severity } from "../findings";
import { cell } from "../e14";
import { makeValidE14, FIXTURE_UBICACION_KEY } from "./fixtures";

const EVAL_AT = "2026-05-31T21:00:00.000Z";

function categories(report: { findings: { category: string }[] }): string[] {
  return report.findings.map((f) => f.category);
}

describe("validateE14", () => {
  it("un E-14 consistente no produce hallazgos", () => {
    const report = validateE14(makeValidE14(), { evaluatedAt: EVAL_AT });
    expect(report.findings).toHaveLength(0);
    expect(report.maxSeverity).toBeNull();
    expect(report.ubicacionKey).toBe(FIXTURE_UBICACION_KEY);
    // La cadena de custodia se arrastra al reporte.
    expect(report.evidencia.sha256).toHaveLength(64);
    expect(report.rulesVersion).toBe("2026.06.0");
    expect(report.evaluatedAt).toBe(EVAL_AT);
  });

  it("detecta inconsistencia aritmética (suma != total)", () => {
    // Candidato B = 95  =>  suma = 271, total en urna = 276 (ejemplo README).
    const form = makeValidE14({
      candidatos: [
        { candidateId: "A", nombre: "Candidata A", votos: cell(150) },
        { candidateId: "B", nombre: "Candidato B", votos: cell(95) },
      ],
    });
    const report = validateE14(form, { evaluatedAt: EVAL_AT });
    expect(categories(report)).toContain(FindingCategory.INCONSISTENCIA_ARITMETICA);
    const f = report.findings.find(
      (x) => x.category === FindingCategory.INCONSISTENCIA_ARITMETICA,
    );
    expect(f?.details).toMatchObject({ suma: 271, totalReportado: 276, diferencia: 5 });
  });

  it("marca ALTA cuando hay más votos que sufragantes", () => {
    const form = makeValidE14({
      totalSufragantesE11: cell(250),
      totalVotosUrna: cell(276),
    });
    const report = validateE14(form, { evaluatedAt: EVAL_AT });
    expect(report.maxSeverity).toBe(Severity.ALTA);
    expect(categories(report)).toContain(FindingCategory.CASO_PARA_REVISION_JURIDICA);
  });

  it("detecta campos obligatorios faltantes", () => {
    const form = makeValidE14({ votosNulos: cell(null) });
    const report = validateE14(form, { evaluatedAt: EVAL_AT });
    expect(categories(report)).toContain(FindingCategory.CAMPO_OBLIGATORIO_FALTANTE);
    // Con un componente nulo, la suma aritmética se omite (no falsos positivos).
    const aritmeticos = report.findings.filter(
      (f) => f.ruleId === "arithmetic-consistency" && f.details && "suma" in f.details,
    );
    expect(aritmeticos).toHaveLength(0);
  });

  it("marca baja confianza del OCR", () => {
    const form = makeValidE14({
      candidatos: [
        { candidateId: "A", nombre: "Candidata A", votos: cell(150, { confidence: 0.4 }) },
        { candidateId: "B", nombre: "Candidato B", votos: cell(100) },
      ],
    });
    const report = validateE14(form, { evaluatedAt: EVAL_AT });
    expect(categories(report)).toContain(FindingCategory.BAJA_CONFIANZA_OCR);
  });

  it("detecta enmendaduras y escala a revisión jurídica (ALTA)", () => {
    const form = makeValidE14({
      candidatos: [
        { candidateId: "A", nombre: "Candidata A", votos: cell(150, { hasAmendment: true }) },
        { candidateId: "B", nombre: "Candidato B", votos: cell(100) },
      ],
    });
    const report = validateE14(form, { evaluatedAt: EVAL_AT });
    expect(categories(report)).toContain(FindingCategory.DOCUMENTO_CON_ENMENDADURAS);
    expect(report.maxSeverity).toBe(Severity.ALTA);
    expect(categories(report)).toContain(FindingCategory.CASO_PARA_REVISION_JURIDICA);
  });

  it("detecta diferencia contra preconteo de la misma mesa", () => {
    const report = validateE14(makeValidE14(), {
      evaluatedAt: EVAL_AT,
      preconteo: {
        ubicacionKey: FIXTURE_UBICACION_KEY,
        porCandidato: [
          { candidateId: "A", votos: 140 },
          { candidateId: "B", votos: 100 },
        ],
        fuente: "preconteo-demo",
      },
    });
    const f = report.findings.find(
      (x) => x.category === FindingCategory.DIFERENCIA_PRECONTEO_E14,
    );
    expect(f).toBeDefined();
    expect(f?.details).toMatchObject({ e14: 150, preconteo: 140, diferencia: 10 });
  });

  it("ignora preconteo de otra mesa", () => {
    const report = validateE14(makeValidE14(), {
      evaluatedAt: EVAL_AT,
      preconteo: {
        ubicacionKey: "11-001-01-01-99",
        porCandidato: [{ candidateId: "A", votos: 1 }],
      },
    });
    expect(categories(report)).not.toContain(FindingCategory.DIFERENCIA_PRECONTEO_E14);
  });

  it("rechaza entradas con forma inválida (sha256 mal formado)", () => {
    const form = makeValidE14();
    const malo = { ...form, evidencia: { ...form.evidencia, sha256: "xyz" } };
    expect(() => validateE14(malo, { evaluatedAt: EVAL_AT })).toThrow();
  });
});
