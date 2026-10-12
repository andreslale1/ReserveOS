import Link from "next/link";
import { formatoFecha } from "@/lib/fechas";
import { GastoMarketingForm, MetasForm } from "./negocio-forms";

export type Tab = "mando" | "clientas" | "operacion" | "finanzas" | "metas" | "retencion" | "adquisicion";

type Meta = { tipo: string; meta: number | null; real: number; proyeccion: number; avance_pct: number | null; proyeccion_pct: number | null };
type CM = {
  rol: string; mes: string; hoy: string;
  finanzas: { paquetes: number; tienda: number; otros: number; bruto: number; devoluciones: number; neto: number; gastos: number; utilidad: number };
  alertas?: { leads_sin_contactar: number; cuentas_sin_acceso: number; consentimientos_pendientes: number; paquetes_por_vencer: number };
  clientas?: { total: number; nuevas_30d: number; con_paquete_activo: number; sin_paquete: number };
  operacion?: { ocupacion_pct: number | null; clases: number; reservas: number; cupo: number; horarios: { nombre_clase: string; dia_semana: number; hora_inicio: string; sede: string; ocupacion_pct: number | null }[] };
  metas?: { mes: string; dias_mes: number; dias_transcurridos: number; metas: Meta[] };
  retencion?: { churn_pct: number | null; membresias_evaluadas: number; en_riesgo: number; retencion_acumulada_pct: number | null; riesgo_fuga: number };
  adquisicion?: { canal: string; gasto_total: number; clientas_nuevas: number; cac: number | null; ltv_promedio: number | null; ltv_cac_ratio: number | null }[];
  encuestas?: { respuestas: number; satisfaccion_prom: number | null; recomendaria_pct: number | null; comentarios: { fecha: string; satisfaccion: number; comentario: string }[] };
};
type Riesgo = { cliente_id: string; nombre: string; telefono: string | null; email: string | null; ultima_visita: string | null; dias_sin_venir: number; membresia_vence: string; clases_restantes: number | null; sede: string | null };
type Serie = { mes: string; bruto: number; devoluciones: number; neto: number; gastos: number };
type ResumenFin = { ingresos: number; gastos_totales: number; margen_operativo: number; margen_operativo_pct: number | null; ocupacion_pct: number | null; punto_equilibrio_q: number | null; punto_equilibrio_clases: number | null; roi?: number | null; roi_pct?: number | null } | null;

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const q = (n: number | null | undefined) => (n === null || n === undefined ? "—" : `Q${Number(n).toLocaleString("es-GT", { maximumFractionDigits: 2 })}`);
const pct = (n: number | null | undefined) => (n === null || n === undefined ? "—" : `${Number(n).toLocaleString("es-GT", { maximumFractionDigits: 1 })}%`);
const mesLegible = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("es-GT", { month: "long", year: "numeric" });

function Tarjeta({ titulo, valor, sub, alerta }: { titulo: string; valor: string; sub?: string; alerta?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-card p-5">
      <p className="text-xs uppercase tracking-wide text-ink-soft">{titulo}</p>
      <p className={`mt-2 text-2xl font-bold ${alerta ? "text-ink underline decoration-wavy decoration-peach" : "text-ink"}`}>{valor}</p>
      {sub && <p className="mt-1 text-xs text-ink-soft">{sub}</p>}
    </div>
  );
}
const Seccion = ({ titulo, children }: { titulo: string; children: React.ReactNode }) => (
  <section className="mt-8"><h2 className="text-sm font-medium uppercase tracking-wide text-ink-soft">{titulo}</h2><div className="mt-3">{children}</div></section>
);
const Vacio = ({ texto }: { texto: string }) => <div className="rounded-2xl border border-dashed border-white/15 bg-card p-8 text-center text-sm text-ink-soft">{texto}</div>;

export default function NegocioView({ tab, rol, tenantId, sedeId, sedes, cm, clientas, serie, riesgo, ranking, actividad, resumenFin }: {
  tab: Tab; rol: string; tenantId: string; sedeId: string | null; sedes: { id: string; name: string }[]; cm: CM;
  clientas: { total: number; recurrentes: number; nuevas: number; tasa_referidos_pct: number | null; antiguedad_promedio_dias: number } | null;
  serie: Serie[]; riesgo: Riesgo[];
  ranking: { instructor_membership_id: string; nombre: string; total_clases: number; ocupacion_promedio: number | null; pct_asistencia: number | null }[];
  actividad: { id: string; actor_nombre: string | null; tabla: string; operacion: string; created_at: string }[];
  resumenFin: ResumenFin;
}) {
  const esG = rol === "duena" || rol === "gerente_general";
  const conta = rol === "contadora";
  const pestañas: { id: Tab; label: string; visible: boolean }[] = [
    { id: "mando", label: "Centro de mando", visible: !conta },
    { id: "clientas", label: "Clientas", visible: !conta },
    { id: "operacion", label: "Operación", visible: !conta },
    { id: "finanzas", label: "Finanzas", visible: true },
    { id: "metas", label: "Metas", visible: esG },
    { id: "retencion", label: "Retención", visible: !conta },
    { id: "adquisicion", label: "Adquisición", visible: esG },
  ];
  const href = (t: Tab, s: string | null = sedeId) => `/panel/negocio?tab=${t}${s ? `&sede=${s}` : ""}`;
  const maxNeto = Math.max(1, ...serie.map((s) => Number(s.bruto)));
  const al = cm.alertas;

  return (
    <main className="min-h-screen bg-cream">
      <header className="border-b border-white/10 bg-card px-6 py-6 md:px-10">
        <h1 className="text-2xl font-semibold text-ink md:text-3xl">Negocio</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {esG ? "Visión estratégica del estudio." : conta ? "Resumen financiero agregado, sin datos de clientas." : "Tus sedes."} · {mesLegible(cm.mes)} · hoy {formatoFecha(cm.hoy)} (hora de Guatemala)
        </p>
        {sedes.length > 1 && !conta && (
          <form method="get" className="mt-3 flex items-center gap-2">
            <input type="hidden" name="tab" value={tab} />
            <label htmlFor="sede" className="text-sm text-ink-soft">Sede</label>
            <select id="sede" name="sede" defaultValue={sedeId ?? ""} className="rounded-lg border border-white/15 bg-cream px-3 py-1.5 text-sm text-ink">
              <option value="">{esG ? "Todas las sedes" : "Todas mis sedes"}</option>
              {sedes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <button className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-ink hover:bg-white/5">Ver</button>
          </form>
        )}
        <nav aria-label="Secciones de Negocio" className="mt-4 flex flex-wrap gap-2">
          {pestañas.filter((p) => p.visible).map((p) => (
            <Link key={p.id} href={href(p.id)} aria-current={tab === p.id ? "page" : undefined}
              className={`rounded-full px-4 py-1.5 text-sm ${tab === p.id ? "bg-ink text-cream" : "border border-white/15 text-ink hover:bg-white/5"}`}>
              {p.label}
            </Link>
          ))}
        </nav>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8 md:px-10">
        {tab === "mando" && (
          <>
            <Seccion titulo="Alertas">
              {al && (
                <div className="grid gap-4 sm:grid-cols-4">
                  <Tarjeta titulo="Leads sin contactar" valor={String(al.leads_sin_contactar)} sub="Hicieron clase de prueba y no compraron" alerta={al.leads_sin_contactar > 0} />
                  <Tarjeta titulo="Cuentas sin acceso" valor={String(al.cuentas_sin_acceso)} sub="Aún no crean su contraseña" alerta={al.cuentas_sin_acceso > 0} />
                  <Tarjeta titulo="Consentimientos pendientes" valor={String(al.consentimientos_pendientes)} sub="Sin formulario firmado" alerta={al.consentimientos_pendientes > 0} />
                  <Tarjeta titulo="Paquetes por vencer" valor={String(al.paquetes_por_vencer)} sub="En los próximos 7 días" alerta={al.paquetes_por_vencer > 0} />
                </div>
              )}
              <p className="mt-3 text-sm text-ink-soft">
                <Link className="underline" href="/panel/clientes">Ver clientas</Link> · <Link className="underline" href={href("retencion")}>Lista para contactar</Link>
              </p>
            </Seccion>
            <Seccion titulo={`Este mes (${mesLegible(cm.mes)})`}>
              <div className="grid gap-4 sm:grid-cols-4">
                <Tarjeta titulo="Ingreso confirmado" valor={q(cm.finanzas.neto)} sub={`Cobros ${q(cm.finanzas.bruto)} − devoluciones ${q(cm.finanzas.devoluciones)}`} />
                <Tarjeta titulo="Gastos operativos" valor={q(cm.finanzas.gastos)} />
                <Tarjeta titulo="Utilidad" valor={q(cm.finanzas.utilidad)} />
                {cm.operacion && <Tarjeta titulo="Ocupación (30 días)" valor={pct(cm.operacion.ocupacion_pct)} sub={`${cm.operacion.reservas} de ${cm.operacion.cupo} lugares`} />}
              </div>
            </Seccion>
            {cm.encuestas && (
              <Seccion titulo="Satisfacción (últimos 90 días)">
                {cm.encuestas.respuestas === 0 ? <Vacio texto="Todavía no hay respuestas de encuestas." /> : (
                  <div className="rounded-2xl border border-white/10 bg-card p-5">
                    <p className="text-sm text-ink">{cm.encuestas.respuestas} respuestas · satisfacción {cm.encuestas.satisfaccion_prom ?? "—"} de 5 · {pct(cm.encuestas.recomendaria_pct)} la recomendaría</p>
                    <ul className="mt-3 space-y-2">
                      {cm.encuestas.comentarios.map((c, i) => <li key={i} className="text-sm text-ink-soft">{formatoFecha(c.fecha)} · {c.satisfaccion}/5 — «{c.comentario}»</li>)}
                    </ul>
                  </div>
                )}
              </Seccion>
            )}
            {esG && actividad.length > 0 && (
              <Seccion titulo="Actividad reciente del personal">
                <ul className="divide-y divide-white/10 rounded-2xl border border-white/10 bg-card px-5">
                  {actividad.map((a) => <li key={a.id} className="py-2 text-sm text-ink"><span className="font-medium">{a.actor_nombre ?? "Sistema"}</span> · {a.operacion} en {a.tabla} · <span className="text-ink-soft">{new Date(a.created_at).toLocaleString("es-GT", { timeZone: "America/Guatemala" })}</span></li>)}
                </ul>
              </Seccion>
            )}
          </>
        )}

        {tab === "clientas" && cm.clientas && (
          <Seccion titulo="Clientas">
            <div className="grid gap-4 sm:grid-cols-4">
              <Tarjeta titulo="Clientas" valor={String(cm.clientas.total)} />
              <Tarjeta titulo="Nuevas (30 días)" valor={String(cm.clientas.nuevas_30d)} />
              <Tarjeta titulo="Con paquete activo" valor={String(cm.clientas.con_paquete_activo)} />
              <Tarjeta titulo="Sin paquete" valor={String(cm.clientas.sin_paquete)} />
            </div>
            {clientas && (
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <Tarjeta titulo="Recurrentes" valor={String(clientas.recurrentes)} sub="Compraron 2 o más paquetes" />
                <Tarjeta titulo="Vienen por referida" valor={pct(clientas.tasa_referidos_pct)} />
                <Tarjeta titulo="Antigüedad promedio" valor={`${clientas.antiguedad_promedio_dias} días`} />
              </div>
            )}
          </Seccion>
        )}

        {tab === "operacion" && cm.operacion && (
          <>
            <Seccion titulo="Ocupación de los últimos 30 días">
              <div className="grid gap-4 sm:grid-cols-3">
                <Tarjeta titulo="Ocupación" valor={pct(cm.operacion.ocupacion_pct)} />
                <Tarjeta titulo="Clases dadas" valor={String(cm.operacion.clases)} />
                <Tarjeta titulo="Reservas" valor={String(cm.operacion.reservas)} sub={`de ${cm.operacion.cupo} lugares`} />
              </div>
            </Seccion>
            <Seccion titulo="Horarios, de más a menos llenos">
              {cm.operacion.horarios.length === 0 ? <Vacio texto="Aún no hay clases con reservas en este período." /> : (
                <div className="overflow-x-auto rounded-2xl border border-white/10 bg-card">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase text-ink-soft"><tr><th className="px-4 py-3">Clase</th><th className="px-4 py-3">Día</th><th className="px-4 py-3">Hora</th><th className="px-4 py-3">Sede</th><th className="px-4 py-3 text-right">Ocupación</th></tr></thead>
                    <tbody className="divide-y divide-white/10">
                      {cm.operacion.horarios.map((h, i) => <tr key={i}><td className="px-4 py-2 text-ink">{h.nombre_clase}</td><td className="px-4 py-2">{DIAS[h.dia_semana]}</td><td className="px-4 py-2">{h.hora_inicio.slice(0, 5)}</td><td className="px-4 py-2">{h.sede}</td><td className="px-4 py-2 text-right">{pct(h.ocupacion_pct)}</td></tr>)}
                    </tbody>
                  </table>
                </div>
              )}
            </Seccion>
            {esG && ranking.length > 0 && (
              <Seccion titulo="Instructoras">
                <div className="overflow-x-auto rounded-2xl border border-white/10 bg-card">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase text-ink-soft"><tr><th className="px-4 py-3">Instructora</th><th className="px-4 py-3 text-right">Clases</th><th className="px-4 py-3 text-right">Ocupación</th><th className="px-4 py-3 text-right">Asistencia</th></tr></thead>
                    <tbody className="divide-y divide-white/10">
                      {ranking.map((r) => <tr key={r.instructor_membership_id}><td className="px-4 py-2 text-ink">{r.nombre}</td><td className="px-4 py-2 text-right">{r.total_clases}</td><td className="px-4 py-2 text-right">{pct(r.ocupacion_promedio)}</td><td className="px-4 py-2 text-right">{pct(r.pct_asistencia)}</td></tr>)}
                    </tbody>
                  </table>
                </div>
              </Seccion>
            )}
          </>
        )}

        {tab === "finanzas" && (
          <>
            <Seccion titulo="Una sola cifra de ingreso">
              <p className="mb-3 text-xs text-ink-soft">Ingreso confirmado = cobros confirmados (paquetes, tienda y cobros personalizados) menos devoluciones. Es la misma regla en Finanzas, IVA, balance, reportes y exportaciones.</p>
              <div className="grid gap-4 sm:grid-cols-4">
                <Tarjeta titulo="Ingreso confirmado del mes" valor={q(cm.finanzas.neto)} />
                <Tarjeta titulo="Devoluciones" valor={q(cm.finanzas.devoluciones)} />
                <Tarjeta titulo="Gastos operativos" valor={q(cm.finanzas.gastos)} />
                <Tarjeta titulo="Utilidad" valor={q(cm.finanzas.utilidad)} />
              </div>
            </Seccion>
            {resumenFin && (
              <Seccion titulo="Resumen del mes">
                <div className="grid gap-4 sm:grid-cols-4">
                  <Tarjeta titulo="Margen operativo" valor={q(resumenFin.margen_operativo)} sub={pct(resumenFin.margen_operativo_pct === null ? null : resumenFin.margen_operativo_pct * 100)} />
                  <Tarjeta titulo="Ocupación" valor={pct(resumenFin.ocupacion_pct)} />
                  <Tarjeta titulo="Punto de equilibrio" valor={q(resumenFin.punto_equilibrio_q)} sub={resumenFin.punto_equilibrio_clases ? `${Math.ceil(Number(resumenFin.punto_equilibrio_clases))} clases` : undefined} />
                  <Tarjeta titulo="Detalle" valor="Finanzas →" sub="IVA, balance y cuentas" />
                </div>
                <p className="mt-3 text-sm"><Link className="underline text-ink" href="/panel/finanzas">Ir a Finanzas: IVA, balance, cuentas por cobrar y por pagar, gastos</Link></p>
              </Seccion>
            )}
            <Seccion titulo="Últimos 6 meses">
              {serie.length === 0 ? <Vacio texto="Sin datos todavía." /> : (
                <div className="overflow-x-auto rounded-2xl border border-white/10 bg-card">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase text-ink-soft"><tr><th className="px-4 py-3">Mes</th><th className="px-4 py-3 text-right">Cobrado</th><th className="px-4 py-3 text-right">Devoluciones</th><th className="px-4 py-3 text-right">Ingreso confirmado</th><th className="px-4 py-3 text-right">Gastos</th><th className="px-4 py-3" aria-hidden /></tr></thead>
                    <tbody className="divide-y divide-white/10">
                      {serie.map((s) => (
                        <tr key={s.mes}>
                          <td className="px-4 py-2 capitalize text-ink">{mesLegible(s.mes)}</td>
                          <td className="px-4 py-2 text-right">{q(s.bruto)}</td><td className="px-4 py-2 text-right">{q(s.devoluciones)}</td>
                          <td className="px-4 py-2 text-right font-medium text-ink">{q(s.neto)}</td><td className="px-4 py-2 text-right">{q(s.gastos)}</td>
                          <td className="w-32 px-4 py-2" aria-hidden><div className="h-2 rounded bg-lime" style={{ width: `${Math.round((Number(s.bruto) / maxNeto) * 100)}%` }} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Seccion>
          </>
        )}

        {tab === "metas" && esG && cm.metas && (
          <>
            <Seccion titulo={`Avance de ${mesLegible(cm.metas.mes)} (día ${cm.metas.dias_transcurridos} de ${cm.metas.dias_mes})`}>
              <div className="grid gap-4 sm:grid-cols-2">
                {cm.metas.metas.map((m) => (
                  <div key={m.tipo} className="rounded-2xl border border-white/10 bg-card p-5">
                    <p className="text-xs uppercase tracking-wide text-ink-soft">{{ ingresos: "Ingresos", reservas: "Reservas", clientas_nuevas: "Clientas nuevas", clientas_con_paquete: "Clientas con paquete" }[m.tipo]}</p>
                    <p className="mt-2 text-2xl font-bold text-ink">{m.tipo === "ingresos" ? q(m.real) : m.real}{m.meta !== null && <span className="text-base font-normal text-ink-soft"> de {m.tipo === "ingresos" ? q(m.meta) : m.meta}</span>}</p>
                    {m.meta !== null && m.meta > 0 ? (
                      <>
                        <div className="mt-3 h-2 overflow-hidden rounded bg-white/10" role="progressbar" aria-valuenow={Math.min(100, Number(m.avance_pct ?? 0))} aria-valuemin={0} aria-valuemax={100} aria-label="Avance de la meta">
                          <div className="h-full bg-lime" style={{ width: `${Math.min(100, Number(m.avance_pct ?? 0))}%` }} />
                        </div>
                        <p className="mt-2 text-xs text-ink-soft">Avance {pct(m.avance_pct)} · al ritmo actual cierra en {m.tipo === "ingresos" ? q(m.proyeccion) : m.proyeccion} ({pct(m.proyeccion_pct)} de la meta)</p>
                      </>
                    ) : <p className="mt-2 text-xs text-ink-soft">Sin meta definida.</p>}
                  </div>
                ))}
              </div>
            </Seccion>
            <Seccion titulo="Definir metas"><MetasForm tenantId={tenantId} mes={cm.metas.mes} metas={cm.metas.metas.map((m) => ({ tipo: m.tipo, meta: m.meta }))} /></Seccion>
          </>
        )}

        {tab === "retencion" && (
          <>
            {cm.retencion && (
              <Seccion titulo="Retención">
                <div className="grid gap-4 sm:grid-cols-4">
                  <Tarjeta titulo="Churn (30-60 días)" valor={pct(cm.retencion.churn_pct)} sub={`${cm.retencion.membresias_evaluadas} paquetes evaluados`} />
                  <Tarjeta titulo="Retención acumulada" valor={pct(cm.retencion.retencion_acumulada_pct)} sub="Clientas con 2 o más paquetes" />
                  <Tarjeta titulo="Sin reservar en 14 días" valor={String(cm.retencion.en_riesgo)} />
                  <Tarjeta titulo="Riesgo de fuga" valor={String(cm.retencion.riesgo_fuga)} sub="14 días o más sin venir" alerta={cm.retencion.riesgo_fuga > 0} />
                </div>
              </Seccion>
            )}
            <Seccion titulo="Clientas para contactar (14 días o más sin venir, con paquete vigente)">
              {riesgo.length === 0 ? <Vacio texto="Nadie en riesgo de fuga ahora mismo." /> : (
                <div className="overflow-x-auto rounded-2xl border border-white/10 bg-card">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase text-ink-soft"><tr><th className="px-4 py-3">Clienta</th><th className="px-4 py-3">Última visita</th><th className="px-4 py-3 text-right">Días sin venir</th><th className="px-4 py-3">Paquete vence</th><th className="px-4 py-3 text-right">Clases</th><th className="px-4 py-3">Contactar</th></tr></thead>
                    <tbody className="divide-y divide-white/10">
                      {riesgo.map((r) => {
                        const tel = (r.telefono ?? "").replace(/\D/g, "");
                        return (
                          <tr key={r.cliente_id}>
                            <td className="px-4 py-2"><Link className="font-medium text-ink underline" href={`/panel/clientes/${r.cliente_id}`}>{r.nombre}</Link></td>
                            <td className="px-4 py-2">{r.ultima_visita ? formatoFecha(r.ultima_visita) : "Nunca"}</td>
                            <td className="px-4 py-2 text-right">{r.dias_sin_venir}</td>
                            <td className="px-4 py-2">{formatoFecha(r.membresia_vence)}</td>
                            <td className="px-4 py-2 text-right">{r.clases_restantes ?? "Ilimitado"}</td>
                            <td className="px-4 py-2">{tel ? <a className="underline text-ink" target="_blank" rel="noopener noreferrer" href={`https://wa.me/${tel.length === 8 ? "502" + tel : tel}?text=${encodeURIComponent(`Hola ${r.nombre.split(" ")[0]}, te extrañamos en el estudio. ¿Te ayudamos a reservar tu próxima clase?`)}`}>WhatsApp</a> : r.email ?? "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Seccion>
          </>
        )}

        {tab === "adquisicion" && esG && cm.adquisicion && (
          <>
            <Seccion titulo="Canales de los últimos 3 meses">
              {cm.adquisicion.length === 0 ? <Vacio texto="Aún no hay clientas con canal registrado ni gasto de marketing." /> : (
                <div className="overflow-x-auto rounded-2xl border border-white/10 bg-card">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase text-ink-soft"><tr><th className="px-4 py-3">Canal</th><th className="px-4 py-3 text-right">Gasto</th><th className="px-4 py-3 text-right">Clientas nuevas</th><th className="px-4 py-3 text-right">CAC</th><th className="px-4 py-3 text-right">LTV</th><th className="px-4 py-3 text-right">LTV / CAC</th></tr></thead>
                    <tbody className="divide-y divide-white/10">
                      {cm.adquisicion.map((a) => <tr key={a.canal}><td className="px-4 py-2 text-ink">{a.canal}</td><td className="px-4 py-2 text-right">{q(a.gasto_total)}</td><td className="px-4 py-2 text-right">{a.clientas_nuevas}</td><td className="px-4 py-2 text-right">{q(a.cac)}</td><td className="px-4 py-2 text-right">{q(a.ltv_promedio)}</td><td className="px-4 py-2 text-right">{a.ltv_cac_ratio ?? "—"}</td></tr>)}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="mt-2 text-xs text-ink-soft">CAC = gasto de marketing del canal ÷ clientas nuevas de ese canal. LTV = lo que en promedio pagó cada clienta del canal.</p>
            </Seccion>
            <Seccion titulo="Registrar gasto"><GastoMarketingForm tenantId={tenantId} mes={cm.mes} /></Seccion>
          </>
        )}
      </div>
    </main>
  );
}
