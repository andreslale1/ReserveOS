import { BarrasH, Mini, Tendencia } from "@/components/graficas/graficas";
import { num, quetzales } from "@/components/graficas/formato";

export type Tend = {
  finanzas: boolean; ventas: boolean; mrr: number | null;
  cobros: { mes: string; cobrado: number; por_cobrar: number }[] | null;
  estudios: { mes: string; nuevos: number; activos: number }[];
  pipeline: { etapa: string; n: number; valor: number }[] | null;
  actividad: { desde: string; reservas: number }[];
};
const MES = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("es-GT", { month: "short" }).replace(".", "");
const SEM = (iso: string) => { const d = new Date(iso + "T12:00:00"); return `${d.getDate()} ${d.toLocaleDateString("es-GT", { month: "short" }).replace(".", "")}`; };
const ETAPA: Record<string, string> = { prospecto: "Prospecto", demo: "Demo", propuesta: "Propuesta", negociacion: "Negociación", ganado: "Ganado", perdido: "Perdido" };
const ORDEN = ["prospecto", "demo", "propuesta", "negociacion", "ganado", "perdido"];

function Tarjeta({ titulo, children, ancho }: { titulo: string; children: React.ReactNode; ancho?: string }) {
  return <section className={`border border-ink/15 bg-void-card p-5 ${ancho ?? ""}`}><h3 className="mb-4 text-[10px] font-medium uppercase tracking-[0.12em] text-ink/60">{titulo}</h3>{children}</section>;
}

export default function Tendencias({ t }: { t: Tend }) {
  const estudios = [...t.estudios].reverse().map((e) => ({ etiqueta: MES(e.mes), valor: e.nuevos, extra: e.activos }));
  const actividad = t.actividad.slice().reverse().map((a) => ({ etiqueta: SEM(a.desde), valor: a.reservas }));
  const cobros = t.cobros ? [...t.cobros].reverse().map((c) => ({ etiqueta: MES(c.mes), valor: Number(c.cobrado), extra: Number(c.por_cobrar) })) : null;
  const pipe = t.pipeline ? ORDEN.map((e) => t.pipeline!.find((p) => p.etapa === e)).filter(Boolean).map((p) => ({ nombre: ETAPA[p!.etapa] ?? p!.etapa, valor: p!.n, texto: `${p!.n} · ${quetzales(Number(p!.valor))}/mes` })) : null;
  const ultimoActivos = t.estudios.at(0)?.activos ?? 0;
  return (
    <section aria-labelledby="tend-h" className="mt-8">
      <h2 id="tend-h" className="mb-4 text-lg font-semibold">Tendencias</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {t.mrr !== null && (
          <Tarjeta titulo="Ingreso mensual recurrente">
            <div className="flex items-end justify-between gap-3"><span className="tabular text-[32px] font-medium leading-none tracking-[-0.04em]">{quetzales(t.mrr)}</span>{cobros && <Mini valores={[...cobros].map((c) => c.valor)} />}</div>
            <p className="mt-2 text-[12px] text-ink/65">Suscripciones activas</p>
          </Tarjeta>
        )}
        <Tarjeta titulo="Estudios activos"><div className="flex items-end justify-between gap-3"><span className="tabular text-[32px] font-medium leading-none tracking-[-0.04em]">{num(ultimoActivos)}</span><Mini valores={[...t.estudios].reverse().map((e) => e.activos)} /></div><p className="mt-2 text-[12px] text-ink/65">Clientes de ReserveOS</p></Tarjeta>
        <Tarjeta titulo="Reservas en la plataforma"><div className="flex items-end justify-between gap-3"><span className="tabular text-[32px] font-medium leading-none tracking-[-0.04em]">{num(t.actividad.reduce((a, x) => a + x.reservas, 0))}</span><Mini valores={actividad.map((a) => a.valor)} /></div><p className="mt-2 text-[12px] text-ink/65">Últimas 8 semanas</p></Tarjeta>
        {pipe && <Tarjeta titulo="Pipeline"><span className="tabular text-[32px] font-medium leading-none tracking-[-0.04em]">{num(t.pipeline!.filter((p) => !["ganado", "perdido"].includes(p.etapa)).reduce((a, p) => a + p.n, 0))}</span><p className="mt-2 text-[12px] text-ink/65">Oportunidades abiertas</p></Tarjeta>}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {cobros && <Tarjeta titulo="Cobros por mes" ancho="lg:col-span-2"><Tendencia puntos={cobros} nombre="Cobrado" nombreExtra="Por cobrar" formato="quetzales" /></Tarjeta>}
        {pipe && <Tarjeta titulo="Pipeline por etapa"><BarrasH filas={pipe} vacio="Aún no hay oportunidades." /></Tarjeta>}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Tarjeta titulo="Estudios nuevos y activos por mes"><Tendencia puntos={estudios} nombre="Nuevos" nombreExtra="Activos" alto={190} /></Tarjeta>
        <Tarjeta titulo="Reservas por semana"><Tendencia puntos={actividad} nombre="Reservas" alto={190} /></Tarjeta>
      </div>
    </section>
  );
}
