import Link from "next/link";
import { getOwnerContext } from "@/lib/owner-context";
import { EstadoVacio } from "@/components/owner/estado-vacio";

type D = {
  tareas_vencidas: number; tareas_hoy: number; sin_proxima_accion: number; valor_pipeline: number; oportunidades_abiertas: number;
  seguimientos_vencidos: { id: string; nombre: string; proximo_paso: string; proximo_paso_fecha: string }[];
  activaciones_en_curso: { id: string; nombre: string; faltan: number }[];
  cobros_en_mora: number; estudios_en_mora: number; cobros_por_vencer_7d: number; contratos_por_vencer_60d: number;
  tickets_abiertos: number; tickets_urgentes: number; tickets_sla_vencido: number; incidentes_activos: number;
  estudios_activos: number; estudios_suspendidos: number;
};
type Accion = { tipo: string; titulo: string; detalle: string; href: string; vence: string | null; responsable: string };
type Extra = { hoy: string; acciones: Accion[]; comparativa: Record<"oportunidades_nuevas" | "ganadas" | "cobrado" | "tickets_nuevos", [number, number]> };
const q = (n: number) => `Q${Number(n).toLocaleString("es-GT")}`;
const fecha = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "sin fecha");

export default async function DireccionPage() {
  const { supabase } = await getOwnerContext();
  const [{ data, error }, { data: extraData }] = await Promise.all([supabase.rpc("plataforma_direccion"), supabase.rpc("owner_direccion_extra")]);
  if (error) return <main className="mx-auto max-w-3xl px-6 py-16 text-center text-white/70" role="alert">{error.message}</main>;
  const raw = data as Record<string, unknown>;
  const d = { seguimientos_vencidos: [], activaciones_en_curso: [], ...raw } as unknown as D;
  // Cada rol recibe del servidor solo su parte (ventas: pipeline; finanzas: dinero; soporte e implementación: servicio): se muestra solo lo que llega.
  const has = (k: keyof D) => raw[k] !== undefined;
  const extra = (extraData ?? null) as Extra | null;

  const Card = ({ href, titulo, valor, sub, def, alerta }: { href: string; titulo: string; valor: string; sub?: string; def: string; alerta?: boolean }) => (
    <Link href={href} className="rounded-2xl border border-white/15 bg-void-card p-5 outline-none transition hover:border-lime/60 focus-visible:ring-2 focus-visible:ring-lime/70">
      <p className="text-xs font-medium text-white/70">{titulo}</p>
      <p className={`mt-2 text-3xl font-semibold ${alerta ? "text-red-300" : "text-white"}`}>{valor}</p>
      {sub && <p className="mt-1 text-xs text-white/70">{sub}</p>}
      <p className="mt-3 border-t border-white/10 pt-2 text-[11px] leading-snug text-white/55">{def}</p>
    </Link>
  );
  const Comp = ({ titulo, par, dinero }: { titulo: string; par: [number, number]; dinero?: boolean }) => {
    const [a, b] = par;
    const dif = b === 0 ? null : Math.round(((a - b) / b) * 100);
    const f = (n: number) => (dinero ? q(n) : String(n));
    return (
      <div className="rounded-2xl border border-white/15 bg-void-card p-4">
        <p className="text-xs font-medium text-white/70">{titulo}</p>
        <p className="mt-1 text-2xl font-semibold">{f(a)}</p>
        <p className="text-xs text-white/65">Mes anterior: {f(b)}{dif !== null && <span className={dif >= 0 ? "text-lime" : "text-red-300"}> · {dif >= 0 ? "▲" : "▼"} {Math.abs(dif)}%</span>}</p>
      </div>
    );
  };

  return (
    <main className="mx-auto max-w-6xl px-6 py-8 md:px-10">
      <h1 className="text-2xl font-semibold">Dirección</h1>
      <p className="mt-1 text-sm text-white/70">Qué necesita atención hoy{extra ? ` (${fecha(extra.hoy)}, hora de Guatemala)` : ""}. Cada tarjeta abre la lista que la causa, con la misma definición.</p>

      <section aria-labelledby="accion" className="mt-6 rounded-2xl border border-lime/30 bg-void-card p-5">
        <h2 id="accion" className="text-base font-semibold">Requiere mi acción {extra && extra.acciones.length > 0 && <span className="text-sm font-normal text-white/65">· {extra.acciones.length}</span>}</h2>
        {!extra || extra.acciones.length === 0 ? (
          <div className="mt-3"><EstadoVacio titulo="Nada urgente por resolver" texto="No hay propuestas sin seguimiento, activaciones detenidas, cobros vencidos, incidentes críticos ni dominios pendientes." href="/owner/pipeline" accion="Registrar un prospecto" /></div>
        ) : (
          <ul className="mt-3 divide-y divide-white/10">
            {extra.acciones.map((a, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-orange-300">{a.tipo}</p>
                  <p className="font-medium">{a.titulo}</p>
                  <p className="text-xs text-white/65">{a.detalle} · Responsable: {a.responsable} · Vence: {fecha(a.vence)}</p>
                </div>
                <Link href={a.href} className="rounded-full bg-lime px-3 py-1.5 text-xs font-semibold text-void focus-visible:ring-2 focus-visible:ring-white">Abrir</Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {extra && (
        <>
          <h2 className="mt-8 text-xs font-semibold uppercase tracking-wide text-white/60">Este mes frente al mes anterior</h2>
          <div className="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {extra.comparativa.oportunidades_nuevas && <Comp titulo="Oportunidades nuevas" par={extra.comparativa.oportunidades_nuevas} />}
            {extra.comparativa.ganadas && <Comp titulo="Oportunidades ganadas" par={extra.comparativa.ganadas} />}
            {extra.comparativa.cobrado && <Comp titulo="Cobrado a estudios" par={extra.comparativa.cobrado} dinero />}
            {extra.comparativa.tickets_nuevos && <Comp titulo="Tickets nuevos" par={extra.comparativa.tickets_nuevos} />}
          </div>
          <p className="mt-2 text-[11px] text-white/55">Mes calendario en hora de Guatemala. «Ganadas» cuenta oportunidades en etapa ganado cuya última modificación cayó en el mes. «Cobrado» suma pagos por fecha de pago.</p>
        </>
      )}

      {(has("oportunidades_abiertas") || has("tareas_vencidas")) && (
      <>
      <h2 className="mt-8 text-xs font-semibold uppercase tracking-wide text-white/60">Ventas</h2>
      <div className="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {has("tareas_vencidas") && <Card href="/owner/tareas?filtro=vencidas" titulo="Tareas vencidas" valor={String(d.tareas_vencidas)} sub={`${d.tareas_hoy} para hoy`} def="Tareas pendientes con fecha anterior a hoy." alerta={d.tareas_vencidas > 0} />}
        {has("oportunidades_abiertas") && <Card href="/owner/pipeline" titulo="Oportunidades abiertas" valor={String(d.oportunidades_abiertas)} sub={`${q(d.valor_pipeline)} / mes potenciales`} def="Oportunidades que no están ganadas ni perdidas. Valor = suma de la mensualidad estimada." />}
        {has("sin_proxima_accion") && <Card href="/owner/pipeline?filtro=sin-accion" titulo="Sin próxima acción" valor={String(d.sin_proxima_accion)} def="Oportunidades abiertas sin próximo paso escrito." alerta={d.sin_proxima_accion > 0} />}
        {has("activaciones_en_curso") && <Card href="/owner/activaciones" titulo="Activaciones en curso" valor={String(d.activaciones_en_curso.length)} def="Proyectos de alta de estudio que aún no están en vivo (se muestran hasta 6)." />}
      </div>
      </>
      )}

      {(has("cobros_en_mora") || has("contratos_por_vencer_60d") || has("estudios_activos")) && (
      <>
      <h2 className="mt-8 text-xs font-semibold uppercase tracking-wide text-white/60">Dinero</h2>
      <div className="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {has("contratos_por_vencer_60d") && <Card href="/owner/contratos?filtro=por-vencer" titulo="Contratos por vencer" valor={String(d.contratos_por_vencer_60d)} sub="en los próximos 60 días" def="Contratos vigentes cuya fecha de fin (firma + vigencia) cae en 60 días." alerta={d.contratos_por_vencer_60d > 0} />}
        {has("cobros_en_mora") && <Card href="/owner/cobros?filtro=mora" titulo="En mora" valor={q(d.cobros_en_mora)} sub={`${d.estudios_en_mora} estudio(s)`} def="Saldo de cobros pendientes o parciales con vencimiento anterior a hoy." alerta={d.cobros_en_mora > 0} />}
        {has("cobros_por_vencer_7d") && <Card href="/owner/cobros?filtro=por-vencer" titulo="Vencen en 7 días" valor={String(d.cobros_por_vencer_7d)} def="Cobros pendientes o parciales que vencen de hoy a 7 días." />}
        {has("estudios_activos") && <Card href="/owner" titulo="Estudios activos" valor={String(d.estudios_activos)} sub={`${d.estudios_suspendidos} no activo(s)`} def="Estudios con estado activo. Incluye estudios de prueba mientras no exista la marca interno/demo." />}
      </div>
      </>
      )}

      {(has("tickets_abiertos")) && (
      <>
      <h2 className="mt-8 text-xs font-semibold uppercase tracking-wide text-white/60">Servicio</h2>
      <div className="mt-2 grid gap-4 sm:grid-cols-3">
        {has("tickets_abiertos") && <Card href="/owner/soporte?filtro=abiertos" titulo="Tickets abiertos" valor={String(d.tickets_abiertos)} sub={`${d.tickets_urgentes} urgentes o altos`} def="Tickets en estado abierto o en curso." alerta={d.tickets_urgentes > 0} />}
        {has("tickets_sla_vencido") && <Card href="/owner/soporte?filtro=sla" titulo="SLA vencido" valor={String(d.tickets_sla_vencido)} def="Tickets abiertos cuyo plazo de primera respuesta ya pasó." alerta={d.tickets_sla_vencido > 0} />}
        {has("incidentes_activos") && <Card href="/owner/soporte?filtro=incidentes" titulo="Incidentes activos" valor={String(d.incidentes_activos)} def="Incidentes que no están resueltos." alerta={d.incidentes_activos > 0} />}
      </div>
      </>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {has("seguimientos_vencidos") && <section className="rounded-2xl border border-white/15 bg-void-card p-5">
          <h2 className="text-base font-semibold">Seguimientos vencidos</h2>
          {d.seguimientos_vencidos.length === 0 ? <div className="mt-3"><EstadoVacio titulo="Todo al día" texto="Ninguna oportunidad tiene un próximo paso atrasado." /></div> : (
            <ul className="mt-3 divide-y divide-white/10">
              {d.seguimientos_vencidos.map((s) => (
                <li key={s.id} className="py-2 text-sm"><Link href={`/owner/pipeline/${s.id}`} className="font-medium hover:text-lime">{s.nombre}</Link>
                  <span className="block text-xs text-red-300">{s.proximo_paso} · {fecha(s.proximo_paso_fecha)}</span></li>
              ))}
            </ul>
          )}
        </section>}
        {has("activaciones_en_curso") && <section className="rounded-2xl border border-white/15 bg-void-card p-5">
          <h2 className="text-base font-semibold">Activaciones</h2>
          {d.activaciones_en_curso.length === 0 ? <div className="mt-3"><EstadoVacio titulo="Sin activaciones en curso" texto="Se crean al cerrar una oportunidad." href="/owner/pipeline" accion="Ir a Pipeline" /></div> : (
            <ul className="mt-3 divide-y divide-white/10">
              {d.activaciones_en_curso.map((a) => (
                <li key={a.id} className="py-2 text-sm"><Link href="/owner/activaciones" className="font-medium hover:text-lime">{a.nombre}</Link>
                  <span className="block text-xs text-white/65">{a.faltan} etapas obligatorias pendientes</span></li>
              ))}
            </ul>
          )}
        </section>}
      </div>
      {has("estudios_activos") && d.estudios_activos === 0 && (
        <div className="mt-8"><EstadoVacio titulo="Aún no hay estudios activos" texto="Empieza registrando un prospecto y llévalo hasta el contrato." href="/owner/pipeline" accion="Ir a Pipeline" /></div>
      )}
    </main>
  );
}
