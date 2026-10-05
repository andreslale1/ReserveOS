import { redirect } from "next/navigation";
import { getPanelContext, puedeVer } from "@/lib/panel-context";

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export default async function ReportesPage() {
  const { supabase, membership } = await getPanelContext();
  if (!membership) return null;
  if (!puedeVer(membership.role, "/panel/reportes")) redirect("/panel/hoy");

  const tenantId = membership.tenant_id;
  const desde = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const [{ data: afluencia }, { data: mensual }, { data: recientes }] =
    await Promise.all([
      supabase.rpc("kpi_afluencia_horarios", { p_tenant_id: tenantId }),
      supabase.rpc("kpi_reservas_mensual", { p_tenant_id: tenantId, p_meses: 6 }),
      supabase
        .from("reservas")
        .select("asistio, fecha")
        .eq("tenant_id", tenantId)
        .eq("estado", "confirmada")
        .gte("fecha", desde)
        .lte("fecha", new Date().toISOString().slice(0, 10)),
    ]);

  const marcadas = (recientes ?? []).filter((r) => r.asistio !== null);
  const asistieron = marcadas.filter((r) => r.asistio === true).length;
  const noShows = marcadas.length - asistieron;
  const sinMarcar = (recientes ?? []).length - marcadas.length;
  const tasa = marcadas.length ? Math.round((asistieron / marcadas.length) * 100) : null;

  const filas = ((afluencia ?? []) as {
    horario_id: string;
    nombre_clase: string;
    dia_semana: number;
    hora_inicio: string;
    cupo_maximo: number;
    ocupacion_pct: number | null;
  }[]).sort((a, b) => Number(b.ocupacion_pct ?? 0) - Number(a.ocupacion_pct ?? 0));

  const meses = (mensual ?? []) as { mes: string; reservas_real: number }[];
  const maxMes = Math.max(1, ...meses.map((m) => Number(m.reservas_real)));

  return (
    <main className="min-h-screen bg-cream">
      <header className="border-b border-white/10 bg-card px-6 py-6 md:px-10">
        <h1 className="font-serif text-2xl text-ink md:text-3xl">Reportes</h1>
        <p className="mt-1 text-sm text-ink/60">Asistencia y ocupación (últimos 30 días)</p>
      </header>
      <div className="mx-auto grid max-w-4xl gap-6 px-6 py-8 md:px-10">
        <section className="grid gap-4 sm:grid-cols-4">
          {[
            ["Asistencia", tasa === null ? "—" : `${tasa}%`],
            ["Asistieron", String(asistieron)],
            ["No vinieron", String(noShows)],
            ["Sin marcar", String(sinMarcar)],
          ].map(([l, v]) => (
            <div key={l} className="rounded-2xl border border-white/10 bg-card p-5">
              <p className="text-xs uppercase tracking-wide text-ink/45">{l}</p>
              <p className="mt-1 font-serif text-3xl text-ink">{v}</p>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-white/10 bg-card p-5">
          <h2 className="text-base font-semibold text-ink">Reservas por mes</h2>
          <ul className="mt-4 space-y-2">
            {meses.length === 0 && <li className="text-sm text-ink/50">Sin datos todavía.</li>}
            {meses.map((m) => (
              <li key={m.mes} className="flex items-center gap-3 text-sm">
                <span className="w-20 text-ink/60">{String(m.mes).slice(0, 7)}</span>
                <span
                  className="h-3 rounded-full bg-peach"
                  style={{ width: `${(Number(m.reservas_real) / maxMes) * 100}%`, minWidth: 4 }}
                />
                <span className="text-ink">{m.reservas_real}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-white/10 bg-card p-5">
          <h2 className="text-base font-semibold text-ink">Ocupación por horario</h2>
          <ul className="mt-3 divide-y divide-white/10">
            {filas.length === 0 && <li className="py-3 text-sm text-ink/50">Sin datos todavía.</li>}
            {filas.map((f) => (
              <li key={f.horario_id} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-ink">
                  {DIAS[f.dia_semana]} {f.hora_inicio.slice(0, 5)} · {f.nombre_clase}
                </span>
                <span className="text-ink/70">
                  {f.ocupacion_pct === null ? "—" : `${Math.round(Number(f.ocupacion_pct))}%`} de {f.cupo_maximo} lugares
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
