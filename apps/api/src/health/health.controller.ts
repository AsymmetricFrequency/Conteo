import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async health() {
    let db: "ok" | "down" = "down";
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      db = "ok";
    } catch {
      db = "down";
    }
    return {
      status: "ok",
      db,
      rulesVersion: process.env.RULES_VERSION ?? "unset",
      time: new Date().toISOString(),
    };
  }
}
