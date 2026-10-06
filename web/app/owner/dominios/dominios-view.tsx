"use client";

import { useState, useTransition } from "react";
import { activarDominio, bajaDominio, comprobarDns } from "./actions";

export type Dominio = { id: string; estudio: string; domain: string; verified: boolean; solicitado_at: string; verificado_at: string | null };

export default function DominiosView({ dominios }: { dominios: Dominio[] }) {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [dns, setDns] = useState<Record<string, { ok: boolean; detalle: string }>>({});

  function correr(fn: () => Promise<{ error: string | null }>, ok: string) {
    setMsg(null);
    startTransition(async () => { const r = await fn(); setMsg(r.error ?? ok); });
  }
  return (
    <main className="mx-auto max-w-4xl px-6 py-8 md:px-10">
      <h1 className="text-2xl font-semibold">Dominios de los estudios</h1>
      <p className="mt-1 text-sm text-white/50">Cada estudio puede usar su propio dominio (ej. reservas.suestudio.com). Se activa solo después de comprobar el DNS y agregarlo al proyecto en Vercel.</p>
      <section className="mt-5 rounded-2xl border border-white/10 bg-void-card p-5 text-sm text-white/70">
        <p className="font-medium text-white">Pasos para activar uno</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>El estudio crea un registro <strong>CNAME</strong> de su dominio hacia <code className="text-lime">cname.vercel-dns.com</code>.</li>
          <li>Agrega el dominio al proyecto en Vercel: <code className="text-lime">vercel domains add &lt;dominio&gt;</code> desde la carpeta <code>web</code>.</li>
          <li>Aquí pulsa <strong>Comprobar DNS</strong> y, si está bien, <strong>Activar</strong>.</li>
        </ol>
      </section>
      {msg && <p className="mt-4 rounded-xl bg-white/10 px-4 py-3 text-sm">{msg}</p>}
      <ul className="mt-6 grid gap-3">
        {dominios.length === 0 && <li className="text-sm text-white/50">Ningún estudio ha solicitado un dominio propio.</li>}
        {dominios.map((d) => (
          <li key={d.id} className="rounded-2xl border border-white/10 bg-void-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">{d.domain}</p>
                <p className="text-xs text-white/50">{d.estudio} · solicitado {new Date(d.solicitado_at).toLocaleDateString("es-GT")} · <span className={d.verified ? "text-lime" : "text-yellow-300"}>{d.verified ? "activo" : "pendiente"}</span></p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="rounded-full border border-white/15 px-3 py-1.5 text-xs" disabled={isPending} onClick={() => startTransition(async () => { const r = await comprobarDns(d.domain); setDns({ ...dns, [d.id]: r }); })}>Comprobar DNS</button>
                {!d.verified ? (
                  <button className="rounded-full bg-lime px-3 py-1.5 text-xs font-semibold text-void disabled:opacity-40" disabled={isPending || !dns[d.id]?.ok} title={dns[d.id]?.ok ? "" : "Comprueba primero el DNS"} onClick={() => correr(() => activarDominio(d.id, true), "Dominio activado.")}>Activar</button>
                ) : (
                  <button className="rounded-full border border-white/15 px-3 py-1.5 text-xs" disabled={isPending} onClick={() => correr(() => activarDominio(d.id, false), "Dominio desactivado.")}>Desactivar</button>
                )}
                <button className="text-xs text-white/40 hover:text-white" disabled={isPending} onClick={() => correr(() => bajaDominio(d.id), "Dominio dado de baja.")}>Dar de baja</button>
              </div>
            </div>
            {dns[d.id] && <p className={`mt-2 text-xs ${dns[d.id].ok ? "text-lime" : "text-red-300"}`}>DNS: {dns[d.id].detalle}</p>}
          </li>
        ))}
      </ul>
    </main>
  );
}
