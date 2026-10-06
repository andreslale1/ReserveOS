"use client";

import { useState, useTransition } from "react";
import { agregarDependiente, firmarConsentimiento, guardarPerfil, quitarDependiente } from "./actions";

const input = "mt-1 w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-ink outline-none focus:border-ink/40";
const card = "rounded-2xl border border-black/10 bg-white p-5";

export default function PerfilView({ tenantId, perfil, consentimientoPendiente, dependientes }: {
  tenantId: string; perfil: { nombre: string; telefono: string; email: string; emergencia: string; cuidados: string };
  consentimientoPendiente: boolean; dependientes: { id: string; nombre: string; fecha_nacimiento: string | null }[];
}) {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [p, setP] = useState(perfil);
  const [d, setD] = useState({ nombre: "", nacimiento: "" });
  const [c, setC] = useState({ experiencia: "", responsabilidad: false, cancelacion: false, imagen: false, firma: "" });

  function correr(fn: () => Promise<{ error: string | null }>, ok: string, despues?: () => void) {
    setMsg(null);
    startTransition(async () => { const r = await fn(); if (r.error) setMsg({ ok: false, texto: r.error }); else { setMsg({ ok: true, texto: ok }); despues?.(); } });
  }
  return (
    <div className="grid gap-5">
      <h1 className="font-serif text-2xl text-ink">Perfil</h1>
      {msg && <p className={`rounded-xl px-4 py-3 text-sm ${msg.ok ? "bg-sage-tint text-sage" : "bg-peach-tint text-ink"}`}>{msg.texto}</p>}

      <section className={card}>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink/50">Mis datos</h2>
        <div className="mt-3 grid gap-3">
          <label className="text-sm text-ink/70">Nombre<input className={input} value={p.nombre} onChange={(e) => setP({ ...p, nombre: e.target.value })} /></label>
          <label className="text-sm text-ink/70">Teléfono<input className={input} value={p.telefono} onChange={(e) => setP({ ...p, telefono: e.target.value })} /></label>
          <label className="text-sm text-ink/70">Correo de contacto<input className={input} value={p.email} onChange={(e) => setP({ ...p, email: e.target.value })} /></label>
          <label className="text-sm text-ink/70">Contacto de emergencia<input className={input} value={p.emergencia} onChange={(e) => setP({ ...p, emergencia: e.target.value })} /></label>
          <label className="text-sm text-ink/70">Lesiones o cuidados especiales<textarea rows={2} className={input} value={p.cuidados} onChange={(e) => setP({ ...p, cuidados: e.target.value })} /></label>
        </div>
        <button className="mt-4 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-cream disabled:opacity-50" disabled={isPending} onClick={() => correr(() => guardarPerfil(tenantId, p), "Datos guardados.")}>Guardar</button>
      </section>

      <section className={card}>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink/50">Mi familia</h2>
        <p className="mt-1 text-xs text-ink/55">Hijas, hijos u otras personas a quienes reservas clases con tu cuenta.</p>
        <ul className="mt-2 divide-y divide-black/5">
          {dependientes.length === 0 && <li className="py-2 text-sm text-ink/60">Sin dependientes.</li>}
          {dependientes.map((x) => (
            <li key={x.id} className="flex items-center justify-between py-2.5 text-sm text-ink">
              <span>{x.nombre}{x.fecha_nacimiento ? <span className="text-ink/50"> · {x.fecha_nacimiento}</span> : null}</span>
              <button className="text-xs text-ink/50 hover:text-ink" disabled={isPending} onClick={() => correr(() => quitarDependiente(tenantId, x.id), "Dependiente quitado.")}>Quitar</button>
            </li>
          ))}
        </ul>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_160px_auto]">
          <input className={`${input} mt-0`} placeholder="Nombre" value={d.nombre} onChange={(e) => setD({ ...d, nombre: e.target.value })} />
          <input type="date" className={`${input} mt-0`} value={d.nacimiento} onChange={(e) => setD({ ...d, nacimiento: e.target.value })} />
          <button className="rounded-full border border-black/20 px-4 py-2 text-sm text-ink disabled:opacity-50" disabled={isPending || !d.nombre.trim()} onClick={() => correr(() => agregarDependiente(tenantId, d.nombre, d.nacimiento), "Agregado.", () => setD({ nombre: "", nacimiento: "" }))}>Agregar</button>
        </div>
      </section>

      {consentimientoPendiente && (
        <section id="consentimiento" className={`${card} border-peach`}>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink/50">Consentimiento y salud</h2>
          <p className="mt-1 text-sm text-ink/70">Lo necesitamos una sola vez, antes de tu primera clase.</p>
          <label className="mt-3 block text-sm text-ink/70">Experiencia previa<input className={input} placeholder="Ninguna, algo, mucha…" value={c.experiencia} onChange={(e) => setC({ ...c, experiencia: e.target.value })} /></label>
          <label className="mt-3 flex items-start gap-2 text-sm text-ink"><input type="checkbox" className="mt-1" checked={c.responsabilidad} onChange={(e) => setC({ ...c, responsabilidad: e.target.checked })} /> Entiendo los riesgos de la actividad física y participo bajo mi responsabilidad.</label>
          <label className="mt-2 flex items-start gap-2 text-sm text-ink"><input type="checkbox" className="mt-1" checked={c.cancelacion} onChange={(e) => setC({ ...c, cancelacion: e.target.checked })} /> Acepto la política de cancelación del estudio.</label>
          <label className="mt-2 flex items-start gap-2 text-sm text-ink"><input type="checkbox" className="mt-1" checked={c.imagen} onChange={(e) => setC({ ...c, imagen: e.target.checked })} /> Autorizo el uso de mi imagen en las redes del estudio (opcional).</label>
          <label className="mt-3 block text-sm text-ink/70">Firma (escribe tu nombre completo)<input className={input} value={c.firma} onChange={(e) => setC({ ...c, firma: e.target.value })} /></label>
          <button className="mt-4 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-cream disabled:opacity-50" disabled={isPending || !c.responsabilidad || !c.cancelacion || c.firma.trim().length < 3 || !p.emergencia.trim()}
            onClick={() => correr(() => firmarConsentimiento(tenantId, { emergencia: p.emergencia, cuidados: p.cuidados, experiencia: c.experiencia, responsabilidad: c.responsabilidad, cancelacion: c.cancelacion, imagen: c.imagen, firma: c.firma }), "Consentimiento registrado.")}>Firmar y continuar</button>
          {!p.emergencia.trim() && <p className="mt-2 text-xs text-ink/55">Completa antes tu contacto de emergencia en “Mis datos” y guárdalo.</p>}
        </section>
      )}
    </div>
  );
}
