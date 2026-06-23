import { z } from "zod";

/**
 * Identificación del proceso electoral. Para 2026 el foco es la
 * elección PRESIDENCIAL (primera y eventual segunda vuelta).
 */
export const ElectionSchema = z.object({
  tipo: z.literal("PRESIDENCIAL"),
  vuelta: z.union([z.literal(1), z.literal(2)]),
  /** Fecha de la elección en formato ISO (YYYY-MM-DD). */
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha debe ser YYYY-MM-DD"),
});

export type Election = z.infer<typeof ElectionSchema>;
