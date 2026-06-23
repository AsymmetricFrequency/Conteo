const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3008/api";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "content-type": "application/json" },
    next: { revalidate: 30 },
    ...init,
  });
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

// ─── Alert types ─────────────────────────────────────────────────────────────

export interface AlertItem {
  id: string;
  ruleId: string;
  category: string;
  severity: "ALTA" | "MEDIA" | "BAJA";
  message: string;
  fields: string[];
  details: Record<string, unknown> | null;
  estado: string;
  revisadoPor: string | null;
  notas: string | null;
  formId: string;
  municipio: string;
  ubicacionKey: string;
  mesa: string;
  createdAt: string;
}

export interface StatsSummary {
  totalForms: number;
  totalReports: number;
  porSeveridad: Array<{ severity: string; count: number }>;
  porCategoria: Array<{ category: string; count: number }>;
  porEstado: Array<{ estado: string; count: number }>;
}

// ─── Preconteo types ──────────────────────────────────────────────────────────

export interface PreconteoSummary {
  municipios: number;
  mesas: { total: number; escrutadas: number };
  sufragantes: number;
  candidatos: Array<{
    cedula: string;
    nombre: string;
    vot: number;
    pct: string;
  }>;
}

export interface PreconteoMunicipio {
  munCodigo: string;
  munNombre: string;
  deptCodigo: string;
  deptNombre: string;
  mesas: { total: number; escrutadas: number };
  sufragantes: number;
  votnul: number;
  votblan: number;
  numact: string;
  capturedAt: string;
  votos: Array<{
    codcan: string;
    cedula: string;
    nombre: string;
    vot: number;
    pvot: string;
  }>;
}

// ─── Auth / Community types ───────────────────────────────────────────────────

export interface ConteoUser {
  id: string;
  email: string;
  name: string;
  role: string;
  actasAuditadas: number;
  createdAt: string;
}

export interface CommunitySats {
  totalAuditores: number;
  totalAuditadas: number;
  totalActas: number;
  pctCompletado: number;
  topAuditores: Array<{ name: string; email: string; actasAuditadas: number }>;
}

export interface ClaimResult {
  claimed: boolean;
  message?: string;
  txId?: string;
  pdfUrl?: string;
  departamento?: string;
  municipio?: string;
  zona?: string;
  stand?: string;
  mesa?: string;
}

// ─── E14 types ────────────────────────────────────────────────────────────────

export interface E14PipelineStats {
  total: number;
  pending: number;
  downloaded: number;
  ocr_done: number;
  error: number;
  topDepts: Array<{ dept: string; count: number }>;
}

export interface E14OcrResult {
  tipoCopia: "CLAVEROS" | "DELEGADOS" | "DESCONOCIDO";
  mesa: number | null;
  puesto: string;
  zona: string;
  municipio: string;
  departamento: string;
  nivelacion?: {
    totalVotantesE11: number | null;
    totalVotosUrna: number | null;
    totalVotosIncinerados: number | null;
  };
  candidatos: Array<{ nombre: string; votos: number | null }>;
  votosEnBlanco: number | null;
  votosNulos: number | null;
  votosNoMarcados: number | null;
  sumaTotal: number | null;
  totalSufragantes: number | null;
  hayEnmiendas: boolean;
  enmiendaDetalle: string;
  severidadAnomalia: "NINGUNA" | "BAJA" | "MEDIA" | "ALTA";
  observaciones: string;
}

export interface E14RecentActa {
  id: string;
  txId: string;
  deptCode: string;
  munCode: string;
  mesa: string;
  pdfUrl?: string;
  sourceUrl?: string;
  ocrResult: E14OcrResult | null;
  processedAt: string | null;
}

export interface E14Comparacion {
  totalActas: number;
  municipios: Array<{
    munCode: string;
    munNombre: string;
    deptNombre: string;
    mesasTotalMunicipio: number;
    mesasEscrutadas: number;
    mesasConE14: number;
    preconteo: { cepedaVotos: number; espriellaVotos: number; pctCepeda: number; pctEspriella: number };
    e14Delegados: { cepedaVotos: number; espriellaVotos: number; pctCepeda: number; pctEspriella: number };
    diferenciaPct: number;
    alertaNivel: "ALTA" | "MEDIA" | "BAJA" | "OK";
    actas: Array<{
      txId: string; zona: string; stand: string; mesa: string;
      tipoCopia: string; cepedaVotos: number | null; espriellaVotos: number | null;
      totalVotosActa: number; hayIrregularidades: boolean; fraudSeverity: string; pdfUrl: string;
    }>;
  }>;
}

export interface FraudActa {
  txId: string;
  deptCode: string;
  munCode: string;
  zona: string;
  stand: string;
  mesa: string;
  tipoCopia: string;
  municipio: string;
  departamento: string;
  candidato0: { nombre: string; votos: number | null };
  candidato1: { nombre: string; votos: number | null };
  nivelacion: { totalVotantesE11?: number | null; totalVotosUrna?: number | null };
  sumaTotal: number | null;
  hayEnmiendas: boolean;
  enmiendaDetalle: string;
  severidadAnomalia: string;
  flagsAritmetica: string[];
  processedAt: string | null;
  pdfUrl: string;
}

export interface E14FraudCheck {
  resumen: {
    totalAnalizadas: number;
    totalConIrregularidades: number;
    conErrorAritmetico: number;
    conEnmiendaVisual: number;
    severidadAlta: number;
  };
  irregularidades: FraudActa[];
}

// ─── Geo / Browse types ───────────────────────────────────────────────────────

export interface DeptStat {
  code: string;
  total: number;
  auditadas: number;
  pct: number;
  conIrregularidades: number;
  severidadAlta: number;
}

export interface MunStat {
  code: string;
  total: number;
  auditadas: number;
}

export interface PreconteoDeptStat {
  deptCodigo: string;
  deptNombre: string;
  mesasTotal: number;
  mesasEsc: number;
  sufragantes: number;
  cepedaVotos: number;
  espriellaVotos: number;
  pctCepeda: number;
  pctEspriella: number;
  winner: "cepeda" | "espriella";
  margen: number;
}

export interface MesaBrief {
  id: string;
  txId: string;
  deptCode: string;
  munCode: string;
  zona: string;
  stand: string;
  mesa: string;
  pdfUrl: string;
  status: string;
  auditedAt: string | null;
  auditedByName: string | null;
  tipoCopia: string | null;
  municipio: string | null;
  departamento: string | null;
  candidato0: { nombre: string; votos: number | null } | null;
  candidato1: { nombre: string; votos: number | null } | null;
  sumaTotal: number | null;
  totalSufragantes: number | null;
  hayEnmiendas: boolean;
  fraudFlags: string[] | null;
  fraudSeverity: string | null;
}

export interface BrowseResult {
  total: number;
  offset: number;
  limit: number;
  actas: MesaBrief[];
}

export interface AuditorEntry {
  rank: number;
  name: string;
  emailMasked: string;
  actasAuditadas: number;
  tiempoEstimadoMin: number;
  costoEstimadoUSD: number;
  miembroDesde: string;
}

// ─── API calls ────────────────────────────────────────────────────────────────

export const api = {
  stats: () => apiFetch<StatsSummary>("/stats"),

  alerts: (params?: Record<string, string>) => {
    const q = params ? "?" + new URLSearchParams(params).toString() : "";
    return apiFetch<AlertItem[]>(`/alerts${q}`);
  },

  updateEstado: (
    id: string,
    body: { estado: string; notas?: string; revisadoPor?: string },
  ) =>
    apiFetch<AlertItem>(`/alerts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  health: () =>
    apiFetch<{ status: string; db: string; rulesVersion: string; time: string }>(
      "/health",
    ),

  preconteo: {
    summary: (dept?: string) => {
      const q = dept ? `?dept=${dept}` : "";
      return apiFetch<PreconteoSummary>(`/preconteo/summary${q}`);
    },
    list: (params?: { dept?: string; mun?: string }) => {
      const q = params ? "?" + new URLSearchParams(params as Record<string, string>).toString() : "";
      return apiFetch<PreconteoMunicipio[]>(`/preconteo${q}`);
    },
    byDept: () => apiFetch<PreconteoDeptStat[]>("/preconteo/by-dept"),
  },

  e14: {
    stats: () => apiFetch<E14PipelineStats>("/e14/stats"),
    recent: (limit = 20) =>
      apiFetch<E14RecentActa[]>(`/e14/recent?limit=${limit}`),
    fraudCheck: (limit = 200) =>
      apiFetch<E14FraudCheck>(`/e14/fraud-check?limit=${limit}`),
    comparacion: (dept?: string, minDiff = 3) => {
      const q = new URLSearchParams({ minDiff: String(minDiff), ...(dept ? { dept } : {}) });
      return apiFetch<E14Comparacion>(`/e14/comparacion?${q}`);
    },
    geoStats: () => apiFetch<DeptStat[]>("/e14/geo-stats"),
    municipalities: (dept: string) => apiFetch<MunStat[]>(`/e14/municipalities?dept=${dept}`),
    browse: (params: { dept?: string; mun?: string; status?: string; limit?: number; offset?: number }) => {
      const q = new URLSearchParams();
      if (params.dept) q.set("dept", params.dept);
      if (params.mun) q.set("mun", params.mun);
      if (params.status) q.set("status", params.status);
      if (params.limit) q.set("limit", String(params.limit));
      if (params.offset) q.set("offset", String(params.offset));
      return apiFetch<BrowseResult>(`/e14/browse?${q}`);
    },
  },

  auth: {
    register: (email: string, name: string, password: string) =>
      apiFetch<{ user: ConteoUser; token: string }>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, name, password }),
        next: { revalidate: 0 },
      }),
    login: (email: string, password: string) =>
      apiFetch<{ user: ConteoUser; token: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
        next: { revalidate: 0 },
      }),
    me: (token: string) =>
      apiFetch<ConteoUser>("/auth/me", {
        headers: { "content-type": "application/json", "authorization": `Bearer ${token}` },
        next: { revalidate: 0 },
      }),
    communityStats: () =>
      apiFetch<CommunitySats>("/auth/community-stats"),
    auditors: () =>
      apiFetch<AuditorEntry[]>("/auth/auditors"),
    claimActa: (token: string) =>
      apiFetch<ClaimResult>("/e14/claim", {
        method: "POST",
        headers: { "content-type": "application/json", "authorization": `Bearer ${token}` },
        next: { revalidate: 0 },
      }),
    submitAudit: (token: string, txId: string, ocrResult: unknown) =>
      apiFetch<{ success: boolean; message: string; fraudFlags: string[]; severity: string }>("/e14/submit", {
        method: "POST",
        headers: { "content-type": "application/json", "authorization": `Bearer ${token}` },
        body: JSON.stringify({ txId, ocrResult }),
        next: { revalidate: 0 },
      }),
  },
};
