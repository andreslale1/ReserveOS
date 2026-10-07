"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { Campo, enfocarPrimerError, inputOwner } from "@/components/owner/campo";
import { actualizarTicket, responderTicket } from "../actions";

export type Detalle = {
  ticket: { id: string; estudio: string; asunto: string; descripcion: string | null; prioridad: string; estado: string; asignado_a: string | null; causa: string | null; sede_nombre: string | null; version: string | null; sla_vence: string; abierto_por_nombre: string | null };
  mensajes: { id: string; autor_nombre: string | null; es_equipo: boolean; interno: boolean; mensaje: string; created_at: string }[];
};

export default function TicketView({ d }: { d: Detalle }) {
  const t = d.ticket;
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const gestion = useRef<HTMLFormElement>(null);
  const respuesta = useRef<HTMLFormElement>(null);
  const [f, setF] = useState({ estado: t.estado, prioridad: t.prioridad, asignado: t.asignado_a ?? "", causa: t.causa ?? "" });
  const [r, setR] = useState({ texto: "", interno: false });

  function correr(fn: () => Promise<{ error: string | null }>, ok: string, despues?: () => void) {
    setMsg(null);
    startTransition(async () => { const x = await fn(); if (x.error) setMsg({ ok: false, texto: x.error }); else { setMsg({ ok: true, texto: ok }); despues?.(); } });
  }

  return (
    <main className="mx-auto grid max-w-5xl gap-6 px-6 py-8 md:px-10 lg:grid-cols-[1fr_300px]">
      <div>
        <Link href="/owner/soporte" className="text-sm text-white/70 hover:text-white">← Soporte</Link>
        <h1 className="mt-2 text-xl font-semibold">{t.asunto}</h1>
        <p className="text-sm text-white/70">{t.estudio}{t.sede_nombre ? ` · ${t.sede_nombre}` : ""}{t.version ? ` · versión ${t.version}` : ""} · abierto por {t.abierto_por_nombre ?? "—"}</p>
        <div aria-live="polite">{msg && <p role={msg.ok ? "status" : "alert"} className={`mt-3 rounded-xl px-4 py-3 text-sm ${msg.ok ? "bg-lime/15 text-lime" : "bg-red-400/15 text-red-200"}`}>{msg.texto}</p>}</div>
        <ul className="mt-5 space-y-3">
          {d.mensajes.map((m) => (
            <li key={m.id} className={`rounded-2xl border p-4 text-sm ${m.interno ? "border-yellow-300/30 bg-yellow-300/5" : m.es_equipo ? "border-lime/30 bg-void-card" : "border-white/10 bg-void-card"}`}>
              <p className="text-xs text-white/65">{m.autor_nombre ?? "—"} · {m.es_equipo ? "equipo" : "estudio"}{m.interno ? " · NOTA INTERNA (el estudio no la ve)" : ""} · {new Date(m.created_at).toLocaleString("es-GT", { timeZone: "America/Guatemala", dateStyle: "short", timeStyle: "short" })}</p>
              <p className="mt-1 whitespace-pre-wrap text-white/85">{m.mensaje}</p>
            </li>
          ))}
        </ul>
        <form ref={respuesta} noValidate className="mt-5" onSubmit={(e) => {
          e.preventDefault();
          if (!r.texto.trim()) { setErrs({ texto: "Escribe el mensaje antes de enviar." }); setTimeout(() => enfocarPrimerError(respuesta.current), 0); return; }
          setErrs({});
          correr(() => responderTicket(t.id, r.texto, r.interno), "Enviado.", () => setR({ texto: "", interno: false }));
        }}>
          <Campo label="Respuesta" requerido error={errs.texto}>{(p) => <textarea {...p} rows={3} className={inputOwner} value={r.texto} onChange={(e) => setR({ ...r, texto: e.target.value })} />}</Campo>
          <div className="mt-2 flex items-center gap-4">
            <label className="flex items-center gap-2 text-xs text-white/75"><input type="checkbox" checked={r.interno} onChange={(e) => setR({ ...r, interno: e.target.checked })} /> Nota interna (el estudio no la ve)</label>
            <button type="submit" className="rounded-full bg-lime px-4 py-1.5 text-sm font-semibold text-void disabled:opacity-50" disabled={isPending}>{isPending ? "Enviando…" : "Enviar"}</button>
          </div>
        </form>
      </div>
      <aside className="h-fit rounded-2xl border border-white/15 bg-void-card p-5">
        <h2 className="text-sm font-semibold">Gestión</h2>
        <form ref={gestion} noValidate className="mt-3 grid gap-3" onSubmit={(e) => {
          e.preventDefault();
          if (["resuelto", "cerrado"].includes(f.estado) && !f.causa.trim()) { setErrs({ causa: "Indica la causa para poder resolver o cerrar el ticket." }); setTimeout(() => enfocarPrimerError(gestion.current), 0); return; }
          setErrs({});
          correr(() => actualizarTicket(t.id, f.estado, f.prioridad, f.asignado, f.causa), "Ticket actualizado.");
        }}>
          <Campo label="Estado">{(p) => <select {...p} className={inputOwner} value={f.estado} onChange={(e) => setF({ ...f, estado: e.target.value })}>{["abierto", "en_curso", "esperando", "resuelto", "cerrado"].map((x) => <option key={x}>{x}</option>)}</select>}</Campo>
          <Campo label="Prioridad">{(p) => <select {...p} className={inputOwner} value={f.prioridad} onChange={(e) => setF({ ...f, prioridad: e.target.value })}>{["baja", "normal", "alta", "urgente"].map((x) => <option key={x}>{x}</option>)}</select>}</Campo>
          <Campo label="Asignado a">{(p) => <input {...p} className={inputOwner} value={f.asignado} onChange={(e) => setF({ ...f, asignado: e.target.value })} />}</Campo>
          <Campo label="Causa" requerido={["resuelto", "cerrado"].includes(f.estado)} error={errs.causa} ayuda="Obligatoria al resolver o cerrar.">{(p) => <input {...p} className={inputOwner} placeholder="código, configuración, proveedor…" value={f.causa} onChange={(e) => setF({ ...f, causa: e.target.value })} />}</Campo>
          <button type="submit" className="w-full rounded-full border border-white/25 px-4 py-2 text-sm disabled:opacity-50" disabled={isPending}>{isPending ? "Guardando…" : "Guardar cambios"}</button>
        </form>
        <p className="mt-3 text-xs text-white/65">Responder antes de {new Date(t.sla_vence).toLocaleString("es-GT", { timeZone: "America/Guatemala", dateStyle: "short", timeStyle: "short" })}</p>
      </aside>
    </main>
  );
}
