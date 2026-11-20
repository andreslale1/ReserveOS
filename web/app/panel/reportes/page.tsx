import { redirect } from "next/navigation";
import { getPanelContext, puedeVer } from "@/lib/panel-context";
import { REPORTES } from "@/lib/reportes-catalogo";
import { hoyGT, primerDiaMesGT } from "@/lib/fechas";
import { Anillo, BarrasH, Distribucion, Tendencia } from "@/components/graficas/graficas";

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export default async function ReportesPage({ searchParams }: { searchParams: Promise<{ desde?: string; hasta?: string; sede?: string }> }) {
  const sp = await searchParams;
  const { supabase, membership, sedes } = await getPanelContext();
  if (!membership) return null;
  if (!puedeVer(membership.role, "/panel/reportes")) redirect("/panel/hoy");

  const tenantId = membership.tenant_id;
  // eslint-disable-next-line react-hooks/purity -- componente de servidor: la hora de la petición es lo que se quiere
  const desde = hoyGT(new Date(Date.now() - 30 * 86400000));

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
        .lte("fecha", hoyGT()),
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

  const fecha = /^\d{4}-\d{2}-\d{2}$/;
  const dDesde = fecha.test(sp.desde ?? "") ? sp.desde! : primerDiaMesGT();
  const dHasta = fecha.test(sp.hasta ?? "") ? sp.hasta! : hoyGT();
  const dSede = sp.sede && sedes.some((x) => x.id === sp.sede) ? sp.sede : "";
  const qs = `desde=${dDesde}&hasta=${dHasta}${dSede ? `&sede=${dSede}` : ""}`;
  const mios = REPORTES.filter((r) => r.roles.includes(membership.role));
  const grupos = [...new Set(mios.map((r) => r.grupo))];
  const veAsistencia = membership.role !== "contadora";
  const meses = (mensual ?? []) as { mes: string; reservas_real: number }[];

  return (
    <main className="min-h-screen bg-cream">
      <header className="border-b border-ink/10 bg-card px-6 py-6 md:px-10">
        <h1 className="font-serif text-2xl text-ink md:text-3xl">Reportes</h1>
        <p className="mt-1 text-sm text-ink/60">Asistencia y ocupación (últimos 30 días)</p>
      </header>
      <div className="mx-auto grid max-w-4xl gap-6 px-6 py-8 md:px-10">
        <section className="rounded-2xl border border-ink/10 bg-card p-5" aria-label="Descargas">
          <h2 className="text-base font-semibold text-ink">Descargas (Excel / CSV)</h2>
          <p className="mt-1 text-xs text-ink/55">Cada descarga trae solo lo que tu rol puede ver. «Ingresos confirmados» usa la misma regla que Finanzas.</p>
          <form method="get" className="mt-3 flex flex-wrap items-end gap-3">
            <label className="text-sm text-ink/60" htmlFor="rep-desde">Desde<input id="rep-desde" type="date" name="desde" defaultValue={dDesde} className="mt-1 block rounded-lg border border-ink/15 bg-cream px-3 py-1.5 text-ink" /></label>
            <label className="text-sm text-ink/60" htmlFor="rep-hasta">Hasta<input id="rep-hasta" type="date" name="hasta" defaultValue={dHasta} className="mt-1 block rounded-lg border border-ink/15 bg-cream px-3 py-1.5 text-ink" /></label>
            {sedes.length > 1 && (
              <label className="text-sm text-ink/60" htmlFor="rep-sede">Sede
                <select id="rep-sede" name="sede" defaultValue={dSede} className="mt-1 block rounded-lg border border-ink/15 bg-cream px-3 py-1.5 text-ink">
                  <option value="">Todas</option>
                  {sedes.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
              </label>
            )}
            <button className="rounded-full border border-ink/15 px-4 py-1.5 text-sm text-ink hover:bg-ink/5">Aplicar</button>
          </form>
          {grupos.map((g) => (
            <div key={g} className="mt-5">
              <h3 className="text-xs font-medium uppercase tracking-wide text-ink/45">{g}</h3>
              <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                {mios.filter((r) => r.grupo === g).map((r) => (
                  <li key={r.id} className="rounded-xl border border-ink/10 p-3">
                    <a href={`/panel/reportes/export/${r.id}?${qs}`} className="text-sm font-medium text-ink underline">{r.titulo}</a>
                    <p className="mt-1 text-xs text-ink/55">{r.descripcion}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        {veAsistencia && <>
        <section className="grid gap-4 lg:grid-cols-3">
          <div className="border border-line bg-void-card p-5"><h2 className="mb-4 text-[10px] font-medium uppercase tracking-[0.12em] text-ink-soft">Asistencia</h2><Anillo pct={tasa} etiqueta={tasa === null ? "Aún sin asistencia marcada" : `${asistieron} de ${marcadas.length} reservas marcadas`} /></div>
          <div className="border border-line bg-void-card p-5 lg:col-span-2"><h2 className="mb-4 text-[10px] font-medium uppercase tracking-[0.12em] text-ink-soft">Qué pasó con las reservas (30 días)</h2><Distribucion partes={[{ nombre: "Asistieron", valor: asistieron, tono: "bueno" }, { nombre: "No vinieron", valor: noShows, tono: "malo" }, { nombre: "Sin marcar", valor: sinMarcar, tono: "gris" }]} vacio="Aún no hay reservas en estos 30 días." /></div>
        </section>

        <section className="border border-line bg-void-card p-5">
          <h2 className="mb-4 text-[10px] font-medium uppercase tracking-[0.12em] text-ink-soft">Reservas por mes</h2>
          {meses.length === 0 ? <p className="text-sm text-ink-soft">Sin datos todavía.</p> : <Tendencia puntos={meses.map((m) => ({ etiqueta: String(m.mes).slice(0, 7), valor: Number(m.reservas_real) }))} nombre="Reservas" alto={200} />}
        </section>

        <section className="border border-line bg-void-card p-5">
          <h2 className="mb-4 text-[10px] font-medium uppercase tracking-[0.12em] text-ink-soft">Ocupación por horario</h2>
          <BarrasH max={100} filas={filas.slice(0, 12).map((f) => ({ nombre: f.nombre_clase, detalle: `${DIAS[f.dia_semana].slice(0, 3)} ${f.hora_inicio.slice(0, 5)}`, valor: Number(f.ocupacion_pct ?? 0), texto: f.ocupacion_pct === null ? "—" : `${Math.round(Number(f.ocupacion_pct))}% de ${f.cupo_maximo}` }))} vacio="Sin datos todavía." />
        </section>
        </>}
      </div>
    </main>
  );
}
