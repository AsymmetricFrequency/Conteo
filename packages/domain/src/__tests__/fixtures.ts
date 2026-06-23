import { cell, type E14 } from "../e14";

/**
 * E-14 válido de referencia (espejo del ejemplo del README):
 *   Candidata A = 150, Candidato B = 100, blanco = 20, nulos = 5,
 *   no marcados = 1  =>  suma = 276 = total en urna = sufragantes E-11.
 */
export function makeValidE14(overrides: Partial<E14> = {}): E14 {
  const base: E14 = {
    id: "e14-demo-001",
    formType: "E14_PRESIDENCIA",
    eleccion: { tipo: "PRESIDENCIAL", vuelta: 1, fecha: "2026-05-31" },
    ubicacion: {
      departamentoCodigo: "76",
      departamento: "Valle del Cauca",
      municipioCodigo: "001",
      municipio: "Cali",
      zonaCodigo: "02",
      puestoCodigo: "05",
      puesto: "I.E. Ejemplo",
      mesa: "01",
    },
    totalSufragantesE11: cell(276),
    candidatos: [
      { candidateId: "A", nombre: "Candidata A", partido: "Partido 1", votos: cell(150) },
      { candidateId: "B", nombre: "Candidato B", partido: "Partido 2", votos: cell(100) },
    ],
    votosEnBlanco: cell(20),
    votosNulos: cell(5),
    votosNoMarcados: cell(1),
    totalVotosUrna: cell(276),
    jurados: { esperados: 3, firmasPresentes: 3 },
    evidencia: {
      sourceType: "REGISTRADURIA_OFICIAL",
      sourceUrl: "https://example.org/e14/76-001-02-05-01.pdf",
      storageKey: "evidence/76-001-02-05-01/original.pdf",
      sha256: "a".repeat(64),
      mimeType: "application/pdf",
      capturedAt: "2026-05-31T20:00:00.000Z",
      fileName: "e14.pdf",
      byteSize: 123456,
    },
    extraccion: {
      ocrProvider: "stub",
      ocrVersion: "0.1.0",
      extractedAt: "2026-05-31T20:05:00.000Z",
      overallConfidence: 0.95,
    },
  };
  return { ...base, ...overrides };
}

/** Clave de ubicación del fixture, para construir preconteo de la misma mesa. */
export const FIXTURE_UBICACION_KEY = "76-001-02-05-01";
