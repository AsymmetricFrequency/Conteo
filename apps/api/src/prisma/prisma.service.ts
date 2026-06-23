import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { PrismaClient } from "@conteo/db";

/**
 * Servicio Prisma de la API. Extiende el cliente generado y gestiona la
 * conexión con el ciclo de vida del módulo de Nest.
 *
 * La conexión no es bloqueante: si la base de datos no está disponible al
 * iniciar (p. ej. sin Docker arriba), la API igual levanta y Prisma se
 * conecta de forma perezosa en la primera consulta.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
    } catch {
      this.logger.warn(
        "No se pudo conectar a la base de datos al iniciar; se reintentará en la primera consulta.",
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
