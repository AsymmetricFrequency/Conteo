import { z } from "zod";

/**
 * Resultado de PRECONTEO para una mesa. Informativo, sin valor jurídico
 * vinculante. Se usa sólo para contrastar contra el E-14 y detectar
 * divergencias que ameriten revisión.
 */
export const PreconteoResultSchema = z.object({
  ubicacionKey: z.string().min(1),
  porCandidato: z.array(
    z.object({
      candidateId: z.string().min(1),
      votos: z.number().int().nonnegative(),
    }),
  ),
  votosEnBlanco: z.number().int().nonnegative().optional(),
  totalVotos: z.number().int().nonnegative().optional(),
  fuente: z.string().optional(),
});

export type PreconteoResult = z.infer<typeof PreconteoResultSchema>;
