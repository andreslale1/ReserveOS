"use client";

import { useState, useTransition } from "react";
import { crearDelegacion, revocarDelegacion } from "./actions";

export type Delegacion = { id: string; persona: string | null; rol: string; action_id: string; sedes: string[] | null; inicio: string; vence: string | null; motivo: string; revocada_at: string | null; activa: boolean };

const ACCION: Record<string, string> = {
  P04: "Editar marca y configuración", P05: "Crear o cerrar sedes", P06: "Invitar personal y asignar sedes", P14: "Cambiar cupos y cerrar clases",
  P23: "Crear paquetes y precios", P25: "Regalar paquetes y ajustar créditos", P26: "Cambiar cobertura de una membresía", P30: "Aprobar transferencias",
  P31: "Reembolsos", P33: "Ver finanzas consolidadas", P35: "Registrar gastos", P36: "Activos, pasivos e IVA", P37: "Exportar finanzas",
  P38: "Exportar clientas", P40: "Crear descuentos y regalos", P42: "Campañas", P43: "Ver auditoría",
};
const ROL: Record<string, string> = { gerente_general: "Gerente general", gerente_regional: "Gerencia regional", admin_sede: "Admin de sede", recepcion: "Recepción", contadora: "Contadora", marketing: "Marketing", instructora: "Instructora" };
const input = "mt-1 w-full rounded-lg border border-white/15 bg-cream px-3 py-2 text-ink outline-none focus:border-ink/30";

export default function DelegacionesView({ tenantId, puedeDelegar, delegaciones, acciones, personal, sedes }: {
  tenantId: string; puedeDelegar: boolean; delegaciones: Delegacion[]; acciones: { role: string; action_id: string }[];
  personal: { id: string; nombre: string | null; role: string }[]; sedes: { id: string; name: string }[];
}) {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [f, setF] = useState({ a: "persona" as "persona" | "rol", persona: "", rol: "", accion: "", sedeIds: [] as string[], vence: "", motivo: "" });

  const rolBenef = f.a === "persona" ? personal.find((p) => p.id === f.persona)?.role : f.rol;
  const accionesPosibles = acciones.filter((x) => x.role === rolBenef).map((x) => x.action_id);
  const rolesDelegables = Array.from(new Set(acciones.map((x) => x.role)));

  function correr(fn: () => Promise<{ error: string | null }>, ok: string, despues?: () => void) {
    setMsg(null);
    startTransition(async () => { const r = await fn(); if (r.error) setMsg({ ok: false, texto: r.error }); else { setMsg({ ok: true, texto: ok }); despues?.(); } });
  }
  return (
    <main className="min-h-screen bg-cream">
      <header className="border-b border-white/10 bg-card px-6 py-6 md:px-10">
        <h1 className="font-serif text-2xl text-ink md:text-3xl">Delegaciones</h1>
        <p className="mt-1 text-sm text-ink/60">Algunas acciones sensibles (reembolsos, descuentos, cambios de marca…) no las puede hacer nadie más sin que tú lo autorices. Aquí decides a quién, en qué sedes y hasta cuándo.</p>
      </header>
      <div className="mx-auto grid max-w-4xl gap-6 px-6 py-8 md:px-10">
        {msg && <p className={`rounded-xl px-4 py-3 text-sm ${msg.ok ? "bg-sage-tint text-sage" : "bg-peach-tint text-ink"}`}>{msg.texto}</p>}
        {puedeDelegar && (
          <section className="rounded-2xl border border-white/10 bg-card p-5">
            <h2 className="text-base font-semibold text-ink">Nueva delegación</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-sm text-ink/60">¿A quién?
                <select className={input} value={f.a} onChange={(e) => setF({ ...f, a: e.target.value as "persona" | "rol", accion: "" })}>
                  <option value="persona">A una persona</option><option value="rol">A todas las personas de un rol</option>
                </select></label>
              {f.a === "persona" ? (
                <label className="text-sm text-ink/60">Persona
                  <select className={input} value={f.persona} onChange={(e) => setF({ ...f, persona: e.target.value, accion: "" })}>
                    <option value="">Elige…</option>{personal.map((p) => <option key={p.id} value={p.id}>{p.nombre ?? "Sin nombre"} · {ROL[p.role] ?? p.role}</option>)}
                  </select></label>
              ) : (
                <label className="text-sm text-ink/60">Rol
                  <select className={input} value={f.rol} onChange={(e) => setF({ ...f, rol: e.target.value, accion: "" })}>
                    <option value="">Elige…</option>{rolesDelegables.map((r) => <option key={r} value={r}>{ROL[r] ?? r}</option>)}
                  </select></label>
              )}
              <label className="text-sm text-ink/60">Acción
                <select className={input} value={f.accion} onChange={(e) => setF({ ...f, accion: e.target.value })} disabled={!rolBenef}>
                  <option value="">{rolBenef ? "Elige…" : "Primero elige a quién"}</option>
                  {accionesPosibles.map((a) => <option key={a} value={a}>{ACCION[a] ?? a}</option>)}
                </select></label>
              <label className="text-sm text-ink/60">Vence (opcional)<input type="date" className={input} value={f.vence} onChange={(e) => setF({ ...f, vence: e.target.value })} /></label>
              <label className="text-sm text-ink/60 sm:col-span-2">Motivo<input className={input} value={f.motivo} onChange={(e) => setF({ ...f, motivo: e.target.value })} /></label>
            </div>
            <p className="mt-3 text-sm text-ink/60">Sedes (si no marcas ninguna, vale en todas las que tenga asignadas):</p>
            <div className="mt-1 flex flex-wrap gap-3">
              {sedes.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm text-ink">
                  <input type="checkbox" checked={f.sedeIds.includes(s.id)} onChange={(e) => setF({ ...f, sedeIds: e.target.checked ? [...f.sedeIds, s.id] : f.sedeIds.filter((x) => x !== s.id) })} /> {s.name}
                </label>
              ))}
            </div>
            <button className="press-spring mt-4 rounded-full bg-ink px-4 py-2 text-sm font-medium text-cream disabled:opacity-50" disabled={isPending || !f.accion || f.motivo.trim().length < 3}
              onClick={() => correr(() => crearDelegacion({ tenantId, membershipId: f.a === "persona" ? f.persona : null, rol: f.a === "rol" ? f.rol : null, accion: f.accion, sedeIds: f.sedeIds, vence: f.vence, motivo: f.motivo }), "Delegación creada.", () => setF({ ...f, accion: "", motivo: "", vence: "", sedeIds: [] }))}>Delegar</button>
          </section>
        )}
        <section className="rounded-2xl border border-white/10 bg-card p-5">
          <h2 className="text-base font-semibold text-ink">Delegaciones</h2>
          <ul className="mt-3 divide-y divide-white/10">
            {delegaciones.length === 0 && <li className="py-3 text-sm text-ink/50">No hay delegaciones. Por defecto, esas acciones solo las haces tú.</li>}
            {delegaciones.map((d) => (
              <li key={d.id} className={`flex flex-wrap items-center justify-between gap-3 py-3 text-sm ${d.activa ? "" : "opacity-50"}`}>
                <div>
                  <p className="text-ink"><strong>{ACCION[d.action_id] ?? d.action_id}</strong> → {d.persona ?? `todas las de ${ROL[d.rol] ?? d.rol}`}</p>
                  <p className="text-xs text-ink/55">{d.sedes?.length ? d.sedes.join(", ") : "todas sus sedes"} · {d.vence ? `hasta ${d.vence}` : "sin vencimiento"} · {d.motivo}{d.revocada_at ? " · revocada" : !d.activa ? " · vencida" : ""}</p>
                </div>
                {puedeDelegar && d.activa && <button className="text-xs text-ink/55 hover:text-ink" disabled={isPending} onClick={() => correr(() => revocarDelegacion(d.id), "Delegación revocada.")}>Revocar</button>}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
