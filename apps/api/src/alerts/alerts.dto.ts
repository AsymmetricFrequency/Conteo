import { z } from "zod";

/** Cuerpo para actualizar el estado de revisión de un hallazgo. */
export const UpdateEstadoSchema = z.object({
  estado: z.enum([
    "PENDIENTE",
    "EN_REVISION",
    "DESCARTADO",
    "CONFIRMADO",
    "RECLAMADO",
  ]),
  notas: z.string().optional(),
  revisadoPor: z.string().optional(),
});

export type UpdateEstadoDto = z.infer<typeof UpdateEstadoSchema>;
