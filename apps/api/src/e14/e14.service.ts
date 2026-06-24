import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EncryptionService } from "../encryption/encryption.service";
import { REG_TO_DANE, DANE_TO_REG } from "../common/dept-codes";

const BASE_PDF = "https://e14segundavueltapresidente.registraduria.gov.co";

function buildPdfUrl(a: {
  idDepartmentCode: string;
  municipalityCode: string;
  idZoneCode: string;
  standCode: string;
  numberStand: string;
  expectedName: string;
}) {
  const zone3 = a.idZoneCode.padStart(3, "0");
  return `${BASE_PDF}/assets/temis/pdf/${a.idDepartmentCode}/${a.municipalityCode}/${zone3}/${a.standCode}/${a.numberStand}/PRE/${a.expectedName}`;
}

interface OcrResult {
  tipoCopia?: string;
  mesa?: number | null;
  puesto?: string;
  zona?: string;
  municipio?: string;
  departamento?: string;
  nivelacion?: {
    totalVotantesE11?: number | null;
    totalVotosUrna?: number | null;
    totalVotosIncinerados?: number | null;
  };
  candidatos?: Array<{ nombre: string; votos: number | null }>;
  votosEnBlanco?: number | null;
  votosNulos?: number | null;
  votosNoMarcados?: number | null;
  sumaTotal?: number | null;
  totalSufragantes?: number | null;
  hayEnmiendas?: boolean;
  enmiendaDetalle?: string;
  severidadAnomalia?: string;
  observaciones?: string;
}

function validarAritmetica(ocr: OcrResult): string[] {
  const flags: string[] = [];
  const candidatos = ocr.candidatos ?? [];
  const sumaCands = candidatos.reduce((s, c) => s + (c.votos ?? 0), 0);
  const blancos = ocr.votosEnBlanco ?? 0;
  const nulos = ocr.votosNulos ?? 0;
  const noMarcados = ocr.votosNoMarcados ?? 0;
  const sumaCalculada = sumaCands + blancos + nulos + noMarcados;

  if (ocr.sumaTotal != null && sumaCalculada !== ocr.sumaTotal) {
    flags.push(`Suma calculada ${sumaCalculada} ≠ suma total declarada ${ocr.sumaTotal} (Δ${sumaCalculada - ocr.sumaTotal})`);
  }

  const urna = ocr.nivelacion?.totalVotosUrna;
  const e11 = ocr.nivelacion?.totalVotantesE11;
  const incinerados = ocr.nivelacion?.totalVotosIncinerados;

  if (urna != null && ocr.sumaTotal != null && urna !== ocr.sumaTotal) {
    flags.push(`Votos en urna ${urna} ≠ suma total ${ocr.sumaTotal} (Δ${urna - ocr.sumaTotal})`);
  }
  if (urna != null && e11 != null && urna > e11) {
    flags.push(`SOBRECAPACIDAD: votos en urna (${urna}) > votantes habilitados E-11 (${e11})`);
  }
  if (urna != null && ocr.totalSufragantes != null && urna !== ocr.totalSufragantes) {
    flags.push(`Votos en urna ${urna} ≠ total sufragantes ${ocr.totalSufragantes}`);
  }
  if (incinerados != null && incinerados > 0 && urna != null && sumaCands > 0 && incinerados >= urna) {
    flags.push(`INCINERADOS IMPLAUSIBLES: ${incinerados} incinerados con ${sumaCands} votos de candidatos`);
  }
  if (urna != null && incinerados != null && incinerados > 0 && e11 != null) {
    const esperado = urna + incinerados;
    if (Math.abs(esperado - e11) > 1) {
      flags.push(`Nivelación: urna(${urna}) + incinerados(${incinerados}) = ${esperado} ≠ E-11(${e11})`);
    }
  }

  return flags;
}

@Injectable()
export class E14Service {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  async pipelineStats() {
    const [counts, byDept, totalE14] = await Promise.all([
      this.prisma.e14ActaIndex.groupBy({ by: ["status"], _count: { id: true } }),
      this.prisma.e14ActaIndex.groupBy({
        by: ["idDepartmentCode"],
        where: { status: "ocr_done" },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 5,
      }),
      this.prisma.e14ActaIndex.count(),
    ]);

    const statusMap: Record<string, number> = {};
    for (const c of counts) statusMap[c.status] = c._count.id;

    return {
      total: totalE14,
      pending: statusMap["pending"] ?? 0,
      downloaded: statusMap["downloaded"] ?? 0,
      ocr_done: statusMap["ocr_done"] ?? 0,
      error: statusMap["error"] ?? 0,
      topDepts: byDept.map((d) => ({ dept: d.idDepartmentCode, count: d._count.id })),
    };
  }

  async recent(limit = 20) {
    const actas = await this.prisma.e14ActaIndex.findMany({
      where: { status: "ocr_done", ocrResult: { not: undefined } },
      orderBy: { processedAt: "desc" },
      take: limit,
      select: {
        id: true, idTransmissionCode: true, idDepartmentCode: true,
        municipalityCode: true, numberStand: true, standCode: true,
        idZoneCode: true, expectedName: true, sourceUrl: true,
        ocrResult: true, fraudFlags: true, fraudSeverity: true, processedAt: true,
      },
    });

    return actas.map((a) => ({
      id: a.id,
      txId: a.idTransmissionCode,
      deptCode: a.idDepartmentCode,
      munCode: a.municipalityCode,
      mesa: a.numberStand,
      sourceUrl: a.sourceUrl ?? buildPdfUrl(a),
      ocrResult: a.ocrResult,
      fraudFlags: a.fraudFlags,
      fraudSeverity: a.fraudSeverity,
      processedAt: a.processedAt,
    }));
  }

  async fraudCheck(limit = 200) {
    const actas = await this.prisma.e14ActaIndex.findMany({
      where: { status: "ocr_done", ocrResult: { not: undefined } },
      take: limit,
      orderBy: { processedAt: "desc" },
      select: {
        id: true, idTransmissionCode: true, idDepartmentCode: true,
        municipalityCode: true, idZoneCode: true, standCode: true,
        numberStand: true, expectedName: true, sourceUrl: true,
        ocrResult: true, fraudFlags: true, fraudSeverity: true, processedAt: true,
      },
    });

    const flagged = [];
    let totalAritmetica = 0, totalEnmiendas = 0, totalSeveridadAlta = 0;

    for (const acta of actas) {
      const ocr = acta.ocrResult as OcrResult | null;
      if (!ocr) continue;

      // Use stored flags if available (from Python OCR), otherwise compute
      let flagsArit: string[] = (acta.fraudFlags as string[] | null) ?? validarAritmetica(ocr);
      const tieneEnmienda = ocr.hayEnmiendas === true;
      const severidad = acta.fraudSeverity ?? ocr.severidadAnomalia ?? "NINGUNA";

      if (flagsArit.length > 0) totalAritmetica++;
      if (tieneEnmienda) totalEnmiendas++;
      if (severidad === "ALTA") totalSeveridadAlta++;

      if (flagsArit.length > 0 || tieneEnmienda) {
        const candidatos = ocr.candidatos ?? [];
        const c0 = candidatos[0];
        const c1 = candidatos[1];
        const pdfUrl = acta.sourceUrl ?? buildPdfUrl(acta);

        flagged.push({
          txId: acta.idTransmissionCode,
          deptCode: acta.idDepartmentCode,
          munCode: acta.municipalityCode,
          zona: acta.idZoneCode,
          stand: acta.standCode,
          mesa: acta.numberStand,
          tipoCopia: ocr.tipoCopia ?? "DESCONOCIDO",
          municipio: ocr.municipio ?? "",
          departamento: ocr.departamento ?? "",
          candidato0: { nombre: c0?.nombre ?? "", votos: c0?.votos ?? null },
          candidato1: { nombre: c1?.nombre ?? "", votos: c1?.votos ?? null },
          nivelacion: ocr.nivelacion ?? {},
          sumaTotal: ocr.sumaTotal ?? null,
          hayEnmiendas: tieneEnmienda,
          enmiendaDetalle: ocr.enmiendaDetalle ?? "",
          severidadAnomalia: severidad,
          flagsAritmetica: flagsArit,
          pdfUrl,
          processedAt: acta.processedAt,
        });
      }
    }

    const sevOrder: Record<string, number> = { ALTA: 0, MEDIA: 1, BAJA: 2, NINGUNA: 3 };
    flagged.sort((a, b) => (sevOrder[a.severidadAnomalia] ?? 3) - (sevOrder[b.severidadAnomalia] ?? 3));

    return {
      resumen: {
        totalAnalizadas: actas.length,
        totalConIrregularidades: flagged.length,
        conErrorAritmetico: totalAritmetica,
        conEnmiendaVisual: totalEnmiendas,
        severidadAlta: totalSeveridadAlta,
      },
      irregularidades: flagged,
    };
  }

  async claimNextActa(userId: string, userEmail: string, userName: string) {
    // Release stale claims older than 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    await this.prisma.e14ActaIndex.updateMany({
      where: { claimedBy: { not: null }, claimedAt: { lt: tenMinutesAgo }, auditedAt: null },
      data: { claimedBy: null, claimedAt: null },
    });

    // Find next unclaimed, unprocessed acta
    const acta = await this.prisma.e14ActaIndex.findFirst({
      where: {
        status: "pending",
        auditedAt: null,
        claimedBy: null,
      },
      orderBy: { idDepartmentCode: "asc" },
    });

    if (!acta) return { claimed: false, message: "No hay más actas pendientes. ¡Gracias por tu contribución!" };

    const pdfUrl = buildPdfUrl(acta);

    await this.prisma.e14ActaIndex.update({
      where: { id: acta.id },
      data: { claimedBy: userId, claimedAt: new Date() },
    });

    return {
      claimed: true,
      txId: acta.idTransmissionCode,
      pdfUrl,
      departamento: acta.idDepartmentCode,
      municipio: acta.municipalityCode,
      zona: acta.idZoneCode,
      stand: acta.standCode,
      mesa: acta.numberStand,
    };
  }

  async submitAudit(
    txId: string,
    ocrResult: Record<string, unknown>,
    userId: string,
    userEmail: string,
    userName: string,
  ) {
    const acta = await this.prisma.e14ActaIndex.findUnique({ where: { idTransmissionCode: txId } });
    if (!acta) throw new Error("Acta no encontrada");

    // Basic fraud flags from submitted OCR
    const fraudFlags = validarAritmetica(ocrResult as OcrResult);
    const severity = fraudFlags.length >= 2 ? "ALTA" : fraudFlags.length === 1 ? "MEDIA" : "NINGUNA";

    await this.prisma.e14ActaIndex.update({
      where: { id: acta.id },
      data: {
        status: "ocr_done",
        ocrResult: ocrResult as never,
        fraudFlags: fraudFlags as never,
        fraudSeverity: severity,
        auditedByEmail: userEmail,
        auditedByName: userName,
        auditedAt: new Date(),
        claimedBy: null,
        claimedAt: null,
        processedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Increment user's count
    await this.prisma.conteoUser.update({
      where: { id: userId },
      data: { actasAuditadas: { increment: 1 } },
    });

    return {
      success: true,
      txId,
      fraudFlags,
      severity,
      message: fraudFlags.length > 0 ? `⚠ ${fraudFlags.length} irregularidad(es) detectada(s)` : "✓ Acta procesada sin irregularidades",
    };
  }

  async comparacion(deptCode?: string, minDiffPct = 3) {
    // Fetch all OCR'd actas
    const whereClause = deptCode
      ? { status: "ocr_done", ocrResult: { not: undefined }, idDepartmentCode: deptCode }
      : { status: "ocr_done", ocrResult: { not: undefined } };

    const actas = await this.prisma.e14ActaIndex.findMany({
      where: whereClause,
      select: {
        id: true, idTransmissionCode: true, idDepartmentCode: true,
        municipalityCode: true, idZoneCode: true, standCode: true,
        numberStand: true, expectedName: true, sourceUrl: true,
        ocrResult: true, fraudFlags: true, fraudSeverity: true,
      },
    });

    if (actas.length === 0) return { municipios: [], totalActas: 0 };

    // Group by municipality (dept+mun = 5-char preconteo code)
    const byMun = new Map<string, typeof actas>();
    for (const a of actas) {
      const key = a.idDepartmentCode + a.municipalityCode;
      if (!byMun.has(key)) byMun.set(key, []);
      byMun.get(key)!.push(a);
    }

    // Get preconteo data for those municipalities
    const munCodes = [...byMun.keys()];
    const preconteos = await this.prisma.preconteoMunicipio.findMany({
      where: { munCodigo: { in: munCodes }, eleccion: "PR-2026-2" },
      orderBy: [{ munCodigo: "asc" }, { numact: "desc" }],
      include: { votos: true },
    });

    // Latest preconteo per municipality
    const latestPc = new Map<string, (typeof preconteos)[0]>();
    for (const pc of preconteos) {
      if (!latestPc.has(pc.munCodigo)) latestPc.set(pc.munCodigo, pc);
    }

    const resultados = [];

    for (const [munCode, mActas] of byMun) {
      const pc = latestPc.get(munCode);
      if (!pc) continue;

      const pcVotos = pc.votos;
      const cepedaPC = pcVotos.find((v) => v.nombre.toUpperCase().includes("CEPEDA"))?.vot ?? 0;
      const espriellaPC = pcVotos.find((v) =>
        v.nombre.toUpperCase().includes("ESPRIELLA") || v.nombre.toUpperCase().includes("ESPRI")
      )?.vot ?? 0;

      let cepedaE14 = 0, espriellaE14 = 0;
      const actasDetalle = [];

      for (const a of mActas) {
        const ocr = a.ocrResult as OcrResult | null;
        if (!ocr?.candidatos) continue;

        const cv0 = ocr.candidatos.find((c) => c.nombre.toUpperCase().includes("CEPEDA"))?.votos ?? 0;
        const cv1 = ocr.candidatos.find((c) =>
          c.nombre.toUpperCase().includes("ESPRIELLA") || c.nombre.toUpperCase().includes("ESPRI")
        )?.votos ?? 0;

        cepedaE14 += cv0 ?? 0;
        espriellaE14 += cv1 ?? 0;

        const pdfUrl = a.sourceUrl ?? buildPdfUrl(a);
        actasDetalle.push({
          txId: a.idTransmissionCode,
          zona: a.idZoneCode,
          stand: a.standCode,
          mesa: a.numberStand,
          tipoCopia: ocr.tipoCopia ?? "DESCONOCIDO",
          cepedaVotos: cv0,
          espriellaVotos: cv1,
          totalVotosActa: (cv0 ?? 0) + (cv1 ?? 0) + (ocr.votosEnBlanco ?? 0) + (ocr.votosNulos ?? 0),
          hayIrregularidades: !!(a.fraudFlags as string[] | null)?.length || ocr.hayEnmiendas,
          fraudSeverity: a.fraudSeverity ?? "NINGUNA",
          pdfUrl,
        });
      }

      const totalPC = cepedaPC + espriellaPC;
      const totalE14 = cepedaE14 + espriellaE14;
      if (totalPC === 0 || totalE14 === 0) continue;

      const pctCepedaPC = (cepedaPC / totalPC) * 100;
      const pctCepedaE14 = (cepedaE14 / totalE14) * 100;
      const diff = pctCepedaPC - pctCepedaE14; // positive = E14 favors Espriella vs preconteo

      resultados.push({
        munCode,
        munNombre: pc.munNombre,
        deptNombre: pc.deptNombre,
        mesasTotalMunicipio: pc.mesasTotal,
        mesasEscrutadas: pc.mesasEsc,
        mesasConE14: mActas.length,
        preconteo: {
          cepedaVotos: cepedaPC,
          espriellaVotos: espriellaPC,
          pctCepeda: parseFloat(pctCepedaPC.toFixed(2)),
          pctEspriella: parseFloat((100 - pctCepedaPC).toFixed(2)),
        },
        e14Delegados: {
          cepedaVotos: cepedaE14,
          espriellaVotos: espriellaE14,
          pctCepeda: parseFloat(pctCepedaE14.toFixed(2)),
          pctEspriella: parseFloat((100 - pctCepedaE14).toFixed(2)),
        },
        diferenciaPct: parseFloat(diff.toFixed(2)),
        alertaNivel: Math.abs(diff) >= 10 ? "ALTA" : Math.abs(diff) >= 5 ? "MEDIA" : Math.abs(diff) >= minDiffPct ? "BAJA" : "OK",
        actas: actasDetalle.sort((a, b) => b.fraudSeverity.localeCompare(a.fraudSeverity)),
      });
    }

    resultados.sort((a, b) => Math.abs(b.diferenciaPct) - Math.abs(a.diferenciaPct));

    return {
      totalActas: actas.length,
      municipios: resultados,
    };
  }

  async geoStats() {
    const [allByDept, auditedByDept, fraudByDept, highFraud] = await Promise.all([
      this.prisma.e14ActaIndex.groupBy({ by: ["idDepartmentCode"], _count: { id: true } }),
      this.prisma.e14ActaIndex.groupBy({ by: ["idDepartmentCode"], where: { auditedAt: { not: null } }, _count: { id: true } }),
      this.prisma.e14ActaIndex.groupBy({ by: ["idDepartmentCode"], where: { fraudSeverity: { in: ["MEDIA", "ALTA"] } }, _count: { id: true } }),
      this.prisma.e14ActaIndex.groupBy({ by: ["idDepartmentCode"], where: { fraudSeverity: "ALTA" }, _count: { id: true } }),
    ]);
    const totMap = new Map(allByDept.map(r => [r.idDepartmentCode, r._count.id]));
    const audMap = new Map(auditedByDept.map(r => [r.idDepartmentCode, r._count.id]));
    const frdMap = new Map(fraudByDept.map(r => [r.idDepartmentCode, r._count.id]));
    const hfMap = new Map(highFraud.map(r => [r.idDepartmentCode, r._count.id]));
    return [...totMap.entries()].map(([regCode, total]) => {
      const code = REG_TO_DANE[regCode] ?? regCode;
      const auditadas = audMap.get(regCode) ?? 0;
      return { code, total, auditadas, pct: total > 0 ? parseFloat(((auditadas / total) * 100).toFixed(2)) : 0, conIrregularidades: frdMap.get(regCode) ?? 0, severidadAlta: hfMap.get(regCode) ?? 0 };
    }).sort((a, b) => b.auditadas - a.auditadas);
  }

  async getMunicipalidades(dept: string) {
    const regDept = DANE_TO_REG[dept] ?? dept;
    const [all, audited] = await Promise.all([
      this.prisma.e14ActaIndex.groupBy({ by: ["municipalityCode"], where: { idDepartmentCode: regDept }, _count: { id: true } }),
      this.prisma.e14ActaIndex.groupBy({ by: ["municipalityCode"], where: { idDepartmentCode: regDept, auditedAt: { not: null } }, _count: { id: true } }),
    ]);
    const audMap = new Map(audited.map(a => [a.municipalityCode, a._count.id]));
    return all.map(m => ({ code: m.municipalityCode, total: m._count.id, auditadas: audMap.get(m.municipalityCode) ?? 0 })).sort((a, b) => b.total - a.total);
  }

  async browseMesas(filters: { dept?: string; mun?: string; status?: string }, limit = 100, offset = 0) {
    const where: Record<string, unknown> = {};
    if (filters.dept) where.idDepartmentCode = DANE_TO_REG[filters.dept] ?? filters.dept;
    if (filters.mun) where.municipalityCode = filters.mun;
    if (filters.status) where.status = filters.status;
    const [actas, total] = await Promise.all([
      this.prisma.e14ActaIndex.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: [{ idDepartmentCode: "asc" }, { municipalityCode: "asc" }, { numberStand: "asc" }],
        select: {
          id: true, idTransmissionCode: true, idDepartmentCode: true, municipalityCode: true,
          idZoneCode: true, standCode: true, numberStand: true, expectedName: true, sourceUrl: true,
          status: true, auditedAt: true, auditedByName: true, claimedBy: true, claimedAt: true,
          ocrResult: true, fraudFlags: true, fraudSeverity: true,
        },
      }),
      this.prisma.e14ActaIndex.count({ where }),
    ]);
    return {
      total, offset, limit,
      actas: actas.map(a => {
        const ocr = a.ocrResult as { candidatos?: Array<{ nombre: string; votos: number | null }>; sumaTotal?: number | null; totalSufragantes?: number | null; tipoCopia?: string; municipio?: string; departamento?: string; hayEnmiendas?: boolean } | null;
        const c0 = ocr?.candidatos?.[0];
        const c1 = ocr?.candidatos?.[1];
        return {
          id: a.id, txId: a.idTransmissionCode, deptCode: a.idDepartmentCode, munCode: a.municipalityCode,
          zona: a.idZoneCode, stand: a.standCode, mesa: a.numberStand,
          pdfUrl: a.sourceUrl ?? buildPdfUrl(a as Parameters<typeof buildPdfUrl>[0]),
          status: a.status, auditedAt: a.auditedAt, auditedByName: a.auditedByName,
          tipoCopia: ocr?.tipoCopia ?? null, municipio: ocr?.municipio ?? null, departamento: ocr?.departamento ?? null,
          candidato0: c0 ? { nombre: c0.nombre, votos: c0.votos } : null,
          candidato1: c1 ? { nombre: c1.nombre, votos: c1.votos } : null,
          sumaTotal: ocr?.sumaTotal ?? null, totalSufragantes: ocr?.totalSufragantes ?? null,
          hayEnmiendas: ocr?.hayEnmiendas ?? false,
          fraudFlags: a.fraudFlags as string[] | null,
          fraudSeverity: a.fraudSeverity,
        };
      }),
    };
  }

  async analyzeActa(userId: string, pdfBase64: string, provider?: "gemini" | "anthropic") {
    const user = await this.prisma.conteoUser.findUnique({ where: { id: userId } });

    const hasGemini = !!(user?.geminiKeyEncrypted && user?.geminiKeyIv);
    const hasAnthropic = !!(user?.anthropicKeyEncrypted && user?.anthropicKeyIv);

    // Auto-select provider if not specified
    const chosen = provider ?? (hasGemini ? "gemini" : hasAnthropic ? "anthropic" : null);

    if (!chosen) {
      throw new Error("No tienes ninguna API key configurada. Configura una key de Google Gemini o Anthropic.");
    }
    if (chosen === "gemini" && !hasGemini) {
      throw new Error("No tienes una API key de Gemini configurada");
    }
    if (chosen === "anthropic" && !hasAnthropic) {
      throw new Error("No tienes una API key de Anthropic configurada");
    }

    const OCR_PROMPT = `Eres un sistema experto de auditoría electoral colombiana. Analiza este formulario E-14 (Acta de Escrutinio de Mesa) de la Segunda Vuelta Presidencial 2026 publicado por la Registraduría Nacional del Estado Civil.

CONTEXTO DEL FORMULARIO E-14:
- Es el acta oficial de escrutinio de una mesa de votación colombiana
- Tiene dos secciones: la tabla de NIVELACIÓN (parte superior) y la tabla de VOTOS POR CANDIDATO
- La nivelación incluye: total votantes E-11 (habilitados), votos en urna, votos incinerados
- Los votos de candidatos se registran en renglones numerados con nombre y casilla de votos
- Al final hay filas para: votos en blanco, votos nulos, votos no marcados, y SUMA TOTAL
- Hay un sello y firma del jurado de votación
- Puede haber dos versiones: DELEGADOS (copia para delegados de candidatos) o CLAVEROS (copia de claveros)

ESTA ELECCIÓN TIENE EXACTAMENTE 2 CANDIDATOS:
1. IVÁN CEPEDA CASTRO (Pacto Histórico)
2. ABELARDO DE LA ESPRIELLA (Defensores de la Patria)

INSTRUCCIONES CRÍTICAS:
- Lee los números con máxima atención, son manuscritos o impresos
- Los números con tachones o correcciones: anota el valor legible más reciente y márcalo en enmiendaDetalle
- Si hay un número escrito encima de otro, usa el más reciente
- NO asumas ni calcules valores; solo extrae lo que está escrito
- La SUMA TOTAL declarada en el acta puede no cuadrar con la suma de candidatos + blancos + nulos (eso es una irregularidad, no lo corrijas)
- Severidad de anomalía: ALTA si hay errores aritméticos graves o votos > votantes; MEDIA si hay enmiendas + diferencias; BAJA si hay enmiendas menores; NINGUNA si todo es correcto

Responde ÚNICAMENTE con el JSON, sin texto adicional, sin markdown:
{
  "tipoCopia": "DELEGADOS" o "CLAVEROS" o "DESCONOCIDO",
  "candidatos": [
    {"nombre": "IVÁN CEPEDA CASTRO", "votos": número o null},
    {"nombre": "ABELARDO DE LA ESPRIELLA", "votos": número o null}
  ],
  "votosEnBlanco": número o null,
  "votosNulos": número o null,
  "votosNoMarcados": número o null,
  "sumaTotal": número o null,
  "totalSufragantes": número o null,
  "nivelacion": {
    "totalVotantesE11": número o null,
    "totalVotosUrna": número o null,
    "totalVotosIncinerados": número o null
  },
  "hayEnmiendas": true o false,
  "enmiendaDetalle": "descripción detallada de cada tachón, corrección o enmienda visible, o cadena vacía",
  "severidadAnomalia": "NINGUNA" o "BAJA" o "MEDIA" o "ALTA",
  "observaciones": "observaciones relevantes para el equipo auditor: sellos faltantes, firmas, ilegibilidad, etc."
}`;

    let text: string;

    if (chosen === "gemini") {
      const geminiKey = this.encryption.decrypt(user!.geminiKeyEncrypted!, user!.geminiKeyIv!);
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [
              { text: OCR_PROMPT },
              { inline_data: { mime_type: "application/pdf", data: pdfBase64 } },
            ]}],
          }),
        }
      );
      const data = await res.json() as { error?: { message: string }; candidates?: Array<{ content: { parts: Array<{ text: string }> } }> };
      if (data.error) throw new Error(data.error.message);
      text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    } else {
      const anthropicKey = this.encryption.decrypt(user!.anthropicKeyEncrypted!, user!.anthropicKeyIv!);
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1024,
          messages: [{
            role: "user",
            content: [
              {
                type: "document",
                source: { type: "base64", media_type: "application/pdf", data: pdfBase64 },
              },
              { type: "text", text: OCR_PROMPT },
            ],
          }],
        }),
      });
      const data = await res.json() as { error?: { message: string }; content?: Array<{ type: string; text: string }> };
      if (data.error) throw new Error(data.error.message);
      text = data.content?.find((b) => b.type === "text")?.text ?? "";
    }

    if (text.includes("```")) {
      const parts = text.split("```");
      text = parts[1] ?? text;
      if (text.startsWith("json")) text = text.slice(4);
    }
    return JSON.parse(text.trim()) as unknown;
  }
}
