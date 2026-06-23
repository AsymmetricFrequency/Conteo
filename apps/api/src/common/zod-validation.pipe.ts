import { BadRequestException, PipeTransform } from "@nestjs/common";
import type { ZodSchema } from "zod";

/**
 * Pipe que valida el cuerpo/los parámetros contra un esquema Zod del
 * dominio. Permite reutilizar exactamente los mismos esquemas que usa el
 * motor de validación, sin duplicar DTOs.
 */
export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: "Validación de esquema fallida",
        issues: result.error.issues,
      });
    }
    return result.data;
  }
}
