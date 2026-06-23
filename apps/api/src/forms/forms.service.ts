import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { cellToJson } from "./forms.mapper";
import { SourceType, Severity, type Prisma } from "@conteo/db";
import { validateE14, ubicacionKey, type E14 } from "@conteo/domain";

@Injectable()
export class FormsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ingesta de un E-14 ya normalizado (tras la extracción): persiste el
   * formulario y su cadena de custodia, corre el motor de validación y
   * guarda el reporte con sus hallazgos. Todo en una transacción.
   */
  async ingest(e14: E14) {
    const fecha = new Date(`${e14.eleccion.fecha}T00:00:00.000Z`);
    const source = e14.evidencia.sourceType as SourceType;
    const key = ubicacionKey(e14.ubicacion);

    return this.prisma.$transaction(async (tx) => {
      const eleccion = await tx.eleccion.upsert({
        where: {
          tipo_vuelta_fecha: {
            tipo: e14.eleccion.tipo,
            vuelta: e14.eleccion.vuelta,
            fecha,
          },
        },
        update: {},
        create: { tipo: e14.eleccion.tipo, vuelta: e14.eleccion.vuelta, fecha },
      });

      const u = e14.ubicacion;
      const mesa = await tx.mesa.upsert({
        where: { ubicacionKey: key },
        update: {},
        create: {
          departamentoCodigo: u.departamentoCodigo,
          departamento: u.departamento,
          municipioCodigo: u.municipioCodigo,
          municipio: u.municipio,
          zonaCodigo: u.zonaCodigo,
          puestoCodigo: u.puestoCodigo,
          puesto: u.puesto,
          mesa: u.mesa,
          ubicacionKey: key,
        },
      });

      const votosData: Prisma.CandidatoVotoCreateWithoutFormInput[] = [];
      for (const c of e14.candidatos) {
        const cand = await tx.candidato.upsert({
          where: { externalId: c.candidateId },
          update: { nombre: c.nombre, partido: c.partido },
          create: {
            externalId: c.candidateId,
            nombre: c.nombre,
            partido: c.partido,
          },
        });
        votosData.push({
          candidato: { connect: { id: cand.id } },
          value: c.votos.value,
          confidence: c.votos.confidence ?? null,
          hasAmendment: c.votos.hasAmendment ?? false,
          illegible: c.votos.illegible ?? false,
        });
      }

      const form = await tx.formE14.create({
        data: {
          formType: e14.formType,
          source,
          eleccionId: eleccion.id,
          mesaId: mesa.id,
          totalSufragantesE11: cellToJson(e14.totalSufragantesE11),
          votosEnBlanco: cellToJson(e14.votosEnBlanco),
          votosNulos: cellToJson(e14.votosNulos),
          votosNoMarcados: cellToJson(e14.votosNoMarcados),
          totalVotosUrna: cellToJson(e14.totalVotosUrna),
          juradosEsperados: e14.jurados?.esperados ?? null,
          juradosFirmasPresentes: e14.jurados?.firmasPresentes ?? null,
          votos: { create: votosData },
          evidencia: {
            create: {
              sourceType: source,
              sourceUrl: e14.evidencia.sourceUrl,
              storageKey: e14.evidencia.storageKey,
              sha256: e14.evidencia.sha256,
              mimeType: e14.evidencia.mimeType,
              capturedAt: new Date(e14.evidencia.capturedAt),
              fileName: e14.evidencia.fileName,
              byteSize: e14.evidencia.byteSize,
            },
          },
          extraccion: {
            create: {
              ocrProvider: e14.extraccion.ocrProvider,
              ocrVersion: e14.extraccion.ocrVersion,
              extractedAt: new Date(e14.extraccion.extractedAt),
              overallConfidence: e14.extraccion.overallConfidence,
            },
          },
        },
      });

      const report = validateE14(e14, {
        rulesVersion: process.env.RULES_VERSION,
      });

      const savedReport = await tx.validationReport.create({
        data: {
          formId: form.id,
          rulesVersion: report.rulesVersion,
          evaluatedAt: new Date(report.evaluatedAt),
          maxSeverity: (report.maxSeverity ?? undefined) as Severity | undefined,
          resumen: report.resumen as unknown as Prisma.InputJsonValue,
          findings: {
            create: report.findings.map((f) => ({
              ruleId: f.ruleId,
              category: f.category,
              severity: f.severity as Severity,
              message: f.message,
              fields: f.fields,
              details: (f.details ?? undefined) as Prisma.InputJsonValue | undefined,
            })),
          },
        },
        include: { findings: true },
      });

      return {
        formId: form.id,
        ubicacionKey: key,
        maxSeverity: report.maxSeverity,
        findings: savedReport.findings,
      };
    });
  }

  async list(skip = 0, take = 50) {
    const forms = await this.prisma.formE14.findMany({
      skip,
      take: Math.min(take, 200),
      orderBy: { createdAt: "desc" },
      include: {
        mesa: true,
        reportes: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    return forms.map((f) => {
      const last = f.reportes[0];
      return {
        id: f.id,
        source: f.source,
        municipio: f.mesa.municipio,
        ubicacionKey: f.mesa.ubicacionKey,
        mesa: f.mesa.mesa,
        maxSeverity: last?.maxSeverity ?? null,
        evaluatedAt: last?.evaluatedAt ?? null,
        createdAt: f.createdAt,
      };
    });
  }

  async detail(id: string) {
    const form = await this.prisma.formE14.findUnique({
      where: { id },
      include: {
        mesa: true,
        eleccion: true,
        votos: { include: { candidato: true } },
        evidencia: true,
        extraccion: true,
        reportes: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { findings: true },
        },
      },
    });
    if (!form) throw new NotFoundException(`Formulario ${id} no encontrado`);
    return form;
  }
}
