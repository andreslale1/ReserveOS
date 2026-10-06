import Link from "next/link";
import { getOwnerContext } from "@/lib/owner-context";

type D = {
  tareas_vencidas: number; tareas_hoy: number; sin_proxima_accion: number; valor_pipeline: number; oportunidades_abiertas: number;
  seguimientos_vencidos: { id: string; nombre: string; proximo_paso: string; proximo_paso_fecha: string }[];
  activaciones_en_curso: { id: string; nombre: string; faltan: number }[];
  cobros_en_mora: number; estudios_en_mora: number; cobros_por_vencer_7d: number;
  tickets_abiertos: number; tickets_urgentes: number; tickets_sla_vencido: number; incidentes_activos: number;
  estudios_activos: number; estudios_suspendidos: number;
};
const q = (n: number) => `Q${Number(n).toLocaleString("es-GT")}`;

export default async function DireccionPage() {
  const { supabase } = await getOwnerContext();
  const { data, error } = await supabase.rpc("plataforma_direccion");
  if (error) return <main className="mx-auto max-w-3xl px-6 py-16 text-center text-white/60">{error.message}</main>;
  const d = data as D;

  const Card = ({ href, titulo, valor, sub, alerta }: { href: string; titulo: string; valor: string; sub?: string; alerta?: boolean }) => (
    <Link href={href} className="rounded-2xl border border-white/10 bg-void-card p-5 transition hover:border-lime/50">
      <p className="text-xs uppercase tracking-wide text-white/45">{titulo}</p>
      <p className={`mt-1 text-3xl font-semibold ${alerta ? "text-red-300" : "text-white"}`}>{valor}</p>
      {sub && <p className="mt-1 text-xs text-white/45">{sub}</p>}
    </Link>
  );

  return (
    <main className="mx-auto max-w-6xl px-6 py-8 md:px-10">
      <h1 className="text-2xl font-semibold">Dirección</h1>
      <p className="mt-1 text-sm text-white/50">Qué necesita atención hoy. Cada tarjeta lleva al registro que la causa.</p>

      <h2 className="mt-8 text-xs font-medium uppercase tracking-wide text-white/40">Ventas</h2>
      <div className="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card href="/owner/tareas" titulo="Tareas vencidas" valor={String(d.tareas_vencidas)} sub={`${d.tareas_hoy} para hoy`} alerta={d.tareas_vencidas > 0} />
        <Card href="/owner/pipeline" titulo="Oportunidades abiertas" valor={String(d.oportunidades_abiertas)} sub={`${q(d.valor_pipeline)}/mes potenciales`} />
        <Card href="/owner/pipeline" titulo="Sin próxima acción" valor={String(d.sin_proxima_accion)} alerta={d.sin_proxima_accion > 0} />
        <Card href="/owner/activaciones" titulo="Activaciones en curso" valor={String(d.activaciones_en_curso.length)} />
      </div>

      <h2 className="mt-8 text-xs font-medium uppercase tracking-wide text-white/40">Dinero</h2>
      <div className="mt-2 grid gap-4 sm:grid-cols-3">
        <Card href="/owner/cobros" titulo="En mora" valor={q(d.cobros_en_mora)} sub={`${d.estudios_en_mora} estudio(s)`} alerta={d.cobros_en_mora > 0} />
        <Card href="/owner/cobros" titulo="Vencen en 7 días" valor={String(d.cobros_por_vencer_7d)} />
        <Card href="/owner" titulo="Estudios activos" valor={String(d.estudios_activos)} sub={`${d.estudios_suspendidos} suspendido(s)`} />
      </div>

      <h2 className="mt-8 text-xs font-medium uppercase tracking-wide text-white/40">Servicio</h2>
      <div className="mt-2 grid gap-4 sm:grid-cols-3">
        <Card href="/owner/soporte" titulo="Tickets abiertos" valor={String(d.tickets_abiertos)} sub={`${d.tickets_urgentes} urgentes o altos`} alerta={d.tickets_urgentes > 0} />
        <Card href="/owner/soporte" titulo="SLA vencido" valor={String(d.tickets_sla_vencido)} alerta={d.tickets_sla_vencido > 0} />
        <Card href="/owner/soporte" titulo="Incidentes activos" valor={String(d.incidentes_activos)} alerta={d.incidentes_activos > 0} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-void-card p-5">
          <h2 className="text-base font-semibold">Seguimientos vencidos</h2>
          <ul className="mt-3 divide-y divide-white/10">
            {d.seguimientos_vencidos.length === 0 && <li className="py-2 text-sm text-white/50">Todo al día.</li>}
            {d.seguimientos_vencidos.map((s) => (
              <li key={s.id} className="py-2 text-sm"><Link href={`/owner/pipeline/${s.id}`} className="font-medium hover:text-lime">{s.nombre}</Link>
                <span className="block text-xs text-red-300">{s.proximo_paso} · {s.proximo_paso_fecha}</span></li>
            ))}
          </ul>
        </section>
        <section className="rounded-2xl border border-white/10 bg-void-card p-5">
          <h2 className="text-base font-semibold">Activaciones</h2>
          <ul className="mt-3 divide-y divide-white/10">
            {d.activaciones_en_curso.length === 0 && <li className="py-2 text-sm text-white/50">Sin activaciones en curso.</li>}
            {d.activaciones_en_curso.map((a) => (
              <li key={a.id} className="py-2 text-sm"><Link href="/owner/activaciones" className="font-medium hover:text-lime">{a.nombre}</Link>
                <span className="block text-xs text-white/50">{a.faltan} etapas obligatorias pendientes</span></li>
            ))}
          </ul>
        </section>
      </div>
      {d.estudios_activos === 0 && (
        <p className="mt-8 rounded-2xl border border-lime/30 bg-void-card p-5 text-sm text-white/70">Aún no hay estudios activos. Empieza en <Link href="/owner/pipeline" className="text-lime">Pipeline</Link> registrando un prospecto.</p>
      )}
    </main>
  );
}
