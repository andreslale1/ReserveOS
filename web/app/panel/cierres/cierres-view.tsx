"use client";

import { useState, useTransition } from "react";
import { cerrarFechas, quitarCierre } from "./actions";

const input = "mt-1 w-full rounded-lg border border-white/15 bg-cream px-3 py-2 text-ink outline-none focus:border-ink/30";

export default function CierresView({ tenantId, sedes, cierres, puedeTodas }: {
  tenantId: string; sedes: { id: string; name: string }[]; cierres: { id: string; sede_id: string | null; desde: string; hasta: string; motivo: string }[]; puedeTodas: boolean;
}) {
  const hoy = new Date().toISOString().slice(0, 10);
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [f, setF] = useState({ sede: puedeTodas ? "" : (sedes[0]?.id ?? ""), desde: hoy, hasta: hoy, motivo: "" });
  const [confirmar, setConfirmar] = useState(false);
  const nombre = (id: string | null) => (id ? sedes.find((s) => s.id === id)?.name ?? "Sede" : "Todas las sedes");

  return (
    <main className="min-h-screen bg-cream">
      <header className="border-b border-white/10 bg-card px-6 py-6 md:px-10">
        <h1 className="font-serif text-2xl text-ink md:text-3xl">Feriados y cierres</h1>
        <p className="mt-1 text-sm text-ink/60">Cierra una sede por feriado o remodelación. Se cancelan las clases y reservas de esos días y cada clienta recupera su clase.</p>
      </header>
      <div className="mx-auto grid max-w-3xl gap-6 px-6 py-8 md:px-10">
        {msg && <p className={`rounded-xl px-4 py-3 text-sm ${msg.ok ? "bg-sage-tint text-sage" : "bg-peach-tint text-ink"}`}>{msg.texto}</p>}
        <section className="rounded-2xl border border-white/10 bg-card p-5">
          <h2 className="text-base font-semibold text-ink">Nuevo cierre</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-ink/60">Sede
              <select className={input} value={f.sede} onChange={(e) => setF({ ...f, sede: e.target.value })}>
                {puedeTodas && <option value="">Todas las sedes</option>}
                {sedes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select></label>
            <label className="text-sm text-ink/60">Motivo<input className={input} placeholder="Feriado, remodelación…" value={f.motivo} onChange={(e) => setF({ ...f, motivo: e.target.value })} /></label>
            <label className="text-sm text-ink/60">Desde<input type="date" min={hoy} className={input} value={f.desde} onChange={(e) => setF({ ...f, desde: e.target.value, hasta: e.target.value > f.hasta ? e.target.value : f.hasta })} /></label>
            <label className="text-sm text-ink/60">Hasta<input type="date" min={f.desde} className={input} value={f.hasta} onChange={(e) => setF({ ...f, hasta: e.target.value })} /></label>
          </div>
          {confirmar ? (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <p className="text-sm text-ink">Se cancelarán las clases y reservas de {nombre(f.sede || null)} del {f.desde} al {f.hasta}. ¿Confirmas?</p>
              <button className="press-spring rounded-full bg-ink px-4 py-2 text-sm text-cream disabled:opacity-50" disabled={isPending}
                onClick={() => { setMsg(null); startTransition(async () => { const r = await cerrarFechas(tenantId, f.sede || null, f.desde, f.hasta, f.motivo); setConfirmar(false); setMsg(r.error ? { ok: false, texto: r.error } : { ok: true, texto: `Cierre registrado. Reservas canceladas: ${r.canceladas}.` }); }); }}>Sí, cerrar</button>
              <button className="text-sm text-ink/60" onClick={() => setConfirmar(false)}>No</button>
            </div>
          ) : (
            <button className="press-spring mt-4 rounded-full bg-ink px-4 py-2 text-sm font-medium text-cream disabled:opacity-50" disabled={f.motivo.trim().length < 3} onClick={() => setConfirmar(true)}>Cerrar estas fechas</button>
          )}
        </section>
        <section className="rounded-2xl border border-white/10 bg-card p-5">
          <h2 className="text-base font-semibold text-ink">Cierres vigentes y próximos</h2>
          <ul className="mt-3 divide-y divide-white/10">
            {cierres.length === 0 && <li className="py-3 text-sm text-ink/50">No hay cierres programados.</li>}
            {cierres.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <span className="text-ink">{nombre(c.sede_id)} · {c.desde}{c.hasta !== c.desde ? ` al ${c.hasta}` : ""}<span className="text-ink/55"> · {c.motivo}</span></span>
                {(puedeTodas || c.sede_id) && <button className="text-xs text-ink/50 hover:text-ink" disabled={isPending} onClick={() => { setMsg(null); startTransition(async () => { const r = await quitarCierre(c.id); setMsg(r.error ? { ok: false, texto: r.error } : { ok: true, texto: "Cierre quitado. Las clases vuelven a estar disponibles (las reservas canceladas no se restauran)." }); }); }}>Quitar</button>}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
