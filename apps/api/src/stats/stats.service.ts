import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Resumen para el dashboard: conteos por severidad, categoría y estado. */
  async summary() {
    const [totalForms, totalReports, sev, cat, est] = await Promise.all([
      this.prisma.formE14.count(),
      this.prisma.validationReport.count(),
      this.prisma.finding.groupBy({ by: ["severity"], _count: { _all: true } }),
      this.prisma.finding.groupBy({ by: ["category"], _count: { _all: true } }),
      this.prisma.finding.groupBy({ by: ["estado"], _count: { _all: true } }),
    ]);

    return {
      totalForms,
      totalReports,
      porSeveridad: sev.map((s) => ({ severity: s.severity, count: s._count._all })),
      porCategoria: cat.map((c) => ({ category: c.category, count: c._count._all })),
      porEstado: est.map((e) => ({ estado: e.estado, count: e._count._all })),
    };
  }
}
