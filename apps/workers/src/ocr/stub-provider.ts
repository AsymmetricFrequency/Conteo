import { cell, type E14 } from "@conteo/domain";
import type { OcrJobData, OcrProvider } from "./types";

/**
 * Proveedor de OCR de DEMOSTRACIÓN. No lee imágenes: fabrica datos
 * deterministas con una inconsistencia inyectada (suma 271 vs total 276)
 * para ejercitar el motor de validación de extremo a extremo.
 *
 * Los proveedores reales (Document AI, Textract, Azure DI) implementan la
 * misma interfaz `OcrProvider` y leen `data.evidencia.storageKey`.
 */
export class StubOcrProvider implements OcrProvider {
  readonly name = "stub";
  readonly version = "0.1.0";

  async extract(data: OcrJobData): Promise<E14> {
    const candidatos = data.candidatos.map((c, i) => ({
      candidateId: c.candidateId,
      nombre: c.nombre,
      partido: c.partido,
      votos: cell(i === 0 ? 150 : 95),
    }));

    return {
      id: `ocr-${data.evidencia.sha256.slice(0, 12)}`,
      formType: "E14_PRESIDENCIA",
      eleccion: data.eleccion,
      ubicacion: data.ubicacion,
      totalSufragantesE11: cell(276),
      candidatos,
      votosEnBlanco: cell(20),
      votosNulos: cell(5),
      votosNoMarcados: cell(1),
      totalVotosUrna: cell(276),
      jurados: { esperados: 3, firmasPresentes: 3 },
      evidencia: data.evidencia,
      extraccion: {
        ocrProvider: this.name,
        ocrVersion: this.version,
        extractedAt: new Date().toISOString(),
        overallConfidence: 0.9,
      },
    };
  }
}
