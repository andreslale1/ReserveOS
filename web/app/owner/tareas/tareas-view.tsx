"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { marcarTarea, nuevaTarea } from "./actions";

export type Tarea = { id: string; titulo: string; vence: string | null; estado: string; responsable: string | null; lead_id: string | null; empresa: string | null; tenant_id: string | null; estudio: string | null };
const input = "rounded-lg border border-white/15 bg-void px-3 py-2 text-sm text-white outline-none focus:border-lime/60";

export default function TareasView({ tareas }: { tareas: Tarea[] }) {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [t, setT] = useState({ titulo: "", vence: "" });
  const hoy = new Date().toISOString().slice(0, 10);
  const pend = tareas.filter((x) => x.estado === "pendiente");
  const hechas = tareas.filter((x) => x.estado === "hecha").slice(0, 15);
  const grupos: [string, Tarea[]][] = [
    ["Vencidas", pend.filter((x) => x.vence && x.vence < hoy)],
    ["Hoy", pend.filter((x) => x.vence === hoy)],
    ["Próximas y sin fecha", pend.filter((x) => !x.vence || x.vence > hoy)],
  ];

  function correr(fn: () => Promise<{ error: string | null }>, despues?: () => void) {
    setMsg(null);
    startTransition(async () => { const r = await fn(); if (r.error) setMsg(r.error); else despues?.(); });
  }
  const fila = (x: Tarea) => (
    <li key={x.id} className="flex items-center gap-3 py-2 text-sm">
      <input type="checkbox" checked={x.estado === "hecha"} disabled={isPending} onChange={(e) => correr(() => marcarTarea(x.id, e.target.checked))} />
      <span className={x.estado === "hecha" ? "text-white/35 line-through" : ""}>{x.titulo}</span>
      {x.lead_id && x.empresa && <Link href={`/owner/pipeline/${x.lead_id}`} className="text-xs text-lime">{x.empresa}</Link>}
      {x.estudio && <span className="text-xs text-white/45">{x.estudio}</span>}
      {x.vence && <span className="ml-auto text-xs text-white/45">{x.vence}</span>}
    </li>
  );

  return (
    <main className="mx-auto max-w-3xl px-6 py-8 md:px-10">
      <h1 className="text-2xl font-semibold">Tareas</h1>
      {msg && <p className="mt-3 rounded-xl bg-white/10 px-4 py-3 text-sm">{msg}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <input className={`${input} flex-1`} placeholder="Nueva tarea" value={t.titulo} onChange={(e) => setT({ ...t, titulo: e.target.value })} />
        <input type="date" className={input} value={t.vence} onChange={(e) => setT({ ...t, vence: e.target.value })} />
        <button className="rounded-full bg-lime px-4 py-2 text-sm font-semibold text-void disabled:opacity-50" disabled={isPending || !t.titulo.trim()}
          onClick={() => correr(() => nuevaTarea(t.titulo, t.vence), () => setT({ titulo: "", vence: "" }))}>Agregar</button>
      </div>
      {grupos.map(([titulo, lista]) => (
        <section key={titulo} className="mt-6 rounded-2xl border border-white/10 bg-void-card p-5">
          <h2 className={`text-sm font-medium uppercase tracking-wide ${titulo === "Vencidas" && lista.length ? "text-red-300" : "text-white/45"}`}>{titulo} ({lista.length})</h2>
          <ul className="mt-2 divide-y divide-white/10">{lista.length === 0 ? <li className="py-2 text-sm text-white/40">Nada.</li> : lista.map(fila)}</ul>
        </section>
      ))}
      {hechas.length > 0 && (
        <section className="mt-6 rounded-2xl border border-white/10 bg-void-card p-5">
          <h2 className="text-sm font-medium uppercase tracking-wide text-white/45">Hechas recientemente</h2>
          <ul className="mt-2 divide-y divide-white/10">{hechas.map(fila)}</ul>
        </section>
      )}
    </main>
  );
}
