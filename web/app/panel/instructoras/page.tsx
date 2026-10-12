import { redirect } from "next/navigation";
import { getPanelContext, puedeVer } from "@/lib/panel-context";
import { DIAS } from "../historial/filtros";
import ClasesView, { type Clase } from "./clases-view";

type Filtros = { desde?: string; hasta?: string; sede?: string; dia?: string; hora?: string; instructora?: string };
type Resumen = { instructora_id: string | null; instructora: string; clases: number; clases_canceladas: number; alumnas: number; asistieron: number; no_vinieron: number; sin_marcar: number; cancelaciones: number; ocupacion_pct: number; asistencia_pct: number | null };
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const campo = "mt-1 w-full rounded-lg border border-white/15 bg-cream px-3 py-2 text-sm text-ink outline-none focus:border-ink/30";

export default async function InstructorasPage({ searchParams }: { searchParams: Promise<Filtros> }) {
  const f = await searchParams;
  const { supabase, membership, sedes } = await getPanelContext();
  if (!membership) return null;
  if (!puedeVer(membership.role, "/panel/instructoras")) redirect("/panel/hoy");

  const comunes = {
    p_tenant_id: membership.tenant_id,
    p_desde: f.desde && ISO.test(f.desde) ? f.desde : null,
    p_hasta: f.hasta && ISO.test(f.hasta) ? f.hasta : null,
    p_sede_id: f.sede || null,
    p_dia_semana: f.dia !== undefined && f.dia !== "" && Number(f.dia) >= 0 && Number(f.dia) <= 6 ? Number(f.dia) : null,
    p_hora: f.hora && /^\d{2}:\d{2}$/.test(f.hora) ? f.hora : null,
  };
  const esG = membership.role === "duena" || membership.role === "gerente_general";
  const [resumen, detalle, instrs, reto] = await Promise.all([
    supabase.rpc("resumen_instructoras", comunes),
    supabase.rpc("clases_dictadas", { ...comunes, p_instructora: f.instructora || null }),
    supabase.from("tenant_memberships").select("id, nombre").eq("tenant_id", membership.tenant_id).eq("role", "instructora").order("nombre"),
    esG ? supabase.from("configuracion_reservas").select("reto_mensual_clases").eq("tenant_id", membership.tenant_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const filas = (resumen.data ?? []) as Resumen[];
  const clases = (detalle.data ?? []) as Clase[];
  const error = resumen.error?.message ?? detalle.error?.message;
  const propia = membership.role === "instructora";

  return (
    <main className="min-h-screen bg-cream">
      <header className="border-b border-white/10 bg-card px-6 py-6 md:px-10">
        <h1 className="font-serif text-2xl text-ink md:text-3xl">Clases por instructora</h1>
        <p className="mt-1 text-sm text-ink/60">
          {propia ? "Las clases que has dado: alumnas, asistencia y cancelaciones." : "Cuántas clases dictó cada persona, con cuántas alumnas, qué ocupación y asistencia tuvo. La instructora queda guardada en cada clase: si cambias la del horario, lo ya dado no cambia."}
        </p>
      </header>

      <div className="mx-auto grid max-w-6xl gap-5 px-6 py-8 md:px-10">
        <form method="get" className="grid gap-3 rounded-2xl border border-white/10 bg-card p-5 sm:grid-cols-2 lg:grid-cols-4" aria-label="Filtros">
          <label className="text-sm text-ink/70">Desde<input type="date" name="desde" defaultValue={f.desde ?? ""} className={campo} /></label>
          <label className="text-sm text-ink/70">Hasta<input type="date" name="hasta" defaultValue={f.hasta ?? ""} className={campo} /></label>
          {sedes.length > 1 && <label className="text-sm text-ink/70">Sede<select name="sede" defaultValue={f.sede ?? ""} className={campo}><option value="">Todas</option>{sedes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
          {!propia && <label className="text-sm text-ink/70">Instructora<select name="instructora" defaultValue={f.instructora ?? ""} className={campo}><option value="">Todas</option>{(instrs.data ?? []).map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}</select></label>}
          <label className="text-sm text-ink/70">Día<select name="dia" defaultValue={f.dia ?? ""} className={campo}><option value="">Todos</option>{DIAS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select></label>
          <label className="text-sm text-ink/70">Hora de inicio<input type="time" name="hora" defaultValue={f.hora ?? ""} className={campo} /></label>
          <div className="flex items-end"><button className="press-spring rounded-full bg-ink px-5 py-2 text-sm font-medium text-cream">Filtrar</button></div>
        </form>
        {error && <p role="alert" className="rounded-xl bg-peach-tint px-4 py-3 text-sm text-ink">{error}</p>}
        <p className="text-xs text-ink/55">Sin fechas se muestran los últimos 30 días. Máximo 3 meses por consulta.</p>

        <section className="overflow-x-auto rounded-2xl border border-white/10 bg-card p-5" aria-label="Resumen por instructora">
          <h2 className="text-base font-semibold text-ink">Resumen</h2>
          <table className="mt-3 w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-ink/50"><tr><th className="py-2">Instructora</th><th>Clases</th><th>Alumnas</th><th>Asistieron</th><th>No vinieron</th><th>Sin marcar</th><th>Cancelaciones</th><th>Ocupación</th><th>Asistencia</th></tr></thead>
            <tbody className="divide-y divide-white/10 text-ink">
              {filas.length === 0 && <tr><td colSpan={9} className="py-4 text-ink/55">No hay clases dadas en ese período.</td></tr>}
              {filas.map((r) => (
                <tr key={r.instructora_id ?? "sin"}>
                  <td className="py-2 font-medium">{r.instructora}</td>
                  <td>{r.clases}{r.clases_canceladas > 0 && <span className="text-xs text-ink/50"> (+{r.clases_canceladas} canceladas)</span>}</td>
                  <td>{r.alumnas}</td><td>{r.asistieron}</td><td>{r.no_vinieron}</td>
                  <td className={r.sin_marcar > 0 ? "text-peach" : ""}>{r.sin_marcar}</td><td>{r.cancelaciones}</td>
                  <td>{Number(r.ocupacion_pct)}%</td><td>{r.asistencia_pct === null ? "—" : `${Number(r.asistencia_pct)}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <ClasesView tenantId={membership.tenant_id} clases={clases} instructoras={(instrs.data ?? []) as { id: string; nombre: string }[]} puedeCorregir={esG} retoActual={esG ? (reto.data?.reto_mensual_clases ?? 12) : null} />
      </div>
    </main>
  );
}
