import { z } from "zod";

/**
 * Jerarquía electoral colombiana:
 *   Departamento → Municipio → Zona → Puesto → Mesa
 *
 * Los códigos provienen de la división político-electoral oficial
 * (DIVIPOLE). Conservar tanto el código como el nombre permite cruzar
 * con la ruta oficial del portal de la Registraduría.
 */
export const ElectoralLocationSchema = z.object({
  departamentoCodigo: z.string().min(1),
  departamento: z.string().min(1),
  municipioCodigo: z.string().min(1),
  municipio: z.string().min(1),
  zonaCodigo: z.string().min(1),
  puestoCodigo: z.string().min(1),
  puesto: z.string().optional(),
  mesa: z.string().min(1),
});

export type ElectoralLocation = z.infer<typeof ElectoralLocationSchema>;

/**
 * Clave estable de la mesa, usada para deduplicar y cruzar fuentes
 * (E-14 oficial, preconteo, foto de testigo).
 */
export function ubicacionKey(u: ElectoralLocation): string {
  return [
    u.departamentoCodigo,
    u.municipioCodigo,
    u.zonaCodigo,
    u.puestoCodigo,
    u.mesa,
  ].join("-");
}
