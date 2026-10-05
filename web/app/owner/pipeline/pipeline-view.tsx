"use client";

import { useState, useTransition } from "react";
import { cambiarEtapa, eliminarLead, guardarLead } from "./actions";

export type Lead = {
  id: string;
  nombre: string;
  contacto: string | null;
  telefono: string | null;
  email: string | null;
  ciudad: string | null;
  tipo: string;
  valor_mensual: number;
  etapa: string;
  proximo_paso: string | null;
  proximo_paso_fecha: string | null;
  notas: string | null;
};

const ETAPAS = [
  ["prospecto", "Prospecto"],
  ["demo", "Demo"],
  ["propuesta", "Propuesta"],
  ["negociacion", "Negociación"],
  ["ganado", "Ganado"],
  ["perdido", "Perdido"],
] as const;

const vacio = { id: null as string | null, nombre: "", contacto: "", telefono: "", email: "", ciudad: "", tipo: "estudio", valor: "", etapa: "prospecto", proximoPaso: "", proximoPasoFecha: "", notas: "" };
const input = "mt-1 w-full rounded-lg border border-white/15 bg-void px-3 py-2 text-white outline-none focus:border-lime/60";
const q = (n: number) => `Q${Number(n).toLocaleString("es-GT")}`;

export default function PipelineView({ leads, resumen }: { leads: Lead[]; resumen: { leads_abiertos: number; valor_pipeline: number } | null }) {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [f, setF] = useState(vacio);
  const [abierto, setAbierto] = useState(false);
  const hoy = new Date().toISOString().slice(0, 10);

  function correr(fn: () => Promise<{ error: string | null }>, despues?: () => void) {
    setMsg(null);
    startTransition(async () => {
      const r = await fn();
      if (r.error) setMsg(r.error);
      else despues?.();
    });
  }

  function editar(l: Lead) {
    setF({ id: l.id, nombre: l.nombre, contacto: l.contacto ?? "", telefono: l.telefono ?? "", email: l.email ?? "", ciudad: l.ciudad ?? "", tipo: l.tipo, valor: String(l.valor_mensual), etapa: l.etapa, proximoPaso: l.proximo_paso ?? "", proximoPasoFecha: l.proximo_paso_fecha ?? "", notas: l.notas ?? "" });
    setAbierto(true);
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-8 md:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Pipeline de ventas</h1>
          <p className="mt-1 text-sm text-white/50">
            {resumen?.leads_abiertos ?? 0} oportunidades abiertas · {q(resumen?.valor_pipeline ?? 0)}/mes potenciales
          </p>
        </div>
        <button className="rounded-full bg-lime px-4 py-2 text-sm font-semibold text-void" onClick={() => { setF(vacio); setAbierto(!abierto); }}>
          + Nuevo prospecto
        </button>
      </div>

      {msg && <p className="mt-4 rounded-xl bg-white/10 px-4 py-3 text-sm text-white">{msg}</p>}

      {abierto && (
        <section className="mt-6 rounded-2xl border border-white/10 bg-void-card p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            {([["nombre", "Gimnasio / estudio"], ["contacto", "Persona de contacto"], ["telefono", "Teléfono"], ["email", "Correo"], ["ciudad", "Ciudad"], ["valor", "Valor mensual (Q)"]] as const).map(([k, l]) => (
              <label key={k} className="text-sm text-white/60">
                {l}
                <input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} className={input} type={k === "valor" ? "number" : "text"} />
              </label>
            ))}
            <label className="text-sm text-white/60">
              Tipo
              <select value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })} className={input}>
                <option value="estudio">Estudio (pilates, yoga…)</option>
                <option value="gimnasio">Gimnasio</option>
                <option value="otro">Otro</option>
              </select>
            </label>
            <label className="text-sm text-white/60">
              Etapa
              <select value={f.etapa} onChange={(e) => setF({ ...f, etapa: e.target.value })} className={input}>
                {ETAPAS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label className="text-sm text-white/60">
              Próxima acción
              <input value={f.proximoPaso} onChange={(e) => setF({ ...f, proximoPaso: e.target.value })} className={input} />
            </label>
            <label className="text-sm text-white/60">
              Fecha de la acción
              <input type="date" value={f.proximoPasoFecha} onChange={(e) => setF({ ...f, proximoPasoFecha: e.target.value })} className={input} />
            </label>
            <label className="text-sm text-white/60 sm:col-span-2">
              Notas
              <input value={f.notas} onChange={(e) => setF({ ...f, notas: e.target.value })} className={input} />
            </label>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              className="rounded-full bg-lime px-4 py-2 text-sm font-semibold text-void disabled:opacity-50"
              disabled={isPending || !f.nombre.trim()}
              onClick={() => correr(() => guardarLead({ ...f, valor: Number(f.valor || 0) }), () => { setF(vacio); setAbierto(false); })}
            >
              Guardar
            </button>
            <button className="text-sm text-white/50" onClick={() => setAbierto(false)}>Cancelar</button>
          </div>
        </section>
      )}

      <div className="mt-8 grid gap-4 overflow-x-auto md:grid-cols-3 xl:grid-cols-6">
        {ETAPAS.map(([etapa, label]) => {
          const col = leads.filter((l) => l.etapa === etapa);
          return (
            <section key={etapa} className="min-w-[200px] rounded-2xl border border-white/10 bg-void-card p-3">
              <h2 className="px-1 text-xs font-medium uppercase tracking-wide text-white/45">
                {label} <span className="text-white/30">({col.length})</span>
              </h2>
              <ul className="mt-3 space-y-2">
                {col.map((l) => (
                  <li key={l.id} className="rounded-xl border border-white/10 bg-void p-3 text-sm">
                    <button className="text-left font-medium text-white hover:text-lime" onClick={() => editar(l)}>{l.nombre}</button>
                    <p className="text-xs text-white/50">{l.tipo}{l.ciudad ? ` · ${l.ciudad}` : ""} · {q(l.valor_mensual)}/mes</p>
                    {l.proximo_paso && (
                      <p className={`mt-1 text-xs ${l.proximo_paso_fecha && l.proximo_paso_fecha < hoy ? "text-red-300" : "text-white/60"}`}>
                        → {l.proximo_paso}{l.proximo_paso_fecha ? ` (${l.proximo_paso_fecha})` : ""}
                      </p>
                    )}
                    <div className="mt-2 flex items-center gap-2">
                      <select
                        value={l.etapa}
                        disabled={isPending}
                        onChange={(e) => correr(() => cambiarEtapa(l.id, e.target.value))}
                        className="rounded bg-void-card px-1 py-1 text-xs text-white/70"
                      >
                        {ETAPAS.map(([v, lb]) => <option key={v} value={v}>{lb}</option>)}
                      </select>
                      <button className="text-xs text-white/35 hover:text-white" disabled={isPending} onClick={() => correr(() => eliminarLead(l.id))}>Eliminar</button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </main>
  );
}
