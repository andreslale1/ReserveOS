"use client";

import { useState, useTransition } from "react";
import { guardarMiembro, quitarMiembro } from "./actions";

export type Miembro = { user_id: string; nombre: string | null; email: string; rol: string };
const ROLES: [string, string][] = [
  ["operador", "Operador — todo"], ["ventas", "Ventas — CRM y propuestas"], ["marketing", "Marketing B2B — campañas"],
  ["implementacion", "Implementación — altas y diagnóstico"], ["finanzas", "Finanzas — cobros y costos"],
  ["soporte", "Soporte — tickets y salud"], ["ingenieria", "Ingeniería — salud e incidentes"], ["auditor", "Auditor — solo lectura de registros"],
];
const input = "rounded-lg border border-white/15 bg-void px-3 py-2 text-sm text-white outline-none focus:border-lime/60";

export default function EquipoView({ miembros, puedeEditar }: { miembros: Miembro[]; puedeEditar: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [f, setF] = useState({ email: "", nombre: "", rol: "ventas" });

  function correr(fn: () => Promise<{ error: string | null }>, ok: string, despues?: () => void) {
    setMsg(null);
    startTransition(async () => { const r = await fn(); if (r.error) setMsg(r.error); else { setMsg(ok); despues?.(); } });
  }
  return (
    <main className="mx-auto max-w-3xl px-6 py-8 md:px-10">
      <h1 className="text-2xl font-semibold">Equipo de ReserveOS</h1>
      <p className="mt-1 text-sm text-white/50">Cada persona ve solo lo de su rol. Tener varios roles no convierte a nadie en superusuario.</p>
      {msg && <p className="mt-4 rounded-xl bg-white/10 px-4 py-3 text-sm">{msg}</p>}
      <ul className="mt-6 divide-y divide-white/10 rounded-2xl border border-white/10 bg-void-card px-5">
        {miembros.map((m) => (
          <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
            <div><p className="font-medium">{m.nombre ?? m.email}</p><p className="text-xs text-white/50">{m.email}</p></div>
            <div className="flex items-center gap-3">
              {puedeEditar ? (
                <select className={input} value={m.rol} disabled={isPending} onChange={(e) => correr(() => guardarMiembro(m.email, m.nombre ?? "", e.target.value), "Rol actualizado.")}>
                  {ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              ) : <span className="text-xs text-lime">{m.rol}</span>}
              {puedeEditar && <button className="text-xs text-white/40 hover:text-white" disabled={isPending} onClick={() => correr(() => quitarMiembro(m.user_id), "Persona quitada del equipo.")}>Quitar</button>}
            </div>
          </li>
        ))}
      </ul>
      {puedeEditar && (
        <section className="mt-6 rounded-2xl border border-white/10 bg-void-card p-5">
          <h2 className="text-base font-semibold">Agregar persona</h2>
          <p className="mt-1 text-xs text-white/45">Debe haber creado antes su cuenta con ese correo.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input className={`${input} flex-1`} placeholder="Correo" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
            <input className={input} placeholder="Nombre" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
            <select className={input} value={f.rol} onChange={(e) => setF({ ...f, rol: e.target.value })}>{ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            <button className="rounded-full bg-lime px-4 py-2 text-sm font-semibold text-void disabled:opacity-50" disabled={isPending || !f.email.includes("@")}
              onClick={() => correr(() => guardarMiembro(f.email, f.nombre, f.rol), "Agregado.", () => setF({ email: "", nombre: "", rol: "ventas" }))}>Agregar</button>
          </div>
        </section>
      )}
    </main>
  );
}
