import type { Prisma } from "@conteo/db";
import type { Cell } from "@conteo/domain";

/**
 * Convierte una celda del dominio a JSON apto para Prisma, eliminando
 * claves `undefined` (que no son JSON válido).
 */
export function cellToJson(c: Cell): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(c)) as Prisma.InputJsonValue;
}
