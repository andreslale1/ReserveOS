"use client";

import { useState, useTransition } from "react";
import { guardarMiembro, invitarMiembro, quitarMiembro, revocarInvitacion } from "./actions";

export type Miembro = { user_id: string; nombre: string | null; email: string; rol: string; created_at: string; ultimo_acceso: string | null; ultimo_cambio_por: string | null; ultimo_cambio_at: string | null };
export type Invitacion = { id: string; email: string; nombre: string | null; rol: string; estado: string; expira_at: string; created_at: string; invitado_por: string | null; token: string | null };

const ROLES: [string, string][] = [
  ["operador", "Operador — todo"], ["ventas", "Ventas — CRM y propuestas"], ["marketing", "Marketing B2B — campañas"],
  ["implementacion", "Implementación — altas y diagnóstico"], ["finanzas", "Finanzas — cobros y costos"],
  ["soporte", "Soporte — tickets y salud"], ["ingenieria", "Ingeniería — salud e incidentes"], ["auditor", "Auditor — solo lectura de registros"],
];
const rolLabel = (r: string) => ROLES.find(([v]) => v === r)?.[1] ?? r;
const input = "rounded-lg border border-white/15 bg-void px-3 py-2 text-sm text-white outline-none focus:border-lime/60 focus-visible:ring-2 focus-visible:ring-lime/60";
const fecha = (s: string | null) => (s ? new Date(s).toLocaleString("es-GT", { timeZone: "America/Guatemala", dateStyle: "short", timeStyle: "short" }) : "—");

type Confirmar = { tipo: "rol"; m: Miembro; rol: string } | { tipo: "quitar"; m: Miembro } | { tipo: "revocar"; i: Invitacion };

export default function EquipoView({ miembros, invitaciones, puedeEditar, yoId }: { miembros: Miembro[]; invitaciones: Invitacion[]; puedeEditar: boolean; yoId: string }) {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [f, setF] = useState({ email: "", nombre: "", rol: "ventas" });
  const [confirmar, setConfirmar] = useState<Confirmar | null>(null);
  const [enlace, setEnlace] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  const url = (t: string) => `${typeof window === "undefined" ? "" : window.location.origin}/invitar/equipo/${t}`;
  function correr(fn: () => Promise<{ error: string | null }>, ok: string, despues?: () => void) {
    setMsg(null);
    startTransition(async () => { const r = await fn(); if (r.error) setMsg({ ok: false, texto: r.error }); else { setMsg({ ok: true, texto: ok }); despues?.(); } });
  }
  async function copiar(texto: string, clave: string) {
    try { await navigator.clipboard.writeText(texto); setCopiado(clave); setTimeout(() => setCopiado(null), 2000); } catch { setMsg({ ok: false, texto: "No se pudo copiar; selecciona el enlace y cópialo a mano." }); }
  }
  function invitar() {
    setMsg(null); setEnlace(null);
    startTransition(async () => {
      const r = await invitarMiembro(f.email, f.nombre, f.rol);
      if (r.error) setMsg({ ok: false, texto: r.error });
      else { setMsg({ ok: true, texto: "Invitación creada. Comparte el enlace con la persona: vence en 7 días." }); setEnlace(url(r.token!)); setF({ email: "", nombre: "", rol: "ventas" }); }
    });
  }
  function ejecutar() {
    const c = confirmar; if (!c) return; setConfirmar(null);
    if (c.tipo === "rol") correr(() => guardarMiembro(c.m.email, c.m.nombre ?? "", c.rol), "Rol actualizado.");
    else if (c.tipo === "quitar") correr(() => quitarMiembro(c.m.user_id), "Persona quitada del equipo.");
    else correr(() => revocarInvitacion(c.i.id), "Invitación revocada.");
  }
  const pendientes = invitaciones.filter((i) => i.estado === "pendiente");
  const historial = invitaciones.filter((i) => i.estado !== "pendiente");

  return (
    <main className="mx-auto max-w-3xl px-6 py-8 md:px-10">
      <h1 className="text-2xl font-semibold">Equipo de ReserveOS</h1>
      <p className="mt-1 text-sm text-white/60">Cada persona ve solo lo de su rol. Los cambios de rol y las bajas se validan en la base en cada acción, así que tienen efecto inmediato aunque la persona tenga la sesión abierta.</p>
      <div role="status" aria-live="polite">
        {msg && <p className={`mt-4 rounded-xl px-4 py-3 text-sm ${msg.ok ? "bg-lime/15 text-lime" : "bg-red-500/15 text-red-200"}`}>{msg.texto}</p>}
      </div>

      {confirmar && (
        <div role="alertdialog" aria-labelledby="conf-t" className="mt-4 rounded-2xl border border-yellow-300/40 bg-yellow-300/10 p-4 text-sm">
          <p id="conf-t" className="font-medium">
            {confirmar.tipo === "rol" && <>¿Cambiar a {confirmar.m.nombre ?? confirmar.m.email} de «{rolLabel(confirmar.m.rol)}» a «{rolLabel(confirmar.rol)}»?</>}
            {confirmar.tipo === "quitar" && <>¿Quitar a {confirmar.m.nombre ?? confirmar.m.email} del equipo? Perderá todo acceso a la consola.</>}
            {confirmar.tipo === "revocar" && <>¿Revocar la invitación para {confirmar.i.email}? El enlace dejará de funcionar.</>}
          </p>
          <div className="mt-3 flex gap-2">
            <button className="rounded-full bg-lime px-4 py-1.5 text-xs font-semibold text-void" onClick={ejecutar} disabled={isPending}>Confirmar</button>
            <button className="rounded-full border border-white/20 px-4 py-1.5 text-xs" onClick={() => setConfirmar(null)}>Cancelar</button>
          </div>
        </div>
      )}

      <ul className="mt-6 divide-y divide-white/10 rounded-2xl border border-white/10 bg-void-card px-5">
        {miembros.map((m) => (
          <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
            <div>
              <p className="font-medium">{m.nombre ?? m.email}{m.user_id === yoId && <span className="ml-2 text-xs text-white/50">(tú)</span>}</p>
              <p className="text-xs text-white/60">{m.email}</p>
              <p className="mt-0.5 text-xs text-white/50">Último acceso: {fecha(m.ultimo_acceso)}{m.ultimo_cambio_por ? ` · Rol fijado por ${m.ultimo_cambio_por} el ${fecha(m.ultimo_cambio_at)}` : ""}</p>
            </div>
            <div className="flex items-center gap-3">
              {puedeEditar ? (
                <>
                  <label className="sr-only" htmlFor={`rol-${m.user_id}`}>Rol de {m.nombre ?? m.email}</label>
                  <select id={`rol-${m.user_id}`} className={input} value={m.rol} disabled={isPending} onChange={(e) => e.target.value !== m.rol && setConfirmar({ tipo: "rol", m, rol: e.target.value })}>
                    {ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </>
              ) : <span className="text-xs text-lime">{rolLabel(m.rol)}</span>}
              {puedeEditar && m.user_id !== yoId && <button className="text-xs text-white/60 underline hover:text-white" disabled={isPending} onClick={() => setConfirmar({ tipo: "quitar", m })}>Quitar</button>}
            </div>
          </li>
        ))}
      </ul>

      {puedeEditar && (
        <section className="mt-6 rounded-2xl border border-white/10 bg-void-card p-5" aria-labelledby="inv-t">
          <h2 id="inv-t" className="text-base font-semibold">Invitar a una persona</h2>
          <p className="mt-1 text-xs text-white/55">No necesita cuenta previa: recibe un enlace, crea o usa su cuenta con ese mismo correo y acepta. El enlace vence en 7 días. Este formulario no envía correos; comparte el enlace tú.</p>
          <form className="mt-3 grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); invitar(); }}>
            <label className="grid gap-1 text-xs text-white/70 sm:col-span-2">Correo <span className="text-white/45">(obligatorio)</span>
              <input type="email" required className={input} autoComplete="off" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
            </label>
            <label className="grid gap-1 text-xs text-white/70">Nombre <span className="text-white/45">(opcional)</span>
              <input className={input} value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
            </label>
            <label className="grid gap-1 text-xs text-white/70">Rol
              <select className={input} value={f.rol} onChange={(e) => setF({ ...f, rol: e.target.value })}>{ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            </label>
            <div className="sm:col-span-2">
              <button type="submit" className="rounded-full bg-lime px-4 py-2 text-sm font-semibold text-void disabled:opacity-50" disabled={isPending || !f.email.includes("@")}>{isPending ? "Creando…" : "Crear invitación"}</button>
              {!f.email.includes("@") && <span className="ml-3 text-xs text-white/50">Escribe un correo válido para continuar.</span>}
            </div>
          </form>
          {enlace && (
            <div className="mt-4 rounded-xl border border-lime/30 bg-lime/10 p-3 text-xs">
              <p className="text-white/80">Enlace de invitación (se muestra una vez aquí; luego sigue disponible en «Invitaciones pendientes»):</p>
              <p className="mt-1 break-all font-mono text-lime">{enlace}</p>
              <button className="mt-2 rounded-full border border-white/20 px-3 py-1" onClick={() => copiar(enlace, "nuevo")}>{copiado === "nuevo" ? "Copiado" : "Copiar enlace"}</button>
            </div>
          )}
        </section>
      )}

      <section className="mt-6" aria-labelledby="pend-t">
        <h2 id="pend-t" className="text-base font-semibold">Invitaciones pendientes</h2>
        <ul className="mt-2 divide-y divide-white/10 rounded-2xl border border-white/10 bg-void-card px-5">
          {pendientes.length === 0 && <li className="py-3 text-sm text-white/55">No hay invitaciones pendientes.</li>}
          {pendientes.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
              <div><p>{i.email} <span className="text-xs text-white/55">· {rolLabel(i.rol)}</span></p><p className="text-xs text-white/50">Invitó {i.invitado_por ?? "—"} · vence {fecha(i.expira_at)}</p></div>
              {puedeEditar && (
                <div className="flex gap-3 text-xs">
                  {i.token && <button className="underline" onClick={() => copiar(url(i.token!), i.id)}>{copiado === i.id ? "Copiado" : "Copiar enlace"}</button>}
                  <button className="text-white/60 underline hover:text-white" disabled={isPending} onClick={() => setConfirmar({ tipo: "revocar", i })}>Revocar</button>
                </div>
              )}
            </li>
          ))}
        </ul>
        {historial.length > 0 && (
          <details className="mt-3 text-sm text-white/65">
            <summary className="cursor-pointer">Historial de invitaciones ({historial.length})</summary>
            <ul className="mt-2 space-y-1 text-xs">{historial.map((i) => <li key={i.id}>{i.email} · {rolLabel(i.rol)} · <strong>{i.estado}</strong> · {fecha(i.created_at)}</li>)}</ul>
          </details>
        )}
      </section>
    </main>
  );
}
