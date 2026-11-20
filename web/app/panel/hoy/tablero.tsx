import Link from "next/link";
import { Anillo, BarrasH, Calor, Mini, Tendencia } from "@/components/graficas/graficas";
import { num, quetzales } from "@/components/graficas/formato";

export type Datos = {
  dias: number; desde: string; hasta: string; finanzas: boolean;
  totales: { reservas: number; reservas_prev: number; canceladas: number; asistidas: number; con_asistencia_marcada: number; nuevos: number; nuevos_prev: number };
  por_dia: { fecha: string; reservas: number; canceladas: number }[];
  calor: { dow: number; hora: number; n: number }[];
  clases: { nombre: string; dia: number; hora: string; reservas: number; lugares: number; pct: number }[];
  carriles: { nombre: string; n: number }[];
  semanas: { desde: string; ingreso: number | null; nuevos: number }[];
};

const DIA = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const corto = (iso: string) => { const d = new Date(iso + "T12:00:00"); return `${d.getDate()} ${d.toLocaleDateString("es-GT", { month: "short" }).replace(".", "")}`; };

function Delta({ ahora, antes }: { ahora: number; antes: number }) {
  if (antes === 0) return <span className="text-[12px] text-ink-soft">{ahora > 0 ? "Sin periodo previo para comparar" : "Sin movimiento"}</span>;
  const p = Math.round(((ahora - antes) / antes) * 100);
  return <span className={`text-[12px] font-medium ${p >= 0 ? "text-good" : "text-bad"}`}>{p >= 0 ? "▲" : "▼"} {Math.abs(p)}% <span className="font-normal text-ink-soft">vs. periodo anterior</span></span>;
}

function Tarjeta({ titulo, children, ancho }: { titulo: string; children: React.ReactNode; ancho?: string }) {
  return (
    <section className={`border border-line bg-void-card p-5 ${ancho ?? ""}`}>
      <h3 className="mb-4 text-[10px] font-medium uppercase tracking-[0.12em] text-ink-soft">{titulo}</h3>
      {children}
    </section>
  );
}

export default function Tablero({ datos, dias, sedeId, sedes }: { datos: Datos; dias: number; sedeId: string | null; sedes: { id: string; name: string }[] }) {
  const t = datos.totales;
  const url = (p: { d?: number; sede?: string | null }) => { const u = new URLSearchParams(); u.set("d", String(p.d ?? dias)); const s = p.sede === undefined ? sedeId : p.sede; if (s) u.set("sede", s); return `/panel/hoy?${u.toString()}`; };
  const serie = datos.por_dia.map((x) => ({ etiqueta: corto(x.fecha), valor: x.reservas, extra: x.canceladas }));
  const asistPct = t.con_asistencia_marcada > 0 ? Math.round((t.asistidas / t.con_asistencia_marcada) * 100) : null;
  const ingresoTotal = datos.semanas.reduce((a, s) => a + (s.ingreso ?? 0), 0);
  const semanasIng = datos.semanas.map((s) => ({ etiqueta: corto(s.desde), valor: s.ingreso ?? 0 }));
  const semanasNuevos = datos.semanas.map((s) => ({ etiqueta: corto(s.desde), valor: s.nuevos }));
  const clases = datos.clases.filter((c) => c.reservas > 0).slice(0, 6).map((c) => ({ nombre: c.nombre, detalle: `${DIA[c.dia]} ${c.hora}`, valor: c.pct, texto: `${c.pct}% · ${c.reservas}/${c.lugares}` }));
  const carriles = datos.carriles.map((c) => ({ nombre: c.nombre, valor: c.n }));
  const sinDatos = t.reservas === 0 && t.canceladas === 0 && t.nuevos === 0;

  return (
    <section aria-labelledby="tablero-h" className="mb-9">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <h2 id="tablero-h" className="text-[22px] tracking-[-0.04em]">Cómo va el estudio.</h2>
        <div className="flex flex-wrap items-center gap-2">
          <nav aria-label="Periodo" className="flex border border-line bg-void-card text-[12px]">
            {[30, 60, 90].map((d) => <Link key={d} href={url({ d })} aria-current={d === dias ? "page" : undefined} scroll={false} className={`press-spring px-3 py-1.5 ${d === dias ? "bg-ink text-void" : "text-ink hover:bg-ink/[0.04]"}`}>{d} días</Link>)}
          </nav>
          {sedes.length > 1 && (
            <nav aria-label="Sede" className="flex flex-wrap border border-line bg-void-card text-[12px]">
              <Link href={url({ sede: null })} scroll={false} aria-current={!sedeId ? "page" : undefined} className={`press-spring px-3 py-1.5 ${!sedeId ? "bg-ink text-void" : "text-ink hover:bg-ink/[0.04]"}`}>Todas</Link>
              {sedes.map((s) => <Link key={s.id} href={url({ sede: s.id })} scroll={false} aria-current={sedeId === s.id ? "page" : undefined} className={`press-spring px-3 py-1.5 ${sedeId === s.id ? "bg-ink text-void" : "text-ink hover:bg-ink/[0.04]"}`}>{s.name}</Link>)}
            </nav>
          )}
        </div>
      </div>

      {sinDatos && <p className="mb-4 border border-line bg-void-card px-5 py-4 text-[13px] text-ink-soft">Todavía no hay movimiento en estos {dias} días. Las gráficas se llenan solas con tus reservas y ventas.</p>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tarjeta titulo="Reservas">
          <div className="flex items-end justify-between gap-3"><span className="tabular text-[40px] font-medium leading-none tracking-[-0.05em]">{num(t.reservas)}</span><Mini valores={datos.por_dia.map((x) => x.reservas)} /></div>
          <div className="mt-2"><Delta ahora={t.reservas} antes={t.reservas_prev} /></div>
        </Tarjeta>
        <Tarjeta titulo="Asistencia"><Anillo pct={asistPct} etiqueta={asistPct === null ? "Aún sin asistencia marcada" : `${t.asistidas} de ${t.con_asistencia_marcada} reservas asistidas`} /></Tarjeta>
        <Tarjeta titulo="Clientes nuevos">
          <div className="flex items-end justify-between gap-3"><span className="tabular text-[40px] font-medium leading-none tracking-[-0.05em]">{num(t.nuevos)}</span><Mini valores={datos.semanas.map((s) => s.nuevos)} /></div>
          <div className="mt-2"><Delta ahora={t.nuevos} antes={t.nuevos_prev} /></div>
        </Tarjeta>
        {datos.finanzas ? (
          <Tarjeta titulo="Ingreso neto">
            <div className="flex items-end justify-between gap-3"><span className="tabular text-[34px] font-medium leading-none tracking-[-0.05em]">{quetzales(ingresoTotal)}</span><Mini valores={datos.semanas.map((s) => s.ingreso ?? 0)} /></div>
            <p className="mt-2 text-[12px] text-ink-soft">Después de devoluciones</p>
          </Tarjeta>
        ) : (
          <Tarjeta titulo="Cancelaciones"><span className="tabular text-[40px] font-medium leading-none tracking-[-0.05em]">{num(t.canceladas)}</span><p className="mt-2 text-[12px] text-ink-soft">en {dias} días</p></Tarjeta>
        )}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Tarjeta titulo="Reservas por día" ancho="lg:col-span-2"><Tendencia puntos={serie} nombre="Reservas" nombreExtra="Canceladas" /></Tarjeta>
        <Tarjeta titulo="Clases más llenas"><BarrasH filas={clases} max={100} vacio="Aún no hay reservas por clase." /></Tarjeta>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Tarjeta titulo="Cuándo se llena" ancho="lg:col-span-2"><Calor celdas={datos.calor} /></Tarjeta>
        {carriles.length > 0
          ? <Tarjeta titulo="Uso de carriles"><BarrasH filas={carriles} /></Tarjeta>
          : datos.finanzas
            ? <Tarjeta titulo="Ingreso por semana"><Tendencia puntos={semanasIng} nombre="Ingreso" formato="quetzales" alto={190} /></Tarjeta>
            : <Tarjeta titulo="Clientes nuevos por semana"><Tendencia puntos={semanasNuevos} nombre="Nuevos" alto={190} /></Tarjeta>}
      </div>
      {carriles.length > 0 && datos.finanzas && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Tarjeta titulo="Ingreso por semana"><Tendencia puntos={semanasIng} nombre="Ingreso" formato="quetzales" alto={190} /></Tarjeta>
          <Tarjeta titulo="Clientes nuevos por semana"><Tendencia puntos={semanasNuevos} nombre="Nuevos" alto={190} /></Tarjeta>
        </div>
      )}
    </section>
  );
}
