import { z } from "zod";

export const IngestMunicipioSchema = z.object({
  code: z.string(),
  nombre: z.string(),
  deptCode: z.string(),
  dept: z.string(),
  mesas: z.object({
    total: z.number().int(),
    escrutadas: z.number().int(),
    pct: z.string(),
  }),
  sufragantes: z.number().int(),
  votos: z.array(
    z.object({
      codcan: z.string(),
      cedula: z.string(),
      nombre: z.string(),
      vot: z.number().int(),
      pvot: z.string(),
    }),
  ),
  votnul: z.number().int(),
  votblan: z.number().int(),
  capturedAt: z.string().datetime(),
  numact: z.string(),
});

export type IngestMunicipioDto = z.infer<typeof IngestMunicipioSchema>;

export const PreconteoQuerySchema = z.object({
  dept: z.string().optional(),
  mun: z.string().optional(),
  cedula: z.string().optional(),
});

export type PreconteoQuery = z.infer<typeof PreconteoQuerySchema>;
