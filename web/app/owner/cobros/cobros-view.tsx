"use client";

import { useState, useTransition } from "react";
import { anularCobro, cambiarEstadoEstudio, generarCobros, guardarSuscripcion, registrarPago } from "./actions";

export type Resumen = {
  estudios_activos: number; mrr: number; cobrado_mes: number; por_cobrar: number; en_mora: number; estudios_en_mora: number;
};
export type Estudio = {
  tenant_id: string; nombre: string; slug: string; status: string; plan: string | null; precio_mensual: number | null;
  sub_estado: string | null; pendiente: number; en_mora: number; dias_mora: number; ultimo_pago: string | null;
};
export type Cobro = {
  id: string; tenant_id: string; estudio: string; periodo: string; monto: number; estado: string;
  fecha_vencimiento: string; fecha_pago: string | null; metodo: string | null; en_mora: boolean;
};

const q = (n: number | null) => `Q${Number(n ?? 0).toLocaleString("es-GT")}`;
const input = "rounded-lg border border-white/15 bg-void px-2 py-1.5 text-sm text-white outline-none focus:border-lime/60";

export default function CobrosView({ resumen, estudios, cobros }: { resumen: Resumen; estudios: Estudio[]; cobros: Cobro[] }) {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [sub, setSub] = useState({ plan: "estandar", precio: "", dia: "1", estado: "activa" });
  const [pagando, setPagando] = useState<string | null>(null);
  const [pago, setPago] = useState({ metodo: "transferencia", ref: "", fecha: new Date().toISOString().slice(0, 10) });
  const [filtro, setFiltro] = useState<"pendiente" | "pagado" | "todos">("pendiente");
  const mesActual = new Date().toISOString().slice(0, 7) + "-01";

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
  const lista = cobros.filter((c) => (filtro === "todos" ? c.estado !== "anulado" : c.estado === filtro));

  return (
    <main className="mx-auto max-w-6xl px-6 py-8 md:px-10">
      <h1 className="text-2xl font-semibold">Cobros de ReserveOS</h1>
      <p className="mt-1 text-sm text-white/50">Quién pagó, quién debe y cuánto. Los pagos se registran a mano (transferencia o efectivo).</p>
      {msg && <p className="mt-4 rounded-xl bg-white/10 px-4 py-3 text-sm">{msg}</p>}

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tarjetas.map(([l, v, c]) => (
          <div key={l} className="rounded-2xl border border-white/10 bg-void-card p-5">
            <p className="text-xs uppercase tracking-wide text-white/45">{l}</p>
            <p className={`mt-1 text-2xl font-semibold ${c}`}>{v}</p>
          </div>
        ))}
      </section>

      <section className="mt-8 rounded-2xl border border-white/10 bg-void-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Estudios</h2>
          <button
            className="rounded-full bg-lime px-4 py-2 text-sm font-semibold text-void disabled:opacity-50"
            disabled={isPending}
            onClick={() => correr(() => generarCobros(mesActual), "Cobros del mes generados.")}
          >
            Generar cobros de este mes
          </button>
        </div>
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
                    {e.precio_mensual === null ? "Sin suscripción" : `${e.plan} · ${q(e.precio_mensual)}/mes · ${e.sub_estado}`}
                    {e.ultimo_pago ? ` · último pago ${e.ultimo_pago}` : ""}
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
                      setSub({ plan: e.plan ?? "estandar", precio: String(e.precio_mensual ?? ""), dia: "1", estado: e.sub_estado ?? "activa" });
                    }}
                  >
                    Suscripción
                  </button>
                  {e.status === "activo" ? (
                    e.en_mora > 0 && (
                      <button className="rounded-full border border-red-300/40 px-3 py-1 text-xs text-red-300" disabled={isPending} onClick={() => correr(() => cambiarEstadoEstudio(e.tenant_id, "suspendido"), "Estudio suspendido.")}>
                        Suspender
                      </button>
                    )
                  ) : (
                    <button className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/70" disabled={isPending} onClick={() => correr(() => cambiarEstadoEstudio(e.tenant_id, "activo"), "Estudio reactivado.")}>
                      Reactivar
                    </button>
                  )}
                </div>
              </div>
              {editando === e.tenant_id && (
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <label className="text-xs text-white/50">Plan<br /><input className={input} value={sub.plan} onChange={(x) => setSub({ ...sub, plan: x.target.value })} /></label>
                  <label className="text-xs text-white/50">Precio mensual (Q)<br /><input className={input} type="number" value={sub.precio} onChange={(x) => setSub({ ...sub, precio: x.target.value })} /></label>
                  <label className="text-xs text-white/50">Día de cobro<br /><input className={`${input} w-20`} type="number" min={1} max={28} value={sub.dia} onChange={(x) => setSub({ ...sub, dia: x.target.value })} /></label>
                  <label className="text-xs text-white/50">Estado<br />
                    <select className={input} value={sub.estado} onChange={(x) => setSub({ ...sub, estado: x.target.value })}>
                      <option value="activa">Activa</option><option value="pausada">Pausada</option><option value="cancelada">Cancelada</option>
                    </select>
                  </label>
                  <button className="rounded-full bg-lime px-4 py-1.5 text-sm font-semibold text-void disabled:opacity-50" disabled={isPending || sub.precio === ""}
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
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Cobros</h2>
          <div className="flex gap-2 text-xs">
            {(["pendiente", "pagado", "todos"] as const).map((f) => (
              <button key={f} onClick={() => setFiltro(f)} className={`rounded-full px-3 py-1 ${filtro === f ? "bg-lime text-void" : "border border-white/15 text-white/60"}`}>
                {f === "pendiente" ? "Pendientes" : f === "pagado" ? "Pagados" : "Todos"}
              </button>
            ))}
          </div>
        </div>
        <ul className="mt-3 divide-y divide-white/10">
          {lista.length === 0 && <li className="py-3 text-sm text-white/50">Nada por aquí.</li>}
          {lista.map((c) => (
            <li key={c.id} className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>
                  {c.estudio} · {c.periodo.slice(0, 7)} · {q(c.monto)}
                  <span className="text-white/50"> · vence {c.fecha_vencimiento}</span>
                </span>
                <span className="flex items-center gap-3">
                  {c.estado === "pagado" ? (
                    <span className="text-lime">Pagado {c.fecha_pago} · {c.metodo}</span>
                  ) : (
                    <>
                      {c.en_mora && <span className="text-red-300">En mora</span>}
                      <button className="rounded-full bg-lime px-3 py-1 text-xs font-semibold text-void" onClick={() => setPagando(pagando === c.id ? null : c.id)}>Registrar pago</button>
                      <button className="text-xs text-white/40 hover:text-white" disabled={isPending} onClick={() => correr(() => anularCobro(c.id), "Cobro anulado.")}>Anular</button>
                    </>
                  )}
                </span>
              </div>
              {pagando === c.id && (
                <div className="mt-2 flex flex-wrap items-end gap-3">
                  <select className={input} value={pago.metodo} onChange={(x) => setPago({ ...pago, metodo: x.target.value })}>
                    <option value="transferencia">Transferencia</option><option value="efectivo">Efectivo</option><option value="cheque">Cheque</option>
                  </select>
                  <input className={input} placeholder="Referencia" value={pago.ref} onChange={(x) => setPago({ ...pago, ref: x.target.value })} />
                  <input className={input} type="date" value={pago.fecha} onChange={(x) => setPago({ ...pago, fecha: x.target.value })} />
                  <button className="rounded-full bg-lime px-4 py-1.5 text-sm font-semibold text-void disabled:opacity-50" disabled={isPending}
                    onClick={() => correr(() => registrarPago(c.id, pago.metodo, pago.ref, pago.fecha), "Pago registrado.", () => setPagando(null))}>
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
