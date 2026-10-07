"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { Campo, enfocarPrimerError, inputOwner } from "@/components/owner/campo";
import { Confirmar } from "@/components/owner/confirmar";
import { EstadoVacio } from "@/components/owner/estado-vacio";
import { guardarIncidente } from "./actions";

export type Ticket = { id: string; estudio: string; asunto: string; prioridad: string; estado: string; asignado_a: string | null; sla_vence: string; sla_vencido: boolean; created_at: string };
export type Incidente = { id: string; titulo: string; descripcion: string | null; severidad: string; estado: string; tenant_id: string | null; started_at: string; resolved_at: string | null };

const COLOR: Record<string, string> = { urgente: "text-red-300", alta: "text-orange-300", normal: "text-white/70", baja: "text-white/65" };

export default function SoporteView({ tickets, incidentes, estudios, filtro }: { tickets: Ticket[]; incidentes: Incidente[]; estudios: { id: string; name: string }[]; filtro?: "abiertos" | "sla" | "incidentes" }) {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [cambio, setCambio] = useState<{ x: Incidente; estado: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [verCerrados, setVerCerrados] = useState(false);
  const [i, setI] = useState({ id: null as string | null, titulo: "", descripcion: "", severidad: "menor", estado: "investigando", tenantId: "", nota: "", abierto: false });
  const abierto = (t: Ticket) => !["resuelto", "cerrado"].includes(t.estado);
  const lista = tickets.filter((t) => (filtro === "sla" ? abierto(t) && t.sla_vencido : verCerrados || abierto(t)));
  const incs = filtro === "incidentes" ? incidentes.filter((x) => x.estado !== "resuelto") : incidentes;

  function correr(fn: () => Promise<{ error: string | null }>, ok: string, despues?: () => void) {
    setMsg(null);
    startTransition(async () => { const r = await fn(); if (r.error) setMsg({ ok: false, texto: r.error }); else { setMsg({ ok: true, texto: ok }); despues?.(); } });
  }
  function declarar(e: React.FormEvent) {
    e.preventDefault();
    if (i.titulo.trim().length < 3) { setErrs({ titulo: "Escribe un título de al menos 3 letras." }); setTimeout(() => enfocarPrimerError(formRef.current), 0); return; }
    setErrs({});
    correr(() => guardarIncidente({ id: i.id, titulo: i.titulo, descripcion: i.descripcion, severidad: i.severidad, estado: i.estado, tenantId: i.tenantId, nota: i.nota }), "Incidente guardado.", () => setI({ ...i, abierto: false, id: null, titulo: "", descripcion: "", nota: "" }));
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-8 md:px-10">
      <h1 className="text-2xl font-semibold">Soporte</h1>
      {filtro && <p className="mt-2 text-sm text-lime">Filtro activo: {filtro === "sla" ? "tickets con SLA vencido" : filtro === "incidentes" ? "incidentes sin resolver" : "tickets abiertos"}. <Link href="/owner/soporte" className="underline">Quitar filtro</Link></p>}
      <p className="mt-1 text-sm text-white/70">Casos de los estudios e incidentes. El diagnóstico usa datos mínimos: no se abre la ficha de clientas ni la caja del estudio.</p>
      <div aria-live="polite">{msg && <p role={msg.ok ? "status" : "alert"} className={`mt-4 rounded-xl px-4 py-3 text-sm ${msg.ok ? "bg-lime/15 text-lime" : "bg-red-400/15 text-red-200"}`}>{msg.texto}</p>}</div>

      <section className="mt-6 rounded-2xl border border-white/10 bg-void-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Tickets</h2>
          <label className="flex items-center gap-2 text-xs text-white/75"><input type="checkbox" checked={verCerrados} onChange={(e) => setVerCerrados(e.target.checked)} /> Ver resueltos</label>
        </div>
        <ul className="mt-3 divide-y divide-white/10">
          {lista.length === 0 && <li className="py-3"><EstadoVacio titulo="Sin tickets" texto={filtro === "sla" ? "Ningún ticket tiene el SLA vencido." : "Los estudios abren tickets desde su panel."} /></li>}
          {lista.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
              <div>
                <Link href={`/owner/soporte/${t.id}`} className="font-medium hover:text-lime">{t.asunto}</Link>
                <p className="text-xs text-white/70">{t.estudio} · <span className={COLOR[t.prioridad]}>{t.prioridad}</span> · {t.estado}{t.asignado_a ? ` · ${t.asignado_a}` : ""}</p>
              </div>
              {t.sla_vencido ? <span className="text-xs text-red-300">SLA vencido</span> : !["resuelto", "cerrado"].includes(t.estado) && <span className="text-xs text-white/65">responder antes de {new Date(t.sla_vence).toLocaleString("es-GT", { timeZone: "America/Guatemala", dateStyle: "short", timeStyle: "short" })}</span>}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6 rounded-2xl border border-white/10 bg-void-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Incidentes</h2>
          <button type="button" aria-expanded={i.abierto} className="rounded-full border border-white/25 px-3 py-1.5 text-xs text-white/80" onClick={() => setI({ ...i, id: null, titulo: "", descripcion: "", nota: "", abierto: !i.abierto })}>+ Declarar incidente</button>
        </div>
        {i.abierto && (
          <form ref={formRef} onSubmit={declarar} noValidate aria-label="Declarar incidente" className="mt-3 grid gap-3 sm:grid-cols-2">
            <Campo label="Título" requerido error={errs.titulo}>{(p) => <input {...p} className={inputOwner} value={i.titulo} onChange={(e) => setI({ ...i, titulo: e.target.value })} />}</Campo>
            <Campo label="Estudio afectado">{(p) => <select {...p} className={inputOwner} value={i.tenantId} onChange={(e) => setI({ ...i, tenantId: e.target.value })}><option value="">Afecta a todos</option>{estudios.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select>}</Campo>
            <Campo label="Severidad">{(p) => <select {...p} className={inputOwner} value={i.severidad} onChange={(e) => setI({ ...i, severidad: e.target.value })}><option>menor</option><option>mayor</option><option>critico</option></select>}</Campo>
            <Campo label="Estado">{(p) => <select {...p} className={inputOwner} value={i.estado} onChange={(e) => setI({ ...i, estado: e.target.value })}><option>investigando</option><option>identificado</option><option>monitoreando</option><option>resuelto</option></select>}</Campo>
            <Campo label="Qué pasa" ayuda="Lo ven los estudios afectados." className="sm:col-span-2">{(p) => <input {...p} className={inputOwner} value={i.descripcion} onChange={(e) => setI({ ...i, descripcion: e.target.value })} />}</Campo>
            <Campo label="Nota de avance" className="sm:col-span-2">{(p) => <input {...p} className={inputOwner} value={i.nota} onChange={(e) => setI({ ...i, nota: e.target.value })} />}</Campo>
            <button type="submit" className="w-fit rounded-full bg-lime px-5 py-2 text-sm font-semibold text-void disabled:opacity-50" disabled={isPending}>{isPending ? "Guardando…" : "Guardar incidente"}</button>
          </form>
        )}
        <ul className="mt-3 divide-y divide-white/10">
          {incs.length === 0 && <li className="py-3"><EstadoVacio titulo="Sin incidentes" texto="Declara uno cuando algo afecte a uno o más estudios." /></li>}
          {incs.map((x) => (
            <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
              <div>
                <p className="font-medium">{x.titulo} <span className={`text-xs ${x.severidad === "critico" ? "text-red-300" : x.severidad === "mayor" ? "text-orange-300" : "text-white/70"}`}>· {x.severidad}</span></p>
                <p className="text-xs text-white/70">{x.estado} · {new Date(x.started_at).toLocaleDateString("es-GT")}{x.tenant_id ? "" : " · global"}</p>
              </div>
              {x.estado !== "resuelto" && (
                <div className="flex gap-2">
                  {["identificado", "monitoreando", "resuelto"].filter((e) => e !== x.estado).map((e) => (
                    <button key={e} type="button" className="rounded-full border border-white/25 px-2.5 py-1 text-xs text-white/80 hover:text-white" disabled={isPending}
                      onClick={() => setCambio({ x, estado: e })}>Pasar a {e}</button>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
      <Confirmar abierto={cambio !== null} titulo={`Pasar a «${cambio?.estado ?? ""}»`} cargando={isPending} confirmar="Cambiar estado" onCancelar={() => setCambio(null)}
        onConfirmar={() => { const c = cambio; if (!c) return; correr(() => guardarIncidente({ id: c.x.id, titulo: c.x.titulo, descripcion: c.x.descripcion ?? "", severidad: c.x.severidad, estado: c.estado, tenantId: c.x.tenant_id ?? "", nota: `Cambió a ${c.estado}` }), "Incidente actualizado."); setCambio(null); }}>
        {cambio?.estado === "resuelto" ? "Se marcará como resuelto y los estudios afectados dejarán de verlo." : "Los estudios afectados verán el nuevo estado."}
      </Confirmar>
    </main>
  );
}
