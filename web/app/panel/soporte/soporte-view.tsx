"use client";

import { useState, useTransition } from "react";
import { abrirTicket, escribirTicket, verTicket } from "./actions";

type T = { id: string; asunto: string; prioridad: string; estado: string; created_at: string };
type Det = Awaited<ReturnType<typeof verTicket>>;
const input = "mt-1 w-full rounded-lg border border-white/15 bg-cream px-3 py-2 text-ink outline-none focus:border-ink/30";
const ESTADO: Record<string, string> = { abierto: "Abierto", en_curso: "En revisión", esperando: "Esperando tu respuesta", resuelto: "Resuelto", cerrado: "Cerrado" };

export default function SoporteView({ tenantId, tickets }: { tenantId: string; tickets: T[] }) {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [f, setF] = useState({ asunto: "", descripcion: "", prioridad: "normal" });
  const [abierto, setAbierto] = useState<string | null>(null);
  const [det, setDet] = useState<Det>(null);
  const [resp, setResp] = useState("");

  function correr(fn: () => Promise<{ error: string | null }>, ok: string, despues?: () => void) {
    setMsg(null);
    startTransition(async () => { const r = await fn(); if (r.error) setMsg({ ok: false, texto: r.error }); else { setMsg({ ok: true, texto: ok }); despues?.(); } });
  }
  function abrir(id: string) {
    setAbierto(id);
    startTransition(async () => setDet(await verTicket(id)));
  }

  return (
    <main className="min-h-screen bg-cream">
      <header className="border-b border-white/10 bg-card px-6 py-6 md:px-10">
        <h1 className="font-serif text-2xl text-ink md:text-3xl">Soporte</h1>
        <p className="mt-1 text-sm text-ink/60">Escríbele al equipo de ReserveOS. Te respondemos aquí mismo.</p>
      </header>
      <div className="mx-auto grid max-w-3xl gap-6 px-6 py-8 md:px-10">
        {msg && <p className={`rounded-xl px-4 py-3 text-sm ${msg.ok ? "bg-sage-tint text-sage" : "bg-peach-tint text-ink"}`}>{msg.texto}</p>}
        <section className="rounded-2xl border border-white/10 bg-card p-5">
          <h2 className="text-base font-semibold text-ink">Nuevo caso</h2>
          <label className="mt-3 block text-sm text-ink/60">Asunto<input className={input} value={f.asunto} onChange={(e) => setF({ ...f, asunto: e.target.value })} /></label>
          <label className="mt-3 block text-sm text-ink/60">Qué pasa<textarea rows={3} className={input} value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} /></label>
          <label className="mt-3 block text-sm text-ink/60">Urgencia
            <select className={input} value={f.prioridad} onChange={(e) => setF({ ...f, prioridad: e.target.value })}>
              <option value="baja">Puede esperar</option><option value="normal">Normal</option><option value="alta">Alta: afecta mi operación</option><option value="urgente">Urgente: no puedo operar</option>
            </select></label>
          <button className="press-spring mt-4 rounded-full bg-ink px-4 py-2 text-sm font-medium text-cream disabled:opacity-50" disabled={isPending || f.asunto.trim().length < 4}
            onClick={() => correr(() => abrirTicket(tenantId, f.asunto, f.descripcion, f.prioridad), "Caso enviado. Te responderemos aquí.", () => setF({ asunto: "", descripcion: "", prioridad: "normal" }))}>Enviar</button>
          <p className="mt-2 text-xs text-ink/45">No incluyas datos personales de clientas; el equipo no los necesita para ayudarte.</p>
        </section>
        <section className="rounded-2xl border border-white/10 bg-card p-5">
          <h2 className="text-base font-semibold text-ink">Mis casos</h2>
          <ul className="mt-3 divide-y divide-white/10">
            {tickets.length === 0 && <li className="py-3 text-sm text-ink/50">Todavía no has abierto casos.</li>}
            {tickets.map((t) => (
              <li key={t.id} className="py-3">
                <button className="flex w-full items-center justify-between text-left text-sm" onClick={() => (abierto === t.id ? setAbierto(null) : abrir(t.id))}>
                  <span className="font-medium text-ink">{t.asunto}</span><span className="text-xs text-ink/55">{ESTADO[t.estado] ?? t.estado}</span>
                </button>
                {abierto === t.id && det && (
                  <div className="mt-3">
                    <ul className="space-y-2">
                      {det.mensajes.map((m, i) => (
                        <li key={i} className={`rounded-xl p-3 text-sm ${m.es_equipo ? "bg-sage-tint" : "bg-cream"}`}>
                          <p className="text-xs text-ink/50">{m.es_equipo ? "Equipo ReserveOS" : m.autor_nombre ?? "Tú"} · {new Date(m.created_at).toLocaleString("es-GT", { timeZone: "America/Guatemala", dateStyle: "short", timeStyle: "short" })}</p>
                          <p className="whitespace-pre-wrap text-ink">{m.mensaje}</p>
                        </li>
                      ))}
                    </ul>
                    {!["cerrado"].includes(t.estado) && (
                      <div className="mt-3 flex gap-2">
                        <input className={`${input} mt-0 flex-1`} placeholder="Escribe una respuesta…" value={resp} onChange={(e) => setResp(e.target.value)} />
                        <button className="press-spring rounded-full bg-ink px-4 py-2 text-sm text-cream disabled:opacity-50" disabled={isPending || !resp.trim()}
                          onClick={() => correr(() => escribirTicket(t.id, resp), "Enviado.", () => { setResp(""); abrir(t.id); })}>Enviar</button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
