import { PrismaClient } from "@prisma/client";

/**
 * Cliente Prisma compartido (singleton). Evita agotar el pool de
 * conexiones en desarrollo con hot-reload. Lo consumen `apps/api` y
 * `apps/workers`.
 */
const globalForPrisma = globalThis as unknown as {
  conteoPrisma?: PrismaClient;
};

export const prisma: PrismaClient =
  globalForPrisma.conteoPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.conteoPrisma = prisma;
}

// Re-exporta tipos y enums generados (SourceType, Severity, etc.).
export * from "@prisma/client";
