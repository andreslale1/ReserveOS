"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import CampoFecha from "@/lib/campo-fecha";
import { formatoFecha, hoyGT } from "@/lib/fechas";
import { anularCobro, crearCobro, generarCobros, guardarSuscripcion, registrarPago, vistaPreviaCobros, type VistaPrevia } from "./actions";

export type Resumen = {
  estudios_activos: number; mrr: number; cobrado_mes: number; por_cobrar: number; en_mora: number; estudios_en_mora: number;
};
export type Estudio = {
  tenant_id: string; nombre: string; slug: string; status: string; plan: string | null; precio_mensual: number | null;
  sub_estado: string | null; pendiente: number; en_mora: number; dias_mora: number; ultimo_pago: string | null;
};
export type Cobro = {
  id: string; tenant_id: string; estudio: string; periodo: string; concepto: string; monto: number; descuento: number;
  pagado: number; saldo: number; estado: string; fecha_vencimiento: string; fecha_pago: string | null;
  metodo: string | null; en_mora: boolean; plan_snapshot: string | null; notas: string | null;
};

export type PlanCat = { key: string; nombre: string; precio_mensual: number; moneda?: string; prueba_gratuita?: boolean };
const q = (n: number | null) => `Q${Number(n ?? 0).toLocaleString("es-GT")}`;
const input = "rounded-lg border border-white/15 bg-void px-2 py-1.5 text-sm text-white outline-none focus:border-lime/60";

export default function CobrosView({ resumen, estudios, cobros, planes }: { resumen: Resumen; estudios: Estudio[]; cobros: Cobro[]; planes: PlanCat[] }) {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [prev, setPrev] = useState<VistaPrevia | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [sub, setSub] = useState({ plan: "", precio: "", dia: "1", estado: "activa" });
  const [pagando, setPagando] = useState<string | null>(null);
  const [pago, setPago] = useState({ metodo: "transferencia", ref: "", fecha: hoyGT(), monto: "" });
  const [nuevo, setNuevo] = useState({ abierto: false, tenantId: "", concepto: "setup", monto: "", descuento: "", vence: "", notas: "" });
  const [filtro, setFiltro] = useState<"abierto" | "pagado" | "todos">("abierto");

  function correr(fn: () => Promise<{ error: string | null; data?: unknown }>, ok: string, despues?: () => void) {
    setMsg(null);
    startTransition(async () => {
      const r = await fn();
      if (r.error) setMsg(r.error);
      else {
        setMsg(ok);
        despues?.();
      }
    });
  }

  const tarjetas: [string, string, string][] = [
    ["Ingreso mensual recurrente", q(resumen.mrr), "text-lime"],
    ["Cobrado este mes", q(resumen.cobrado_mes), "text-white"],
    ["Por cobrar", q(resumen.por_cobrar), "text-white"],
    ["En mora", `${q(resumen.en_mora)} · ${resumen.estudios_en_mora} estudio(s)`, resumen.en_mora > 0 ? "text-red-300" : "text-white"],
  ];
  const lista = cobros.filter((c) => (filtro === "todos" ? c.estado !== "anulado" : filtro === "abierto" ? ["pendiente", "parcial"].includes(c.estado) : c.estado === filtro));

  return (
    <main className="mx-auto max-w-6xl px-6 py-8 md:px-10">
      <h1 className="text-2xl font-semibold">Cobros de ReserveOS</h1>
      <p className="mt-1 text-sm text-white/60">Lo que los estudios pagan a ReserveOS por su suscripción (no incluye lo que las clientas pagan al estudio). Los pagos se registran a mano (transferencia o efectivo).</p>
      {msg && <p className="mt-4 rounded-xl bg-white/10 px-4 py-3 text-sm">{msg}</p>}

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tarjetas.map(([l, v, c]) => (
          <div key={l} className="rounded-2xl border border-white/10 bg-void-card p-5">
            <p className="text-xs text-white/60">{l}</p>
            <p className={`mt-1 text-2xl font-semibold ${c}`}>{v}</p>
          </div>
        ))}
      </section>

      <section className="mt-8 rounded-2xl border border-white/10 bg-void-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Estudios y suscripciones</h2>
          <button
            className="rounded-full bg-lime px-4 py-2 text-sm font-semibold text-void disabled:opacity-50"
            disabled={isPending}
            onClick={() => { setMsg(null); startTransition(async () => { const r = await vistaPreviaCobros(null); if (r.error) setMsg(r.error); else setPrev(r.data); }); }}
          >
            {isPending && !prev ? "Calculando…" : "Generar cobros de este mes…"}
          </button>
        </div>
        {prev && (
          <div className="mt-4 rounded-xl border border-white/10 bg-void p-4" role="group" aria-label="Vista previa de cobros">
            <h3 className="text-sm font-semibold">Vista previa · {prev.periodo.slice(0, 7)}</h3>
            <p className="mt-1 text-sm text-white/75">Se generarán <strong>{prev.cantidad}</strong> cobro(s) por <strong>{q(prev.total)}</strong>. Nada se ha creado todavía.</p>
            {prev.a_generar.length > 0 && (
              <table className="mt-3 w-full text-sm">
                <caption className="sr-only">Cobros que se generarán</caption>
                <thead className="text-left text-xs text-white/60"><tr><th>Estudio</th><th>Plan</th><th className="text-right">Monto</th><th className="text-right">Vence</th></tr></thead>
                <tbody className="divide-y divide-white/10">
                  {prev.a_generar.map((x) => <tr key={x.tenant_id}><td className="py-1.5">{x.estudio}</td><td>{x.plan}</td><td className="text-right">{q(x.monto)}</td><td className="text-right">{formatoFecha(x.vence)}</td></tr>)}
                </tbody>
              </table>
            )}
            {prev.ya_existentes.length > 0 && <p className="mt-3 text-xs text-white/60">Ya tienen cobro este mes y no se duplican: {prev.ya_existentes.map((x) => x.estudio).join(", ")}.</p>}
            {prev.excepciones.length > 0 && (
              <div className="mt-3 text-xs text-yellow-200">
                <p className="font-medium">Quedan fuera:</p>
                <ul className="mt-1 list-disc pl-5">{prev.excepciones.map((x) => <li key={x.tenant_id}>{x.estudio}: {x.motivo}</li>)}</ul>
              </div>
            )}
            <div className="mt-4 flex gap-3">
              <button className="rounded-full bg-lime px-4 py-1.5 text-sm font-semibold text-void disabled:opacity-50" disabled={isPending || prev.cantidad === 0}
                onClick={() => correr(() => generarCobros(prev.periodo), `${prev.cantidad} cobro(s) generados por ${q(prev.total)}.`, () => setPrev(null))}>
                {isPending ? "Generando…" : `Confirmar y generar ${prev.cantidad} cobro(s)`}
              </button>
              <button className="text-sm text-white/60" onClick={() => setPrev(null)}>Cancelar</button>
            </div>
          </div>
        )}
        <ul className="mt-3 divide-y divide-white/10">
          {estudios.map((e) => (
            <li key={e.tenant_id} className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">
                    {e.nombre}{" "}
                    <span className={`text-xs ${e.status === "activo" ? "text-lime" : "text-red-300"}`}>· {e.status}</span>
                  </p>
                  <p className="text-xs text-white/50">
                    {e.precio_mensual === null ? "Sin suscripción (asigna un plan)" : `${e.plan} · ${q(e.precio_mensual)}/mes · ${e.sub_estado}`}
                    {e.ultimo_pago ? ` · último pago ${formatoFecha(e.ultimo_pago)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  {e.en_mora > 0 ? (
                    <span className="text-red-300">Debe {q(e.en_mora)} · {e.dias_mora} días</span>
                  ) : e.pendiente > 0 ? (
                    <span className="text-white/70">Pendiente {q(e.pendiente)}</span>
                  ) : e.precio_mensual !== null ? (
                    <span className="text-lime">Al día</span>
                  ) : null}
                  <button
                    className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/70 hover:text-white"
                    onClick={() => {
                      setEditando(editando === e.tenant_id ? null : e.tenant_id);
                      setSub({ plan: e.plan ?? "", precio: String(e.precio_mensual ?? ""), dia: "1", estado: e.sub_estado ?? "activa" });
                    }}
                  >
                    Suscripción
                  </button>
                  <Link href={`/owner/${e.tenant_id}`} className="text-xs text-white/60 underline hover:text-white">Estado y ficha</Link>
                </div>
              </div>
              {editando === e.tenant_id && (
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <label className="text-xs text-white/60">Plan del catálogo *<br />
                    <select className={input} value={sub.plan} onChange={(x) => { const pl = planes.find((p) => p.key === x.target.value); setSub({ ...sub, plan: x.target.value, precio: sub.precio === "" && pl ? String(pl.precio_mensual) : sub.precio }); }}>
                      <option value="">Elegir plan…</option>
                      {planes.map((p) => <option key={p.key} value={p.key}>{p.nombre} · {q(p.precio_mensual)}/mes</option>)}
                      {sub.plan && !planes.some((p) => p.key === sub.plan) && <option value={sub.plan}>{sub.plan} (no publicado)</option>}
                    </select></label>
                  <label className="text-xs text-white/60">Precio mensual pactado (Q) *<br /><input className={input} type="number" min={0} value={sub.precio} onChange={(x) => setSub({ ...sub, precio: x.target.value })} /></label>
                  <label className="text-xs text-white/60">Día de cobro (1 a 28)<br /><input className={`${input} w-20`} type="number" min={1} max={28} value={sub.dia} onChange={(x) => setSub({ ...sub, dia: x.target.value })} /></label>
                  <label className="text-xs text-white/60">Estado de la suscripción<br />
                    <select className={input} value={sub.estado} onChange={(x) => setSub({ ...sub, estado: x.target.value })}>
                      <option value="activa">Activa</option><option value="pausada">Pausada</option><option value="cancelada">Cancelada</option>
                    </select>
                  </label>
                  <button className="rounded-full bg-lime px-4 py-1.5 text-sm font-semibold text-void disabled:opacity-50" disabled={isPending || sub.precio === "" || !sub.plan}
                    onClick={() => correr(() => guardarSuscripcion(e.tenant_id, sub.plan, Number(sub.precio), Number(sub.dia), sub.estado), "Suscripción guardada.", () => setEditando(null))}>
                    Guardar
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8 rounded-2xl border border-white/10 bg-void-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Cobros</h2>
          <a href="/owner/cobros/export" className="text-xs text-white/50 hover:text-white">Exportar CSV</a>
          <button className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/70" onClick={() => setNuevo({ ...nuevo, abierto: !nuevo.abierto })}>+ Cobro (setup, sede extra…)</button>
          <div className="flex gap-2 text-xs">
            {(["abierto", "pagado", "todos"] as const).map((f) => (
              <button key={f} onClick={() => setFiltro(f)} className={`rounded-full px-3 py-1 ${filtro === f ? "bg-lime text-void" : "border border-white/15 text-white/60"}`}>
                {f === "abierto" ? "Por cobrar" : f === "pagado" ? "Pagados" : "Todos"}
              </button>
            ))}
          </div>
        </div>
        {nuevo.abierto && (
          <div className="mt-3 flex flex-wrap items-end gap-3 rounded-xl border border-white/10 p-3">
            <label className="text-xs text-white/60">Estudio *<br />
              <select className={input} value={nuevo.tenantId} onChange={(x) => setNuevo({ ...nuevo, tenantId: x.target.value })}>
                <option value="">Elige…</option>{estudios.map((e) => <option key={e.tenant_id} value={e.tenant_id}>{e.nombre}</option>)}
              </select></label>
            <label className="text-xs text-white/60">Concepto<br />
              <select className={input} value={nuevo.concepto} onChange={(x) => setNuevo({ ...nuevo, concepto: x.target.value })}>
                <option value="setup">Configuración inicial</option><option value="sede_extra">Sede extra</option><option value="modulo">Módulo</option><option value="app">App de marca</option><option value="otro">Otro</option>
              </select></label>
            <label className="text-xs text-white/60">Monto (Q) *<br /><input className={`${input} w-28`} type="number" value={nuevo.monto} onChange={(x) => setNuevo({ ...nuevo, monto: x.target.value })} /></label>
            <label className="text-xs text-white/60">Descuento (Q)<br /><input className={`${input} w-24`} type="number" value={nuevo.descuento} onChange={(x) => setNuevo({ ...nuevo, descuento: x.target.value })} /></label>
            <label className="text-xs text-white/60">Vence (dd/mm/aaaa)<br /><CampoFecha className={`${input} w-32`} value={nuevo.vence} onChange={(v) => setNuevo({ ...nuevo, vence: v })} /></label>
            <label className="text-xs text-white/60">Nota<br /><input className={`${input} w-48`} value={nuevo.notas} onChange={(x) => setNuevo({ ...nuevo, notas: x.target.value })} /></label>
            <button className="rounded-full bg-lime px-4 py-1.5 text-sm font-semibold text-void disabled:opacity-50" disabled={isPending || !nuevo.tenantId || !(Number(nuevo.monto) > 0)}
              onClick={() => correr(() => crearCobro(nuevo.tenantId, nuevo.concepto, Number(nuevo.monto), Number(nuevo.descuento || 0), nuevo.vence, nuevo.notas), "Cobro creado.", () => setNuevo({ ...nuevo, abierto: false, monto: "", descuento: "", notas: "" }))}>Crear</button>
          </div>
        )}
        <ul className="mt-3 divide-y divide-white/10">
          {lista.length === 0 && <li className="py-3 text-sm text-white/50">Nada por aquí.</li>}
          {lista.map((c) => (
            <li key={c.id} className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>
                  {c.estudio} · {c.periodo.slice(0, 7)} · <span className="text-white/60">{c.concepto}</span> · {q(c.monto - c.descuento)}
                  {c.pagado > 0 && c.estado !== "pagado" && <span className="text-white/60"> (pagado {q(c.pagado)}, saldo {q(c.saldo)})</span>}
                  <span className="text-white/60"> · vence {formatoFecha(c.fecha_vencimiento)}</span>
                </span>
                <span className="flex items-center gap-3">
                  {c.estado === "pagado" ? (
                    <span className="text-lime">Pagado {formatoFecha(c.fecha_pago)} · {c.metodo}</span>
                  ) : (
                    <>
                      {c.en_mora && <span className="text-red-300">En mora</span>}
                      <button className="rounded-full bg-lime px-3 py-1 text-xs font-semibold text-void" onClick={() => { setPagando(pagando === c.id ? null : c.id); setPago({ ...pago, monto: String(c.saldo) }); }}>Registrar pago</button>
                      <button className="text-xs text-white/40 hover:text-white" disabled={isPending} onClick={() => correr(() => anularCobro(c.id), "Cobro anulado.")}>Anular</button>
                    </>
                  )}
                </span>
              </div>
              {pagando === c.id && (
                <div className="mt-2 flex flex-wrap items-end gap-3">
                  <label className="text-xs text-white/60">Método<br /><select className={input} value={pago.metodo} onChange={(x) => setPago({ ...pago, metodo: x.target.value })}>
                    <option value="transferencia">Transferencia</option><option value="efectivo">Efectivo</option><option value="cheque">Cheque</option>
                  </select></label>
                  <label className="text-xs text-white/60">Monto (Q) *<br /><input className={`${input} w-28`} type="number" min={0} value={pago.monto} onChange={(x) => setPago({ ...pago, monto: x.target.value })} /></label>
                  <label className="text-xs text-white/60">Referencia<br /><input className={input} value={pago.ref} onChange={(x) => setPago({ ...pago, ref: x.target.value })} /></label>
                  <label className="text-xs text-white/60">Fecha del pago (dd/mm/aaaa)<br /><CampoFecha className={`${input} w-32`} value={pago.fecha} onChange={(v) => setPago({ ...pago, fecha: v })} /></label>
                  <button className="rounded-full bg-lime px-4 py-1.5 text-sm font-semibold text-void disabled:opacity-50" disabled={isPending || !pago.fecha}
                    onClick={() => correr(() => registrarPago(c.id, pago.metodo, pago.ref, pago.fecha, pago.monto ? Number(pago.monto) : null), "Pago registrado.", () => setPagando(null))}>
                    Confirmar pago
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
