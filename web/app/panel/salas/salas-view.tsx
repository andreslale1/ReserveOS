"use client";

import { useState, useTransition } from "react";
import { guardarSala } from "./actions";

type Sala = { id: string; sede_id: string; nombre: string; capacidad: number; equipamiento: string | null; activa: boolean };
const input = "mt-1 w-full rounded-lg border border-white/15 bg-cream px-3 py-2 text-ink outline-none focus:border-ink/30";

export default function SalasView({ sedes, salas }: { sedes: { id: string; name: string }[]; salas: Sala[] }) {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [f, setF] = useState({ sedeId: sedes[0]?.id ?? "", nombre: "", capacidad: "6", equipamiento: "" });

  function correr(fn: () => Promise<{ error: string | null }>, ok: string, despues?: () => void) {
    setMsg(null);
    startTransition(async () => { const r = await fn(); if (r.error) setMsg({ ok: false, texto: r.error }); else { setMsg({ ok: true, texto: ok }); despues?.(); } });
  }
  return (
    <main className="min-h-screen bg-cream">
      <header className="border-b border-white/10 bg-card px-6 py-6 md:px-10">
        <h1 className="font-serif text-2xl text-ink md:text-3xl">Salas y espacios</h1>
        <p className="mt-1 text-sm text-ink/60">Asigna una sala a cada clase. ReserveOS impide dos clases a la vez en la misma sala.</p>
      </header>
      <div className="mx-auto grid max-w-3xl gap-6 px-6 py-8 md:px-10">
        {msg && <p className={`rounded-xl px-4 py-3 text-sm ${msg.ok ? "bg-sage-tint text-sage" : "bg-peach-tint text-ink"}`}>{msg.texto}</p>}
        {sedes.map((s) => (
          <section key={s.id} className="rounded-2xl border border-white/10 bg-card p-5">
            <h2 className="text-base font-semibold text-ink">{s.name}</h2>
            <ul className="mt-2 divide-y divide-white/10">
              {salas.filter((x) => x.sede_id === s.id).length === 0 && <li className="py-2 text-sm text-ink/50">Sin salas.</li>}
              {salas.filter((x) => x.sede_id === s.id).map((x) => (
                <li key={x.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span className={x.activa ? "text-ink" : "text-ink/40"}>{x.nombre} · {x.capacidad} lugares{x.equipamiento ? ` · ${x.equipamiento}` : ""}{x.activa ? "" : " · inactiva"}</span>
                  <button className="text-xs text-ink/50 hover:text-ink" disabled={isPending} onClick={() => correr(() => guardarSala({ id: x.id, sedeId: x.sede_id, nombre: x.nombre, capacidad: x.capacidad, equipamiento: x.equipamiento ?? "", activa: !x.activa }), x.activa ? "Sala desactivada." : "Sala activada.")}>{x.activa ? "Desactivar" : "Activar"}</button>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <section className="rounded-2xl border border-white/10 bg-card p-5">
          <h2 className="text-base font-semibold text-ink">Nueva sala</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-ink/60">Sede<select className={input} value={f.sedeId} onChange={(e) => setF({ ...f, sedeId: e.target.value })}>{sedes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
            <label className="text-sm text-ink/60">Nombre<input className={input} value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></label>
            <label className="text-sm text-ink/60">Capacidad<input type="number" min={1} className={input} value={f.capacidad} onChange={(e) => setF({ ...f, capacidad: e.target.value })} /></label>
            <label className="text-sm text-ink/60">Equipamiento<input className={input} placeholder="6 reformers, 2 cadillacs…" value={f.equipamiento} onChange={(e) => setF({ ...f, equipamiento: e.target.value })} /></label>
          </div>
          <button className="press-spring mt-4 rounded-full bg-ink px-4 py-2 text-sm font-medium text-cream disabled:opacity-50" disabled={isPending || !f.nombre.trim()}
            onClick={() => correr(() => guardarSala({ id: null, sedeId: f.sedeId, nombre: f.nombre, capacidad: Number(f.capacidad || 1), equipamiento: f.equipamiento, activa: true }), "Sala creada.", () => setF({ ...f, nombre: "", equipamiento: "" }))}>Crear sala</button>
        </section>
      </div>
    </main>
  );
}
