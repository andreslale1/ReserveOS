type ResumenClientas = {
  total: number;
  recurrentes: number;
  nuevas: number;
  tasa_referidos_pct: number | null;
  antiguedad_promedio_dias: number;
} | null;

type Retencion = {
  churn_pct: number | null;
  membresias_evaluadas: number;
  en_riesgo: number;
  retencion_acumulada_pct: number | null;
} | null;

type Ingreso = { mes: string; ingreso_real: number };
type Ranking = {
  instructor_membership_id: string;
  nombre: string;
  total_clases: number;
  ocupacion_promedio: number | null;
  pct_asistencia: number | null;
};
type Adquisicion = {
  canal: string;
  gasto_total: number;
  clientas_nuevas: number;
  cac: number | null;
  ltv_promedio: number | null;
  ltv_cac_ratio: number | null;
};
type Actividad = {
  id: string;
  actor_nombre: string | null;
  tabla: string;
  operacion: string;
  created_at: string;
};

function fmt(n: number) {
  return `Q${Number(n ?? 0).toLocaleString("es-GT", { maximumFractionDigits: 0 })}`;
}
function pct(n: number | null) {
  return n === null || n === undefined ? "—" : `${n}%`;
}
function mesLabel(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("es-GT", {
    month: "short",
    year: "2-digit",
  });
}

export default function NegocioView({
  resumenClientas,
  ingresoMensual,
  retencion,
  ranking,
  adquisicion,
  actividad,
}: {
  resumenClientas: ResumenClientas;
  ingresoMensual: Ingreso[];
  retencion: Retencion;
  ranking: Ranking[];
  adquisicion: Adquisicion[];
  actividad: Actividad[];
}) {
  const maxIngreso = Math.max(1, ...ingresoMensual.map((i) => Number(i.ingreso_real)));

  return (
    <main className="min-h-screen bg-cream">
      <header className="border-b border-white/10 bg-card px-6 py-6 md:px-10">
        <h1 className="text-2xl font-semibold text-ink md:text-3xl">
          Negocio
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Visión estratégica — solo dueña y gerencia general.
        </p>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8 md:px-10">
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-card p-5">
            <p className="text-xs uppercase tracking-wide text-ink-soft">
              Clientas totales
            </p>
            <p className="mt-2 text-2xl font-bold text-ink">
              {resumenClientas?.total ?? "—"}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-card p-5">
            <p className="text-xs uppercase tracking-wide text-ink-soft">
              Recurrentes
            </p>
            <p className="mt-2 text-2xl font-bold text-ink">
              {resumenClientas?.recurrentes ?? "—"}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-card p-5">
            <p className="text-xs uppercase tracking-wide text-ink-soft">
              Churn (30-60d)
            </p>
            <p className="mt-2 text-2xl font-bold text-ink">
              {pct(retencion?.churn_pct ?? null)}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-card p-5">
            <p className="text-xs uppercase tracking-wide text-ink-soft">
              En riesgo de fuga
            </p>
            <p className="mt-2 text-2xl font-bold text-ink">
              {retencion?.en_riesgo ?? "—"}
            </p>
          </div>
        </div>

        <h2 className="mt-10 text-sm font-medium uppercase tracking-wide text-ink-soft">
          Ingreso real mensual
        </h2>
        {ingresoMensual.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-white/15 bg-card p-8 text-center text-sm text-ink-soft">
            Sin datos de ingresos todavía.
          </div>
        ) : (
          <div className="mt-4 flex items-end gap-3 rounded-2xl border border-white/10 bg-card p-5">
            {ingresoMensual.map((m, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex h-32 w-full items-end">
                  <div
                    className="w-full rounded-t-md bg-lime transition-[height] duration-700"
                    style={{
                      height: `${Math.max(4, (Number(m.ingreso_real) / maxIngreso) * 100)}%`,
                    }}
                  />
                </div>
                <span className="text-[11px] text-ink-soft">
                  {mesLabel(m.mes)}
                </span>
                <span className="text-xs font-medium text-ink">
                  {fmt(m.ingreso_real)}
                </span>
              </div>
            ))}
          </div>
        )}

        <h2 className="mt-10 text-sm font-medium uppercase tracking-wide text-ink-soft">
          Adquisición por canal (3 meses)
        </h2>
        {adquisicion.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-white/15 bg-card p-8 text-center text-sm text-ink-soft">
            Sin datos de adquisición todavía.
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {adquisicion.map((a, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-card p-4"
              >
                <div>
                  <p className="text-sm font-medium capitalize text-ink">
                    {a.canal}
                  </p>
                  <p className="text-xs text-ink-soft">
                    {a.clientas_nuevas} clientas nuevas · CAC {fmt(a.cac ?? 0)}{" "}
                    · LTV {fmt(a.ltv_promedio ?? 0)}
                  </p>
                </div>
                <span
                  className={`text-sm font-semibold ${
                    (a.ltv_cac_ratio ?? 0) >= 3 ? "text-sage" : "text-ink"
                  }`}
                >
                  {a.ltv_cac_ratio ? `${a.ltv_cac_ratio}x LTV/CAC` : "—"}
                </span>
              </li>
            ))}
          </ul>
        )}

        <h2 className="mt-10 text-sm font-medium uppercase tracking-wide text-ink-soft">
          Ranking de instructoras
        </h2>
        {ranking.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-white/15 bg-card p-8 text-center text-sm text-ink-soft">
            Sin clases con instructora asignada todavía.
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {ranking.map((r) => (
              <li
                key={r.instructor_membership_id}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-card p-4"
              >
                <div>
                  <p className="text-sm font-medium text-ink">{r.nombre}</p>
                  <p className="text-xs text-ink-soft">
                    {r.total_clases} clases · asistencia {pct(r.pct_asistencia)}
                  </p>
                </div>
                <span className="text-sm font-semibold text-ink">
                  {pct(r.ocupacion_promedio)} ocupación
                </span>
              </li>
            ))}
          </ul>
        )}

        <h2 className="mt-10 text-sm font-medium uppercase tracking-wide text-ink-soft">
          Actividad reciente del equipo
        </h2>
        {actividad.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-white/15 bg-card p-8 text-center text-sm text-ink-soft">
            Sin actividad registrada en los últimos 14 días.
          </div>
        ) : (
          <ul className="mt-4 space-y-1.5">
            {actividad.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between rounded-lg border border-white/5 bg-card/60 px-4 py-2 text-xs"
              >
                <span className="text-ink-soft">
                  <span className="text-ink">{a.actor_nombre ?? "—"}</span>{" "}
                  {a.operacion} en {a.tabla}
                </span>
                <span className="text-ink-soft">
                  {new Date(a.created_at).toLocaleString("es-GT", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
