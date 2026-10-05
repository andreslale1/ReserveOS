"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { completarTarea, crearTarea, eliminarContacto, guardarContacto, guardarOportunidad, registrarActividad } from "./actions";

export type Detalle = {
  oportunidad: {
    id: string; nombre: string; empresa_id: string; valor_mensual: number; etapa: string; plan_interes: string | null;
    num_sedes: number | null; probabilidad: number | null; proximo_paso: string | null; proximo_paso_fecha: string | null;
    fuente: string | null; motivo_perdida: string | null; notas: string | null;
  };
  empresa: { id: string; nombre: string; tipo: string; ciudad: string | null; sitio_web: string | null } | null;
  contactos: { id: string; nombre: string; cargo: string | null; telefono: string | null; email: string | null; es_decisor: boolean }[];
  actividades: { id: string; tipo: string; resumen: string; fecha: string; autor_nombre: string | null }[];
  tareas: { id: string; titulo: string; vence: string | null; estado: string }[];
  proyecto_id: string | null;
};

const ETAPAS = ["prospecto", "demo", "propuesta", "negociacion", "ganado", "perdido"];
const TIPOS = ["llamada", "email", "reunion", "demo", "whatsapp", "nota", "otro"];
const input = "mt-1 w-full rounded-lg border border-white/15 bg-void px-3 py-2 text-sm text-white outline-none focus:border-lime/60";
const card = "rounded-2xl border border-white/10 bg-void-card p-5";

export default function FichaOportunidad({ d }: { d: Detalle }) {
  const o = d.oportunidad;
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [f, setF] = useState({
    valor: String(o.valor_mensual), etapa: o.etapa, planInteres: o.plan_interes ?? "", numSedes: o.num_sedes === null ? "" : String(o.num_sedes),
    probabilidad: o.probabilidad === null ? "" : String(o.probabilidad), proximoPaso: o.proximo_paso ?? "", proximoPasoFecha: o.proximo_paso_fecha ?? "",
    fuente: o.fuente ?? "", motivoPerdida: o.motivo_perdida ?? "", notas: o.notas ?? "",
  });
  const [act, setAct] = useState({ tipo: "llamada", resumen: "" });
  const [tarea, setTarea] = useState({ titulo: "", vence: "" });
  const [c, setC] = useState({ nombre: "", cargo: "", telefono: "", email: "", decisor: false });

  function correr(fn: () => Promise<{ error: string | null }>, ok: string, despues?: () => void) {
    setMsg(null);
    startTransition(async () => {
      const r = await fn();
      if (r.error) setMsg(r.error);
      else { setMsg(ok); despues?.(); }
    });
  }

  return (
    <main className="mx-auto grid max-w-6xl gap-6 px-6 py-8 md:px-10">
      <div>
        <Link href="/owner/pipeline" className="text-sm text-white/50 hover:text-white">← Pipeline</Link>
        <h1 className="mt-2 text-2xl font-semibold">{o.nombre}</h1>
        <p className="text-sm text-white/50">{d.empresa?.tipo}{d.empresa?.ciudad ? ` · ${d.empresa.ciudad}` : ""}{d.empresa?.sitio_web ? ` · ${d.empresa.sitio_web}` : ""}</p>
        {d.proyecto_id && (
          <Link href="/owner/activaciones" className="mt-2 inline-block rounded-full bg-lime px-3 py-1 text-xs font-semibold text-void">Ver proyecto de activación →</Link>
        )}
      </div>
      {msg && <p className="rounded-xl bg-white/10 px-4 py-3 text-sm">{msg}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={card}>
          <h2 className="text-base font-semibold">Oportunidad</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-white/50">Etapa
              <select className={input} value={f.etapa} onChange={(e) => setF({ ...f, etapa: e.target.value })}>{ETAPAS.map((x) => <option key={x}>{x}</option>)}</select>
            </label>
            <label className="text-xs text-white/50">Valor mensual (Q)<input type="number" className={input} value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} /></label>
            <label className="text-xs text-white/50">Plan de interés<input className={input} value={f.planInteres} onChange={(e) => setF({ ...f, planInteres: e.target.value })} /></label>
            <label className="text-xs text-white/50">Sedes<input type="number" className={input} value={f.numSedes} onChange={(e) => setF({ ...f, numSedes: e.target.value })} /></label>
            <label className="text-xs text-white/50">Probabilidad (%)<input type="number" min={0} max={100} className={input} value={f.probabilidad} onChange={(e) => setF({ ...f, probabilidad: e.target.value })} /></label>
            <label className="text-xs text-white/50">Fuente<input className={input} value={f.fuente} onChange={(e) => setF({ ...f, fuente: e.target.value })} /></label>
            <label className="text-xs text-white/50">Próxima acción<input className={input} value={f.proximoPaso} onChange={(e) => setF({ ...f, proximoPaso: e.target.value })} /></label>
            <label className="text-xs text-white/50">Fecha<input type="date" className={input} value={f.proximoPasoFecha} onChange={(e) => setF({ ...f, proximoPasoFecha: e.target.value })} /></label>
            {f.etapa === "perdido" && (
              <label className="text-xs text-white/50 sm:col-span-2">Motivo por el que se perdió<input className={input} value={f.motivoPerdida} onChange={(e) => setF({ ...f, motivoPerdida: e.target.value })} /></label>
            )}
            <label className="text-xs text-white/50 sm:col-span-2">Notas<textarea rows={2} className={input} value={f.notas} onChange={(e) => setF({ ...f, notas: e.target.value })} /></label>
          </div>
          <button className="mt-4 rounded-full bg-lime px-4 py-2 text-sm font-semibold text-void disabled:opacity-50" disabled={isPending}
            onClick={() => correr(() => guardarOportunidad(o.id, o.empresa_id, { valor: Number(f.valor || 0), etapa: f.etapa, planInteres: f.planInteres, numSedes: f.numSedes ? Number(f.numSedes) : null, probabilidad: f.probabilidad ? Number(f.probabilidad) : null, proximoPaso: f.proximoPaso, proximoPasoFecha: f.proximoPasoFecha, fuente: f.fuente, motivoPerdida: f.motivoPerdida, notas: f.notas }), "Guardado.")}>
            Guardar
          </button>
        </section>

        <section className={card}>
          <h2 className="text-base font-semibold">Contactos</h2>
          <ul className="mt-3 divide-y divide-white/10">
            {d.contactos.length === 0 && <li className="py-2 text-sm text-white/50">Sin contactos.</li>}
            {d.contactos.map((x) => (
              <li key={x.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span>{x.nombre}{x.es_decisor && <span className="ml-2 text-xs text-lime">decisor</span>}
                  <span className="block text-xs text-white/50">{[x.cargo, x.telefono, x.email].filter(Boolean).join(" · ")}</span></span>
                <button className="text-xs text-white/40 hover:text-white" disabled={isPending} onClick={() => correr(() => eliminarContacto(o.id, x.id), "Contacto eliminado.")}>Quitar</button>
              </li>
            ))}
          </ul>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <input className={input} placeholder="Nombre" value={c.nombre} onChange={(e) => setC({ ...c, nombre: e.target.value })} />
            <input className={input} placeholder="Cargo" value={c.cargo} onChange={(e) => setC({ ...c, cargo: e.target.value })} />
            <input className={input} placeholder="Teléfono" value={c.telefono} onChange={(e) => setC({ ...c, telefono: e.target.value })} />
            <input className={input} placeholder="Correo" value={c.email} onChange={(e) => setC({ ...c, email: e.target.value })} />
          </div>
          <label className="mt-2 flex items-center gap-2 text-xs text-white/60"><input type="checkbox" checked={c.decisor} onChange={(e) => setC({ ...c, decisor: e.target.checked })} /> Es quien decide</label>
          <button className="mt-3 rounded-full border border-white/15 px-4 py-1.5 text-sm text-white/80 disabled:opacity-50" disabled={isPending || !c.nombre.trim()}
            onClick={() => correr(() => guardarContacto(o.id, o.empresa_id, c), "Contacto agregado.", () => setC({ nombre: "", cargo: "", telefono: "", email: "", decisor: false }))}>
            + Agregar contacto
          </button>
        </section>

        <section className={card}>
          <h2 className="text-base font-semibold">Tareas</h2>
          <ul className="mt-3 divide-y divide-white/10">
            {d.tareas.length === 0 && <li className="py-2 text-sm text-white/50">Sin tareas.</li>}
            {d.tareas.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-2 text-sm">
                <input type="checkbox" checked={t.estado === "hecha"} disabled={isPending} onChange={(e) => correr(() => completarTarea(o.id, t.id, e.target.checked), "Tarea actualizada.")} />
                <span className={t.estado === "hecha" ? "text-white/35 line-through" : ""}>{t.titulo}</span>
                {t.vence && <span className="ml-auto text-xs text-white/45">{t.vence}</span>}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <input className={`${input} flex-1`} placeholder="Nueva tarea" value={tarea.titulo} onChange={(e) => setTarea({ ...tarea, titulo: e.target.value })} />
            <input type="date" className={`${input} w-40`} value={tarea.vence} onChange={(e) => setTarea({ ...tarea, vence: e.target.value })} />
            <button className="rounded-full border border-white/15 px-4 py-1.5 text-sm disabled:opacity-50" disabled={isPending || !tarea.titulo.trim()}
              onClick={() => correr(() => crearTarea(o.id, tarea.titulo, tarea.vence), "Tarea creada.", () => setTarea({ titulo: "", vence: "" }))}>+ Tarea</button>
          </div>
        </section>

        <section className={card}>
          <h2 className="text-base font-semibold">Historial</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <select className={`${input} w-32`} value={act.tipo} onChange={(e) => setAct({ ...act, tipo: e.target.value })}>{TIPOS.map((x) => <option key={x}>{x}</option>)}</select>
            <input className={`${input} flex-1`} placeholder="Qué pasó" value={act.resumen} onChange={(e) => setAct({ ...act, resumen: e.target.value })} />
            <button className="rounded-full bg-lime px-4 py-1.5 text-sm font-semibold text-void disabled:opacity-50" disabled={isPending || !act.resumen.trim()}
              onClick={() => correr(() => registrarActividad(o.id, act.tipo, act.resumen), "Actividad registrada.", () => setAct({ ...act, resumen: "" }))}>Registrar</button>
          </div>
          <ul className="mt-3 space-y-2">
            {d.actividades.length === 0 && <li className="text-sm text-white/50">Sin actividad todavía.</li>}
            {d.actividades.map((a) => (
              <li key={a.id} className="text-sm">
                <span className="text-xs uppercase text-lime">{a.tipo}</span> · <span className="text-white/45">{new Date(a.fecha).toLocaleDateString("es-GT")} {a.autor_nombre ? `· ${a.autor_nombre}` : ""}</span>
                <p className="text-white/80">{a.resumen}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
