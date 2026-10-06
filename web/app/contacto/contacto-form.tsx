"use client";

import { useActionState } from "react";
import { enviarConsulta } from "./actions";

const input = "mt-1 w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-ink outline-none focus:border-ink/40";

export default function ContactoForm({ fuente }: { fuente: string }) {
  const [estado, accion, pendiente] = useActionState(enviarConsulta, null);
  if (estado?.ok) {
    return (
      <div className="mt-8 rounded-2xl border border-black/10 bg-white p-6">
        <p className="text-lg font-semibold text-ink">¡Gracias! Recibimos tu solicitud.</p>
        <p className="mt-1 text-sm text-ink/70">Te escribiremos pronto al correo que dejaste.</p>
      </div>
    );
  }
  return (
    <form action={accion} className="mt-8 grid gap-4 rounded-2xl border border-black/10 bg-white p-6">
      <input type="hidden" name="fuente" value={fuente} />
      {/* campo trampa para bots: las personas no lo ven */}
      <input type="text" name="sitio" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <label className="text-sm text-ink/70">Nombre de tu gimnasio o estudio<input name="empresa" required maxLength={120} className={input} /></label>
      <label className="text-sm text-ink/70">Tu nombre<input name="nombre" required maxLength={120} className={input} /></label>
      <label className="text-sm text-ink/70">Correo<input name="email" type="email" required maxLength={160} className={input} /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm text-ink/70">Teléfono (opcional)<input name="telefono" maxLength={40} className={input} /></label>
        <label className="text-sm text-ink/70">Ciudad (opcional)<input name="ciudad" maxLength={80} className={input} /></label>
      </div>
      <label className="text-sm text-ink/70">¿Qué necesitas? (opcional)<textarea name="mensaje" rows={3} maxLength={1500} className={input} /></label>
      {estado?.error && <p className="rounded-lg bg-peach-tint px-3 py-2 text-sm text-ink">{estado.error}</p>}
      <button disabled={pendiente} className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-cream disabled:opacity-60">{pendiente ? "Enviando…" : "Enviar solicitud"}</button>
    </form>
  );
}
