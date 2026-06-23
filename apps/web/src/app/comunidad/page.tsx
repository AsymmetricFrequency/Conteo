import { api } from "@/lib/api";
import type { CommunitySats, AuditorEntry } from "@/lib/api";
import Link from "next/link";

export const dynamic = "force-dynamic";

function n(v: number) { return v.toLocaleString("es-CO"); }

function formatTime(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-yellow-500 font-black text-lg">🥇</span>;
  if (rank === 2) return <span className="text-gray-400 font-black text-lg">🥈</span>;
  if (rank === 3) return <span className="text-amber-600 font-black text-lg">🥉</span>;
  return <span className="text-[#9ca3af] font-bold tabnum w-7 text-center inline-block">{rank}</span>;
}

export default async function ComunidadPage() {
  let communityStats: CommunitySats | null = null;
  let auditors: AuditorEntry[] = [];

  const [r0, r1] = await Promise.allSettled([
    api.auth.communityStats(),
    api.auth.auditors(),
  ]);
  if (r0.status === "fulfilled") communityStats = r0.value;
  if (r1.status === "fulfilled") auditors = r1.value;

  const top = auditors[0];
  const totalActas = communityStats?.totalActas ?? 121951;
  const totalAuditadas = communityStats?.totalAuditadas ?? 0;
  const totalAuditores = communityStats?.totalAuditores ?? 0;
  const pct = totalActas > 0 ? ((totalAuditadas / totalActas) * 100) : 0;

  const totalTiempo = auditors.reduce((s, a) => s + a.tiempoEstimadoMin, 0);
  const totalCosto = auditors.reduce((s, a) => s + a.costoEstimadoUSD, 0);

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="border-b border-[#e5e7eb] pb-6">
        <div className="text-xs font-semibold text-[#9ca3af] uppercase tracking-widest mb-2">
          Auditoría ciudadana con IA
        </div>
        <h1 className="text-3xl font-black text-[#0a0a0a] leading-tight">
          Ciudadanos auditores · Colombia 2026
        </h1>
        <p className="text-sm text-[#6b7280] mt-2 max-w-xl">
          Cada persona aquí usó su propia API key de IA para escrutar actas E-14 de la Registraduría.
          Su inversión de tiempo y dinero protege la democracia colombiana.
        </p>
      </div>

      {/* Mission stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 border border-[#e5e7eb] divide-x divide-y lg:divide-y-0 divide-[#e5e7eb]">
        {[
          { label: "Actas escrutadas", value: n(totalAuditadas), color: "#059669", sub: `de ${n(totalActas)} totales` },
          { label: "Cobertura lograda", value: `${pct.toFixed(2)}%`, color: "#1d4ed8", sub: "del universo E-14" },
          { label: "Auditores activos", value: n(totalAuditores), color: "#7c3aed", sub: "ciudadanos colombianos" },
          { label: "Tiempo colectivo", value: formatTime(totalTiempo), color: "#d97706", sub: `~$${totalCosto.toFixed(2)} USD en IA` },
        ].map(({ label, value, color, sub }) => (
          <div key={label} className="p-5 text-center">
            <div className="font-black tabnum text-2xl" style={{ color }}>{value}</div>
            <div className="text-xs font-semibold text-[#0a0a0a] mt-1">{label}</div>
            <div className="text-xs text-[#9ca3af] mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      {/* Progress toward full coverage */}
      <div className="border border-[#e5e7eb] p-6">
        <div className="flex items-center justify-between mb-3">
          <span className="font-semibold text-sm">Avance hacia el 100%</span>
          <span className="text-xs text-[#6b7280]">{n(totalAuditadas)} / {n(totalActas)} actas</span>
        </div>
        <div className="h-3 bg-[#f3f4f6] relative">
          <div
            className="h-full bg-[#059669] transition-all"
            style={{ width: `${Math.max(pct, 0.1)}%` }}
          />
        </div>
        <p className="text-xs text-[#9ca3af] mt-2">
          Faltan <strong className="text-[#0a0a0a]">{n(totalActas - totalAuditadas)}</strong> actas.{" "}
          <Link href="/auditar" className="text-blue-600 underline">Únete y ayuda a auditarlas →</Link>
        </p>
      </div>

      {/* Leaderboard */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Tabla de honor · Auditores</h2>
          <span className="text-xs text-[#9ca3af]">{auditors.length} participantes</span>
        </div>

        <div className="border border-[#e5e7eb] overflow-hidden">
          {/* Table header */}
          <div className="hidden lg:grid grid-cols-12 gap-4 px-5 py-3 bg-[#f9fafb] border-b border-[#e5e7eb] text-xs font-semibold text-[#6b7280] uppercase tracking-wide">
            <div className="col-span-1">#</div>
            <div className="col-span-3">Auditor</div>
            <div className="col-span-2 text-right">Actas</div>
            <div className="col-span-2 text-right">Tiempo</div>
            <div className="col-span-2 text-right">Inversión IA</div>
            <div className="col-span-2 text-right">Progreso</div>
          </div>

          {auditors.map((a, i) => {
            const pctUser = top ? (a.actasAuditadas / top.actasAuditadas) * 100 : 0;
            return (
              <div
                key={i}
                className={`grid grid-cols-1 lg:grid-cols-12 gap-2 lg:gap-4 px-5 py-4 border-b border-[#f3f4f6] items-center ${i === 0 ? "bg-yellow-50" : "hover:bg-[#f9fafb]"}`}
              >
                {/* Rank */}
                <div className="lg:col-span-1 flex items-center gap-2">
                  <RankBadge rank={a.rank} />
                </div>

                {/* Name */}
                <div className="lg:col-span-3">
                  <div className="font-semibold text-sm text-[#0a0a0a]">{a.name}</div>
                  <div className="text-xs text-[#9ca3af]">{a.emailMasked}</div>
                  <div className="text-xs text-[#9ca3af]">
                    Desde {new Date(a.miembroDesde).toLocaleDateString("es-CO", { month: "short", year: "numeric" })}
                  </div>
                </div>

                {/* Actas */}
                <div className="lg:col-span-2 lg:text-right">
                  <div className="font-black tabnum text-lg text-[#0a0a0a]">{n(a.actasAuditadas)}</div>
                  <div className="text-xs text-[#9ca3af]">actas auditadas</div>
                </div>

                {/* Tiempo */}
                <div className="lg:col-span-2 lg:text-right">
                  <div className="font-bold text-sm text-[#4b5563]">{formatTime(a.tiempoEstimadoMin)}</div>
                  <div className="text-xs text-[#9ca3af]">tiempo estimado</div>
                </div>

                {/* Costo IA */}
                <div className="lg:col-span-2 lg:text-right">
                  <div className="font-bold text-sm text-[#4b5563]">~${a.costoEstimadoUSD.toFixed(3)}</div>
                  <div className="text-xs text-[#9ca3af]">USD en IA</div>
                </div>

                {/* Progress bar relative to top */}
                <div className="lg:col-span-2">
                  <div className="h-1.5 bg-[#f3f4f6]">
                    <div
                      className={`h-full ${i === 0 ? "bg-yellow-400" : "bg-[#0a0a0a]"}`}
                      style={{ width: `${pctUser}%` }}
                    />
                  </div>
                  <div className="text-xs text-[#9ca3af] mt-1 text-right">{pctUser.toFixed(0)}% del líder</div>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-[#9ca3af]">
          * Tiempo estimado: ~4 min/acta · Costo IA estimado: ~$0.0008 USD/acta (promedio Gemini Flash + Claude Haiku)
        </p>
      </div>

      {/* Cómo contribuir */}
      <div className="border border-[#e5e7eb] p-6 space-y-5">
        <div>
          <div className="text-xs font-semibold text-[#9ca3af] uppercase tracking-widest mb-1">Participación ciudadana</div>
          <h2 className="text-lg font-bold text-[#0a0a0a]">Cómo contribuye para esta auditoría</h2>
          <p className="text-sm text-[#6b7280] mt-1">
            Cualquier ciudadano colombiano puede participar en el escrutinio de actas E-14 usando inteligencia artificial.
            Solo necesitas una cuenta de correo y una API key de Google o Anthropic.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              step: "01",
              title: "Crea tu cuenta",
              desc: "Regístrate con tu email. Tu identidad queda vinculada a cada acta que audites.",
            },
            {
              step: "02",
              title: "Conecta tu IA",
              desc: "Ingresa tu API key de Google Gemini o Anthropic Claude. Se guarda cifrada (AES-256) en nuestros servidores. Tú controlas el costo.",
            },
            {
              step: "03",
              title: "Audita actas E-14",
              desc: "El sistema te asigna una acta de la Registraduría. La IA extrae los votos, detecta errores aritméticos y enmiendas visuales.",
            },
            {
              step: "04",
              title: "Verifica y envía",
              desc: "Revisas el resultado lado a lado con el PDF original. Al confirmar, tu auditoría queda registrada en la base de datos pública.",
            },
          ].map(({ step, title, desc }) => (
            <div key={step} className="border border-[#e5e7eb] p-4 space-y-2">
              <div className="text-2xl font-black text-[#e5e7eb] leading-none">{step}</div>
              <div className="font-semibold text-sm text-[#0a0a0a]">{title}</div>
              <p className="text-xs text-[#6b7280] leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-1">
          <Link
            href="/auditar"
            className="inline-flex items-center justify-center gap-2 bg-[#0a0a0a] text-white px-6 py-2.5 text-sm font-medium hover:bg-[#374151] transition-colors"
          >
            Empezar a auditar →
          </Link>
          <Link
            href="/mapa"
            className="inline-flex items-center justify-center gap-2 border border-[#e5e7eb] px-6 py-2.5 text-sm font-medium hover:bg-[#f9fafb] transition-colors"
          >
            Ver cobertura en el mapa
          </Link>
        </div>

        <p className="text-xs text-[#9ca3af] border-t border-[#f3f4f6] pt-4">
          El costo promedio de auditar una acta con IA es de aproximadamente <strong className="text-[#4b5563]">$0.0008 USD</strong>.
          Auditar 100 actas cuesta menos de <strong className="text-[#4b5563]">$0.08 USD</strong> y toma cerca de 7 minutos.
          Tu inversión es directamente proporcional a la transparencia electoral.
        </p>
      </div>

      {/* Methodology note */}
      <div className="border border-[#e5e7eb] p-5 text-xs text-[#6b7280] space-y-1">
        <div className="font-semibold text-[#0a0a0a] mb-2">Sobre la metodología</div>
        <p>Los auditores usan sus propias API keys de IA (Google Gemini Flash o Anthropic Claude Haiku) para extraer datos de formularios E-14 publicados por la Registraduría Nacional.</p>
        <p>Las keys se almacenan cifradas (AES-256-GCM) en nuestros servidores y nunca se exponen al cliente. Solo se usan para la extracción OCR.</p>
        <p>Cada resultado es revisado visualmente por el auditor antes de enviarse. El sistema detecta automáticamente inconsistencias aritméticas.</p>
      </div>
    </div>
  );
}
