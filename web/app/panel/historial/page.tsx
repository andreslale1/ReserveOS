import Link from "next/link";
import { redirect } from "next/navigation";
import { getPanelContext, puedeVer } from "@/lib/panel-context";
import { argumentosHistorial, asistenciaTexto, DIAS, type FilaHistorial, type Filtros } from "./filtros";

const POR_PAGINA = 100;
const campo = "mt-1 w-full rounded-lg border border-white/15 bg-cream px-3 py-2 text-sm text-ink outline-none focus:border-ink/30";

export default async function HistorialPage({ searchParams }: { searchParams: Promise<Filtros> }) {
  const f = await searchParams;
  const { supabase, membership, sedes } = await getPanelContext();
  if (!membership) return null;
  if (!puedeVer(membership.role, "/panel/historial")) redirect("/panel/hoy");

  const pagina = Math.max(1, Number(f.pagina) || 1);
  const [{ data, error }, { data: instrs }] = await Promise.all([
    supabase.rpc("historial_reservas", argumentosHistorial(membership.tenant_id, f, POR_PAGINA, (pagina - 1) * POR_PAGINA)),
    membership.role === "instructora"
      ? Promise.resolve({ data: [] as { id: string; nombre: string }[] })
      : supabase.from("tenant_memberships").select("id, nombre").eq("tenant_id", membership.tenant_id).eq("role", "instructora").order("nombre"),
  ]);
  const filas = (data ?? []) as FilaHistorial[];
  const total = filas[0] ? Number(filas[0].total) : 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const query = (extra: Record<string, string>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...f, ...extra })) if (v) p.set(k, String(v));
    return p.toString();
  };

  // Se agrupa por día y clase: «quién reservó y quién asistió» de cada una.
  const grupos = new Map<string, FilaHistorial[]>();
  for (const x of filas) {
    const k = `${x.fecha}|${x.hora_inicio}|${x.nombre_clase}|${x.sede}`;
    grupos.set(k, [...(grupos.get(k) ?? []), x]);
  }

  return (
    <main className="min-h-screen bg-cream">
      <header className="border-b border-white/10 bg-card px-6 py-6 md:px-10">
        <h1 className="font-serif text-2xl text-ink md:text-3xl">Historial de reservas</h1>
        <p className="mt-1 text-sm text-ink/60">
          Cada clase, con quién reservó y quién asistió.{membership.role === "instructora" ? " Solo ves las clases que das tú." : " Ves las sedes que te corresponden."}
        </p>
      </header>

      <div className="mx-auto grid max-w-6xl gap-5 px-6 py-8 md:px-10">
        <form method="get" className="grid gap-3 rounded-2xl border border-white/10 bg-card p-5 sm:grid-cols-2 lg:grid-cols-4" aria-label="Filtros del historial">
          <label className="text-sm text-ink/70">Desde<input type="date" name="desde" defaultValue={f.desde ?? ""} className={campo} /></label>
          <label className="text-sm text-ink/70">Hasta<input type="date" name="hasta" defaultValue={f.hasta ?? ""} className={campo} /></label>
          {sedes.length > 1 && (
            <label className="text-sm text-ink/70">Sede
              <select name="sede" defaultValue={f.sede ?? ""} className={campo}><option value="">Todas</option>{sedes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
            </label>
          )}
          {membership.role !== "instructora" && (
            <label className="text-sm text-ink/70">Instructora
              <select name="instructora" defaultValue={f.instructora ?? ""} className={campo}><option value="">Todas</option>{(instrs ?? []).map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}</select>
            </label>
          )}
          <label className="text-sm text-ink/70">Día de la semana
            <select name="dia" defaultValue={f.dia ?? ""} className={campo}><option value="">Todos</option>{DIAS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select>
          </label>
          <label className="text-sm text-ink/70">Hora de inicio<input type="time" name="hora" defaultValue={f.hora ?? ""} className={campo} /></label>
          <label className="text-sm text-ink/70">Estado
            <select name="estado" defaultValue={f.estado ?? ""} className={campo}><option value="">Todos</option><option value="confirmada">Reservada</option><option value="cancelada">Cancelada</option></select>
          </label>
          <label className="text-sm text-ink/70">Asistencia
            <select name="asistencia" defaultValue={f.asistencia ?? ""} className={campo}><option value="">Todas</option><option value="asistio">Asistió</option><option value="no_vino">No vino</option><option value="sin_marcar">Sin marcar</option></select>
          </label>
          <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-4">
            <button className="press-spring rounded-full bg-ink px-5 py-2 text-sm font-medium text-cream">Filtrar</button>
            <Link href="/panel/historial" className="rounded-full border border-white/15 px-4 py-2 text-sm text-ink/70 hover:text-ink">Limpiar</Link>
            <a href={`/panel/historial/export?${query({ pagina: "" })}`} className="ml-auto rounded-full border border-white/15 px-4 py-2 text-sm text-ink hover:bg-white/5">Descargar para Excel (CSV)</a>
          </div>
        </form>

        {error && <p role="alert" className="rounded-xl bg-peach-tint px-4 py-3 text-sm text-ink">{error.message}</p>}
        <p className="text-sm text-ink/60" aria-live="polite">{total === 0 ? "No hay reservas con esos filtros." : `${total} reserva${total === 1 ? "" : "s"} · página ${pagina} de ${paginas}`}</p>

        {[...grupos.entries()].map(([k, rows]) => {
          const g = rows[0];
          return (
            <section key={k} className="rounded-2xl border border-white/10 bg-card p-5">
              <h2 className="text-base font-semibold text-ink">{g.nombre_clase} · {g.hora_inicio.slice(0, 5)}</h2>
              <p className="text-xs text-ink/55">
                {DIAS[g.dia_semana]} {new Date(g.fecha + "T00:00:00").toLocaleDateString("es-GT", { day: "numeric", month: "long", year: "numeric" })} · {g.sede}{g.instructora ? ` · ${g.instructora}` : ""}
              </p>
              <ul className="mt-3 divide-y divide-white/10">
                {rows.map((r) => (
                  <li key={r.reserva_id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <span className="text-ink">{r.cliente}{r.tipo !== "regular" && <span className="ml-2 text-xs text-ink/50">{r.tipo}</span>}</span>
                    <span className="flex items-center gap-3">
                      {r.estado === "confirmada" && r.confirmada && <span className="text-xs text-sage">confirmó</span>}
                      <span className={`rounded-full px-3 py-1 text-xs ${r.estado === "cancelada" ? "bg-peach-tint text-ink" : r.asistio === true ? "bg-sage-tint text-sage" : r.asistio === false ? "bg-peach-tint text-ink" : "bg-white/5 text-ink/60"}`}>{asistenciaTexto(r)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

        {paginas > 1 && (
          <nav className="flex items-center justify-between text-sm" aria-label="Paginación">
            {pagina > 1 ? <Link className="rounded-full border border-white/15 px-4 py-2 text-ink" href={`/panel/historial?${query({ pagina: String(pagina - 1) })}`}>← Anterior</Link> : <span />}
            {pagina < paginas ? <Link className="rounded-full border border-white/15 px-4 py-2 text-ink" href={`/panel/historial?${query({ pagina: String(pagina + 1) })}`}>Siguiente →</Link> : <span />}
          </nav>
        )}
      </div>
    </main>
  );
}
