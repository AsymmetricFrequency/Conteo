import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { IngestMunicipioDto, PreconteoQuery } from "./preconteo.dto";
import { REG_TO_DANE, DANE_TO_REG } from "../common/dept-codes";

const ELECCION_ID = "PR-2026-2";

@Injectable()
export class PreconteoService {
  constructor(private readonly prisma: PrismaService) {}

  async ingest(dto: IngestMunicipioDto): Promise<{ created: boolean }> {
    const existing = await this.prisma.preconteoMunicipio.findUnique({
      where: {
        eleccion_munCodigo_numact: {
          eleccion: ELECCION_ID,
          munCodigo: dto.code,
          numact: dto.numact,
        },
      },
      select: { id: true },
    });

    if (existing) return { created: false };

    await this.prisma.preconteoMunicipio.create({
      data: {
        eleccion: ELECCION_ID,
        munCodigo: dto.code,
        munNombre: dto.nombre,
        deptCodigo: dto.deptCode,
        deptNombre: dto.dept,
        mesasTotal: dto.mesas.total,
        mesasEsc: dto.mesas.escrutadas,
        sufragantes: dto.sufragantes,
        votnul: dto.votnul,
        votblan: dto.votblan,
        numact: dto.numact,
        capturedAt: new Date(dto.capturedAt),
        votos: {
          create: dto.votos.map((v) => ({
            codcan: v.codcan,
            cedula: v.cedula,
            nombre: v.nombre,
            vot: v.vot,
            pvot: v.pvot,
          })),
        },
      },
    });

    return { created: true };
  }

  /** Ingest batch de múltiples municipios (del JSONL del crawler). */
  async ingestBatch(
    dtos: IngestMunicipioDto[],
  ): Promise<{ created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;
    for (const dto of dtos) {
      const r = await this.ingest(dto);
      if (r.created) created++;
      else skipped++;
    }
    return { created, skipped };
  }

  /** Resultados finales (último numact) por municipio. */
  async listResultados(query: PreconteoQuery) {
    const regDept = query.dept ? (DANE_TO_REG[query.dept] ?? query.dept) : undefined;
    const where = {
      eleccion: ELECCION_ID,
      ...(regDept ? { deptCodigo: regDept } : {}),
      ...(query.mun ? { munCodigo: query.mun } : {}),
    };

    const municipios = await this.prisma.preconteoMunicipio.findMany({
      where,
      orderBy: [{ deptCodigo: "asc" }, { munCodigo: "asc" }, { numact: "asc" }],
      include: { votos: true },
    });

    // Mantener solo el último snapshot por municipio (mayor numact)
    const byMun = new Map<string, typeof municipios[0]>();
    for (const m of municipios) {
      const prev = byMun.get(m.munCodigo);
      if (!prev || Number(m.numact) > Number(prev.numact)) {
        byMun.set(m.munCodigo, m);
      }
    }

    let resultados = [...byMun.values()];

    // Filtro por candidato (cedula)
    if (query.cedula) {
      resultados = resultados.filter((m) =>
        m.votos.some((v) => v.cedula === query.cedula),
      );
    }

    return resultados.map((m) => ({
      munCodigo: m.munCodigo,
      munNombre: m.munNombre,
      deptCodigo: m.deptCodigo,
      deptNombre: m.deptNombre,
      mesas: { total: m.mesasTotal, escrutadas: m.mesasEsc },
      sufragantes: m.sufragantes,
      votnul: m.votnul,
      votblan: m.votblan,
      numact: m.numact,
      capturedAt: m.capturedAt,
      votos: m.votos.map((v) => ({
        codcan: v.codcan,
        cedula: v.cedula,
        nombre: v.nombre,
        vot: v.vot,
        pvot: v.pvot,
      })),
    }));
  }

  /** Resultados agregados por departamento para el mapa (keyed by DANE code). */
  async byDept() {
    const resultados = await this.listResultados({});
    const depts = new Map<string, {
      deptCodigo: string; deptNombre: string;
      mesasTotal: number; mesasEsc: number; sufragantes: number;
      cepedaVotos: number; espriellaVotos: number;
    }>();
    for (const r of resultados) {
      const daneCode = REG_TO_DANE[r.deptCodigo] ?? r.deptCodigo;
      const prev = depts.get(daneCode) ?? {
        deptCodigo: daneCode, deptNombre: r.deptNombre,
        mesasTotal: 0, mesasEsc: 0, sufragantes: 0, cepedaVotos: 0, espriellaVotos: 0,
      };
      prev.mesasTotal += r.mesas.total;
      prev.mesasEsc += r.mesas.escrutadas;
      prev.sufragantes += r.sufragantes;
      const cepeda = r.votos.find(v => v.nombre.toUpperCase().includes("CEPEDA"));
      const espriella = r.votos.find(v =>
        v.nombre.toUpperCase().includes("ESPRIELLA") || v.nombre.toUpperCase().includes("ESPRI")
      );
      prev.cepedaVotos += cepeda?.vot ?? 0;
      prev.espriellaVotos += espriella?.vot ?? 0;
      depts.set(daneCode, prev);
    }
    return [...depts.values()].map(d => {
      const total = d.cepedaVotos + d.espriellaVotos;
      const pctCepeda = total > 0 ? parseFloat(((d.cepedaVotos / total) * 100).toFixed(2)) : 0;
      return {
        ...d,
        pctCepeda,
        pctEspriella: parseFloat((100 - pctCepeda).toFixed(2)),
        winner: pctCepeda >= 50 ? "cepeda" : "espriella" as "cepeda" | "espriella",
        margen: parseFloat(Math.abs(pctCepeda - 50).toFixed(2)),
      };
    }).sort((a, b) => a.deptNombre.localeCompare(b.deptNombre));
  }

  /** Resumen nacional / por departamento. */
  async summary(deptCodigo?: string) {
    const resultados = await this.listResultados({ dept: deptCodigo });

    let totalMesas = 0;
    let totalEsc = 0;
    let totalSufragantes = 0;
    const votosPorCandidato: Record<string, { nombre: string; vot: number }> = {};

    for (const r of resultados) {
      totalMesas += r.mesas.total;
      totalEsc += r.mesas.escrutadas;
      totalSufragantes += r.sufragantes;
      for (const v of r.votos) {
        const prev = votosPorCandidato[v.cedula] ?? { nombre: v.nombre, vot: 0 };
        prev.vot += v.vot;
        votosPorCandidato[v.cedula] = prev;
      }
    }

    return {
      municipios: resultados.length,
      mesas: { total: totalMesas, escrutadas: totalEsc },
      sufragantes: totalSufragantes,
      candidatos: Object.entries(votosPorCandidato).map(([cedula, d]) => ({
        cedula,
        nombre: d.nombre,
        vot: d.vot,
        pct:
          totalSufragantes > 0
            ? ((d.vot / totalSufragantes) * 100).toFixed(2) + "%"
            : "0%",
      })),
    };
  }
}
