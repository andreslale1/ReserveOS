"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { guardarIncidente } from "./actions";

export type Ticket = { id: string; estudio: string; asunto: string; prioridad: string; estado: string; asignado_a: string | null; sla_vence: string; sla_vencido: boolean; created_at: string };
export type Incidente = { id: string; titulo: string; descripcion: string | null; severidad: string; estado: string; tenant_id: string | null; started_at: string; resolved_at: string | null };

const input = "rounded-lg border border-white/15 bg-void px-2 py-1.5 text-sm text-white outline-none focus:border-lime/60";
const COLOR: Record<string, string> = { urgente: "text-red-300", alta: "text-orange-300", normal: "text-white/70", baja: "text-white/40" };

export default function SoporteView({ tickets, incidentes, estudios }: { tickets: Ticket[]; incidentes: Incidente[]; estudios: { id: string; name: string }[] }) {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [verCerrados, setVerCerrados] = useState(false);
  const [i, setI] = useState({ id: null as string | null, titulo: "", descripcion: "", severidad: "menor", estado: "investigando", tenantId: "", nota: "", abierto: false });
  const lista = tickets.filter((t) => verCerrados || !["resuelto", "cerrado"].includes(t.estado));

  function correr(fn: () => Promise<{ error: string | null }>, despues?: () => void) {
    setMsg(null);
    startTransition(async () => { const r = await fn(); if (r.error) setMsg(r.error); else despues?.(); });
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-8 md:px-10">
      <h1 className="text-2xl font-semibold">Soporte</h1>
      <p className="mt-1 text-sm text-white/50">Casos de los estudios e incidentes. El diagnóstico usa datos mínimos: no se abre la ficha de clientas ni la caja del estudio.</p>
      {msg && <p className="mt-4 rounded-xl bg-white/10 px-4 py-3 text-sm">{msg}</p>}

      <section className="mt-6 rounded-2xl border border-white/10 bg-void-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Tickets</h2>
          <label className="flex items-center gap-2 text-xs text-white/50"><input type="checkbox" checked={verCerrados} onChange={(e) => setVerCerrados(e.target.checked)} /> Ver resueltos</label>
        </div>
        <ul className="mt-3 divide-y divide-white/10">
          {lista.length === 0 && <li className="py-3 text-sm text-white/50">Sin tickets.</li>}
          {lista.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
              <div>
                <Link href={`/owner/soporte/${t.id}`} className="font-medium hover:text-lime">{t.asunto}</Link>
                <p className="text-xs text-white/50">{t.estudio} · <span className={COLOR[t.prioridad]}>{t.prioridad}</span> · {t.estado}{t.asignado_a ? ` · ${t.asignado_a}` : ""}</p>
              </div>
              {t.sla_vencido ? <span className="text-xs text-red-300">SLA vencido</span> : !["resuelto", "cerrado"].includes(t.estado) && <span className="text-xs text-white/40">responder antes de {new Date(t.sla_vence).toLocaleString("es-GT", { timeZone: "America/Guatemala", dateStyle: "short", timeStyle: "short" })}</span>}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6 rounded-2xl border border-white/10 bg-void-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Incidentes</h2>
          <button className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/70" onClick={() => setI({ ...i, id: null, titulo: "", descripcion: "", nota: "", abierto: !i.abierto })}>+ Declarar incidente</button>
        </div>
        {i.abierto && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <input className={input} placeholder="Título" value={i.titulo} onChange={(e) => setI({ ...i, titulo: e.target.value })} />
            <select className={input} value={i.tenantId} onChange={(e) => setI({ ...i, tenantId: e.target.value })}><option value="">Afecta a todos</option>{estudios.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
            <select className={input} value={i.severidad} onChange={(e) => setI({ ...i, severidad: e.target.value })}><option>menor</option><option>mayor</option><option>critico</option></select>
            <select className={input} value={i.estado} onChange={(e) => setI({ ...i, estado: e.target.value })}><option>investigando</option><option>identificado</option><option>monitoreando</option><option>resuelto</option></select>
            <input className={`${input} sm:col-span-2`} placeholder="Qué pasa (lo ven los estudios afectados)" value={i.descripcion} onChange={(e) => setI({ ...i, descripcion: e.target.value })} />
            <input className={`${input} sm:col-span-2`} placeholder="Nota de avance (opcional)" value={i.nota} onChange={(e) => setI({ ...i, nota: e.target.value })} />
            <button className="w-fit rounded-full bg-lime px-4 py-1.5 text-sm font-semibold text-void disabled:opacity-50" disabled={isPending || i.titulo.trim().length < 3}
              onClick={() => correr(() => guardarIncidente({ id: i.id, titulo: i.titulo, descripcion: i.descripcion, severidad: i.severidad, estado: i.estado, tenantId: i.tenantId, nota: i.nota }), () => setI({ ...i, abierto: false, id: null, titulo: "", descripcion: "", nota: "" }))}>Guardar</button>
          </div>
        )}
        <ul className="mt-3 divide-y divide-white/10">
          {incidentes.length === 0 && <li className="py-3 text-sm text-white/50">Sin incidentes.</li>}
          {incidentes.map((x) => (
            <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
              <div>
                <p className="font-medium">{x.titulo} <span className={`text-xs ${x.severidad === "critico" ? "text-red-300" : x.severidad === "mayor" ? "text-orange-300" : "text-white/50"}`}>· {x.severidad}</span></p>
                <p className="text-xs text-white/50">{x.estado} · {new Date(x.started_at).toLocaleDateString("es-GT")}{x.tenant_id ? "" : " · global"}</p>
              </div>
              {x.estado !== "resuelto" && (
                <div className="flex gap-2">
                  {["identificado", "monitoreando", "resuelto"].filter((e) => e !== x.estado).map((e) => (
                    <button key={e} className="rounded-full border border-white/15 px-2.5 py-1 text-xs text-white/70 hover:text-white" disabled={isPending}
                      onClick={() => correr(() => guardarIncidente({ id: x.id, titulo: x.titulo, descripcion: x.descripcion ?? "", severidad: x.severidad, estado: e, tenantId: x.tenant_id ?? "", nota: `Cambió a ${e}` }))}>{e}</button>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
