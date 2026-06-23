import { z } from "zod";
import { ElectionSchema } from "./election";
import { ElectoralLocationSchema } from "./geography";
import { EvidenceRefSchema, ExtractionMetaSchema } from "./evidence";

/**
 * Celda numérica del acta. Además del valor admite metadatos de la
 * extracción: confianza del OCR, marca de enmendadura detectada por
 * visión, e ilegibilidad. `value === null` => la celda no pudo leerse.
 */
export const CellSchema = z.object({
  value: z.number().int().nonnegative().nullable(),
  /** Confianza del OCR en [0,1]. */
  confidence: z.number().min(0).max(1).optional(),
  /** La visión documental detectó tachadura/enmendadura/sobreescritura. */
  hasAmendment: z.boolean().optional(),
  /** Celda ilegible (requiere lectura humana). */
  illegible: z.boolean().optional(),
});
export type Cell = z.infer<typeof CellSchema>;

/** Helper para construir celdas en tests y fixtures. */
export function cell(value: number | null, extra: Partial<Omit<Cell, "value">> = {}): Cell {
  return { value, ...extra };
}

export const CandidateVoteSchema = z.object({
  candidateId: z.string().min(1),
  nombre: z.string().min(1),
  partido: z.string().optional(),
  votos: CellSchema,
});
export type CandidateVote = z.infer<typeof CandidateVoteSchema>;

/**
 * Modelo normalizado de un formulario E-14 de PRESIDENCIA, tal como
 * queda tras la extracción. Es la entrada del motor de validación.
 */
export const E14Schema = z.object({
  id: z.string().min(1),
  formType: z.literal("E14_PRESIDENCIA"),
  eleccion: ElectionSchema,
  ubicacion: ElectoralLocationSchema,

  /** Total de sufragantes según el E-11 (votantes que sufragaron). */
  totalSufragantesE11: CellSchema,

  candidatos: z.array(CandidateVoteSchema).min(1),
  votosEnBlanco: CellSchema,
  votosNulos: CellSchema,
  /** Tarjetas no marcadas. */
  votosNoMarcados: CellSchema,
  /** Total de votos depositados/escrutados reportado en el acta. */
  totalVotosUrna: CellSchema,

  /** Jurados de votación: cuántos se esperan y cuántas firmas hay. */
  jurados: z
    .object({
      esperados: z.number().int().nonnegative(),
      firmasPresentes: z.number().int().nonnegative(),
    })
    .optional(),

  evidencia: EvidenceRefSchema,
  extraccion: ExtractionMetaSchema,
});
export type E14 = z.infer<typeof E14Schema>;

/** Todas las celdas numéricas del acta, con su nombre de campo. */
export function listCells(form: E14): Array<{ field: string; cell: Cell }> {
  return [
    { field: "totalSufragantesE11", cell: form.totalSufragantesE11 },
    { field: "votosEnBlanco", cell: form.votosEnBlanco },
    { field: "votosNulos", cell: form.votosNulos },
    { field: "votosNoMarcados", cell: form.votosNoMarcados },
    { field: "totalVotosUrna", cell: form.totalVotosUrna },
    ...form.candidatos.map((c) => ({
      field: `candidato:${c.candidateId}`,
      cell: c.votos,
    })),
  ];
}
