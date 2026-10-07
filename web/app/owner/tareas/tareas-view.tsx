"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { Campo, enfocarPrimerError, inputOwner } from "@/components/owner/campo";
import { EstadoVacio } from "@/components/owner/estado-vacio";
import { marcarTarea, nuevaTarea, posponerTarea } from "./actions";

export type Tarea = { id: string; titulo: string; vence: string | null; estado: string; responsable: string | null; lead_id: string | null; empresa: string | null; tenant_id: string | null; estudio: string | null; prioridad: string; responsable_id: string | null };
export type Opcion = { id: string; nombre: string };
const PRIO: Record<string, string> = { alta: "text-red-300", normal: "text-white/70", baja: "text-white/55" };
const fecha = (iso: string) => iso.split("-").reverse().join("/");
const hoyGT = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guatemala" }).format(new Date());
const vacio = { titulo: "", vence: "", prioridad: "normal", responsableId: "", leadId: "", tenantId: "" };

export default function TareasView({ tareas, filtro, yo, responsables, leads, estudios }: { tareas: Tarea[]; filtro?: "vencidas" | "hoy"; yo: string; responsables: Opcion[]; leads: Opcion[]; estudios: Opcion[] }) {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [t, setT] = useState({ ...vacio, responsableId: yo });
  const [errTitulo, setErrTitulo] = useState<string | null>(null);
  const [solo, setSolo] = useState<"todas" | "mias">("todas");
  const form = useRef<HTMLFormElement>(null);
  const hoy = hoyGT();
  const visibles = tareas.filter((x) => solo === "todas" || x.responsable_id === yo);
  const pend = visibles.filter((x) => x.estado === "pendiente");
  const hechas = visibles.filter((x) => x.estado === "hecha").slice(0, 15);
  const todos: [string, string, Tarea[]][] = [
    ["vencidas", "Vencidas", pend.filter((x) => x.vence && x.vence < hoy)],
    ["hoy", "Hoy", pend.filter((x) => x.vence === hoy)],
    ["proximas", "Próximas y sin fecha", pend.filter((x) => !x.vence || x.vence > hoy)],
  ];
  const grupos = filtro ? todos.filter((g) => g[0] === filtro) : todos;

  function correr(fn: () => Promise<{ error: string | null }>, ok: string, despues?: () => void) {
    setMsg(null);
    startTransition(async () => { const r = await fn(); if (r.error) setMsg({ ok: false, texto: r.error }); else { setMsg({ ok: true, texto: ok }); despues?.(); } });
  }
  function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (t.titulo.trim().length < 3) { setErrTitulo("Escribe qué hay que hacer (mínimo 3 letras)."); setTimeout(() => enfocarPrimerError(form.current), 0); return; }
    setErrTitulo(null);
    correr(() => nuevaTarea(t), "Tarea creada.", () => setT({ ...vacio, responsableId: yo }));
  }
  const fila = (x: Tarea) => (
    <li key={x.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
      <input type="checkbox" aria-label={`Marcar «${x.titulo}» como ${x.estado === "hecha" ? "pendiente" : "hecha"}`} className="h-4 w-4" checked={x.estado === "hecha"} disabled={isPending}
        onChange={(e) => correr(() => marcarTarea(x.id, e.target.checked), e.target.checked ? "Tarea completada." : "Tarea reabierta.")} />
      <span className={x.estado === "hecha" ? "text-white/55 line-through" : ""}>{x.titulo}</span>
      <span className={`text-xs ${PRIO[x.prioridad] ?? ""}`}>{x.prioridad}</span>
      {x.lead_id && x.empresa && <Link href={`/owner/pipeline/${x.lead_id}`} className="text-xs text-lime underline-offset-2 hover:underline">{x.empresa}</Link>}
      {x.estudio && <span className="text-xs text-white/65">{x.estudio}</span>}
      <span className="text-xs text-white/60">{x.responsable ?? "Sin responsable"}</span>
      <span className="ml-auto flex items-center gap-2 text-xs text-white/65">
        {x.vence ? fecha(x.vence) : "sin fecha"}
        {x.estado === "pendiente" && (
          <>
            <button type="button" disabled={isPending} className="rounded-full border border-white/25 px-2.5 py-1 text-white/80 hover:text-white disabled:opacity-50" onClick={() => correr(() => posponerTarea(x.id, 1), "Pospuesta 1 día.")}>+1 día</button>
            <button type="button" disabled={isPending} className="rounded-full border border-white/25 px-2.5 py-1 text-white/80 hover:text-white disabled:opacity-50" onClick={() => correr(() => posponerTarea(x.id, 7), "Pospuesta 7 días.")}>+7 días</button>
          </>
        )}
      </span>
    </li>
  );

  return (
    <main className="mx-auto max-w-4xl px-6 py-8 md:px-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Tareas</h1>
          <p className="mt-1 text-sm text-white/70">Pendientes del equipo, con responsable y prioridad. Fechas en hora de Guatemala.{filtro && <> Filtro: <strong>{filtro}</strong>. <Link href="/owner/tareas" className="text-lime">Quitar filtro</Link></>}</p>
        </div>
        <div role="group" aria-label="Ver tareas" className="flex gap-1 text-xs">
          {(["todas", "mias"] as const).map((v) => (
            <button key={v} type="button" aria-pressed={solo === v} onClick={() => setSolo(v)} className={`rounded-full border px-3 py-1.5 ${solo === v ? "border-lime bg-lime/15 text-lime" : "border-white/25 text-white/80"}`}>{v === "todas" ? "Todas" : "Solo las mías"}</button>
          ))}
        </div>
      </div>

      <div aria-live="polite">{msg && <p role={msg.ok ? "status" : "alert"} className={`mt-4 rounded-xl px-4 py-3 text-sm ${msg.ok ? "bg-lime/15 text-lime" : "bg-red-400/15 text-red-200"}`}>{msg.texto}</p>}</div>

      <form ref={form} onSubmit={enviar} noValidate className="mt-4 grid gap-3 rounded-2xl border border-white/15 bg-void-card p-5 sm:grid-cols-2 lg:grid-cols-3">
        <Campo label="Tarea" requerido error={errTitulo} className="sm:col-span-2 lg:col-span-3">
          {(p) => <input {...p} className={inputOwner} value={t.titulo} onChange={(e) => setT({ ...t, titulo: e.target.value })} placeholder="Ej. Llamar al gerente de Studio Luna" />}
        </Campo>
        <Campo label="Fecha límite">{(p) => <input {...p} type="date" className={inputOwner} value={t.vence} onChange={(e) => setT({ ...t, vence: e.target.value })} />}</Campo>
        <Campo label="Prioridad">{(p) => <select {...p} className={inputOwner} value={t.prioridad} onChange={(e) => setT({ ...t, prioridad: e.target.value })}><option value="baja">Baja</option><option value="normal">Normal</option><option value="alta">Alta</option></select>}</Campo>
        <Campo label="Responsable">{(p) => <select {...p} className={inputOwner} value={t.responsableId} onChange={(e) => setT({ ...t, responsableId: e.target.value })}>{responsables.map((r) => <option key={r.id} value={r.id}>{r.nombre}{r.id === yo ? " (yo)" : ""}</option>)}</select>}</Campo>
        <Campo label="Oportunidad vinculada">{(p) => <select {...p} className={inputOwner} value={t.leadId} onChange={(e) => setT({ ...t, leadId: e.target.value })}><option value="">Ninguna</option>{leads.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}</select>}</Campo>
        <Campo label="Estudio vinculado">{(p) => <select {...p} className={inputOwner} value={t.tenantId} onChange={(e) => setT({ ...t, tenantId: e.target.value })}><option value="">Ninguno</option>{estudios.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}</select>}</Campo>
        <div className="flex items-end"><button type="submit" disabled={isPending} className="rounded-full bg-lime px-5 py-2 text-sm font-semibold text-void disabled:opacity-50">{isPending ? "Guardando…" : "Agregar tarea"}</button></div>
      </form>

      {grupos.map(([clave, titulo, lista]) => (
        <section key={clave} aria-labelledby={`g-${clave}`} className="mt-6 rounded-2xl border border-white/15 bg-void-card p-5">
          <h2 id={`g-${clave}`} className={`text-sm font-semibold uppercase tracking-wide ${clave === "vencidas" && lista.length ? "text-red-300" : "text-white/70"}`}>{titulo} ({lista.length})</h2>
          {lista.length === 0 ? <div className="mt-3"><EstadoVacio titulo={clave === "vencidas" ? "Nada vencido" : "Nada por aquí"} texto="Agrega una tarea con el formulario de arriba." /></div> : <ul className="mt-2 divide-y divide-white/10">{lista.map(fila)}</ul>}
        </section>
      ))}
      {!filtro && hechas.length > 0 && (
        <section aria-labelledby="g-hechas" className="mt-6 rounded-2xl border border-white/15 bg-void-card p-5">
          <h2 id="g-hechas" className="text-sm font-semibold uppercase tracking-wide text-white/70">Hechas recientemente</h2>
          <ul className="mt-2 divide-y divide-white/10">{hechas.map(fila)}</ul>
        </section>
      )}
    </main>
  );
}
