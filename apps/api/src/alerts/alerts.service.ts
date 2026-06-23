import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  EstadoHallazgo,
  Severity,
  type Prisma,
} from "@conteo/db";
import type { UpdateEstadoDto } from "./alerts.dto";

export interface AlertFilters {
  severity?: string;
  category?: string;
  estado?: string;
  municipio?: string;
  skip?: number;
  take?: number;
}

@Injectable()
export class AlertsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lista de hallazgos (alertas) para la cola de revisión humana. */
  async list(filters: AlertFilters) {
    const where: Prisma.FindingWhereInput = {};
    if (filters.severity) where.severity = filters.severity as Severity;
    if (filters.category) where.category = filters.category;
    if (filters.estado) where.estado = filters.estado as EstadoHallazgo;
    if (filters.municipio) {
      where.report = { form: { mesa: { municipio: filters.municipio } } };
    }

    const findings = await this.prisma.finding.findMany({
      where,
      skip: filters.skip ?? 0,
      take: Math.min(filters.take ?? 50, 200),
      // El enum Severity se ordena por definición (BAJA, MEDIA, ALTA);
      // "desc" deja primero ALTA.
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
      include: {
        report: { include: { form: { include: { mesa: true } } } },
      },
    });

    return findings.map((f) => ({
      id: f.id,
      ruleId: f.ruleId,
      category: f.category,
      severity: f.severity,
      message: f.message,
      fields: f.fields,
      details: f.details,
      estado: f.estado,
      revisadoPor: f.revisadoPor,
      notas: f.notas,
      formId: f.report.formId,
      municipio: f.report.form.mesa.municipio,
      ubicacionKey: f.report.form.mesa.ubicacionKey,
      mesa: f.report.form.mesa.mesa,
      createdAt: f.createdAt,
    }));
  }

  /** Registra la decisión de revisión humana sobre un hallazgo. */
  async updateEstado(id: string, dto: UpdateEstadoDto) {
    return this.prisma.finding.update({
      where: { id },
      data: {
        estado: dto.estado as EstadoHallazgo,
        notas: dto.notas,
        revisadoPor: dto.revisadoPor,
      },
    });
  }
}
