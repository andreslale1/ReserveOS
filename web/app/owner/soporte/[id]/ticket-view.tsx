"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { actualizarTicket, responderTicket } from "../actions";

export type Detalle = {
  ticket: { id: string; estudio: string; asunto: string; descripcion: string | null; prioridad: string; estado: string; asignado_a: string | null; causa: string | null; sede_nombre: string | null; version: string | null; sla_vence: string; abierto_por_nombre: string | null };
  mensajes: { id: string; autor_nombre: string | null; es_equipo: boolean; interno: boolean; mensaje: string; created_at: string }[];
};
const input = "w-full rounded-lg border border-white/15 bg-void px-3 py-2 text-sm text-white outline-none focus:border-lime/60";

export default function TicketView({ d }: { d: Detalle }) {
  const t = d.ticket;
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [f, setF] = useState({ estado: t.estado, prioridad: t.prioridad, asignado: t.asignado_a ?? "", causa: t.causa ?? "" });
  const [r, setR] = useState({ texto: "", interno: false });

  function correr(fn: () => Promise<{ error: string | null }>, ok: string, despues?: () => void) {
    setMsg(null);
    startTransition(async () => { const x = await fn(); if (x.error) setMsg(x.error); else { setMsg(ok); despues?.(); } });
  }

  return (
    <main className="mx-auto grid max-w-5xl gap-6 px-6 py-8 md:px-10 lg:grid-cols-[1fr_300px]">
      <div>
        <Link href="/owner/soporte" className="text-sm text-white/50 hover:text-white">← Soporte</Link>
        <h1 className="mt-2 text-xl font-semibold">{t.asunto}</h1>
        <p className="text-sm text-white/50">{t.estudio}{t.sede_nombre ? ` · ${t.sede_nombre}` : ""}{t.version ? ` · versión ${t.version}` : ""} · abierto por {t.abierto_por_nombre ?? "—"}</p>
        {msg && <p className="mt-3 rounded-xl bg-white/10 px-4 py-3 text-sm">{msg}</p>}
        <ul className="mt-5 space-y-3">
          {d.mensajes.map((m) => (
            <li key={m.id} className={`rounded-2xl border p-4 text-sm ${m.interno ? "border-yellow-300/30 bg-yellow-300/5" : m.es_equipo ? "border-lime/30 bg-void-card" : "border-white/10 bg-void-card"}`}>
              <p className="text-xs text-white/45">{m.autor_nombre ?? "—"} · {m.es_equipo ? "equipo" : "estudio"}{m.interno ? " · NOTA INTERNA (el estudio no la ve)" : ""} · {new Date(m.created_at).toLocaleString("es-GT", { timeZone: "America/Guatemala", dateStyle: "short", timeStyle: "short" })}</p>
              <p className="mt-1 whitespace-pre-wrap text-white/85">{m.mensaje}</p>
            </li>
          ))}
        </ul>
        <div className="mt-5">
          <textarea rows={3} className={input} placeholder="Escribe una respuesta…" value={r.texto} onChange={(e) => setR({ ...r, texto: e.target.value })} />
          <div className="mt-2 flex items-center gap-4">
            <label className="flex items-center gap-2 text-xs text-white/60"><input type="checkbox" checked={r.interno} onChange={(e) => setR({ ...r, interno: e.target.checked })} /> Nota interna</label>
            <button className="rounded-full bg-lime px-4 py-1.5 text-sm font-semibold text-void disabled:opacity-50" disabled={isPending || !r.texto.trim()}
              onClick={() => correr(() => responderTicket(t.id, r.texto, r.interno), "Enviado.", () => setR({ texto: "", interno: false }))}>Enviar</button>
          </div>
        </div>
      </div>
      <aside className="h-fit rounded-2xl border border-white/10 bg-void-card p-5">
        <h2 className="text-sm font-semibold">Gestión</h2>
        <label className="mt-3 block text-xs text-white/50">Estado
          <select className={`${input} mt-1`} value={f.estado} onChange={(e) => setF({ ...f, estado: e.target.value })}>{["abierto", "en_curso", "esperando", "resuelto", "cerrado"].map((x) => <option key={x}>{x}</option>)}</select></label>
        <label className="mt-3 block text-xs text-white/50">Prioridad
          <select className={`${input} mt-1`} value={f.prioridad} onChange={(e) => setF({ ...f, prioridad: e.target.value })}>{["baja", "normal", "alta", "urgente"].map((x) => <option key={x}>{x}</option>)}</select></label>
        <label className="mt-3 block text-xs text-white/50">Asignado a<input className={`${input} mt-1`} value={f.asignado} onChange={(e) => setF({ ...f, asignado: e.target.value })} /></label>
        <label className="mt-3 block text-xs text-white/50">Causa (obligatoria al resolver)<input className={`${input} mt-1`} placeholder="código, configuración, proveedor…" value={f.causa} onChange={(e) => setF({ ...f, causa: e.target.value })} /></label>
        <button className="mt-4 w-full rounded-full border border-white/20 px-4 py-2 text-sm disabled:opacity-50" disabled={isPending}
          onClick={() => correr(() => actualizarTicket(t.id, f.estado, f.prioridad, f.asignado, f.causa), "Ticket actualizado.")}>Guardar cambios</button>
        <p className="mt-3 text-xs text-white/40">Responder antes de {new Date(t.sla_vence).toLocaleString("es-GT", { timeZone: "America/Guatemala", dateStyle: "short", timeStyle: "short" })}</p>
      </aside>
    </main>
  );
}
