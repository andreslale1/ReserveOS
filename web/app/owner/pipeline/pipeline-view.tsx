"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import CampoFecha from "@/lib/campo-fecha";
import { formatoFecha, hoyGT } from "@/lib/fechas";
import { cambiarEtapa, crearProspecto, eliminarLead } from "./actions";

export type Lead = {
  id: string;
  nombre: string;
  contacto: string | null;
  telefono: string | null;
  email: string | null;
  ciudad: string | null;
  tipo: string;
  valor_mensual: number;
  etapa: string;
  proximo_paso: string | null;
  proximo_paso_fecha: string | null;
  notas: string | null;
  fuente?: string | null;
};

const ETAPAS = [
  ["prospecto", "Prospecto"],
  ["demo", "Demo"],
  ["propuesta", "Propuesta"],
  ["negociacion", "Negociación"],
  ["ganado", "Ganado"],
  ["perdido", "Perdido"],
] as const;
const FUENTES = [["web", "Sitio web"], ["referido", "Referido"], ["redes", "Redes sociales"], ["whatsapp", "WhatsApp"], ["evento", "Evento"], ["llamada", "Llamada en frío"], ["otro", "Otra"]] as const;

const vacio = { nombre: "", contacto: "", cargo: "", telefono: "", email: "", ciudad: "", sitioWeb: "", fuente: "web", tipo: "estudio", valor: "", numSedes: "", planInteres: "", etapa: "prospecto", proximoPaso: "", proximoPasoFecha: "" };
const input = "mt-1 w-full rounded-lg border border-white/15 bg-void px-3 py-2 text-white outline-none focus:border-lime/60";
const q = (n: number) => `Q${Number(n).toLocaleString("es-GT")}`;
const etiqueta = (e: string) => ETAPAS.find(([v]) => v === e)?.[1] ?? e;

export default function PipelineView({ leads, resumen }: { leads: Lead[]; resumen: { leads_abiertos: number; valor_pipeline: number } | null }) {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [f, setF] = useState(vacio);
  const [abierto, setAbierto] = useState(false);
  const [masDetalles, setMasDetalles] = useState(false);
  const [vista, setVista] = useState<"tablero" | "tabla">("tablero");
  const [buscar, setBuscar] = useState("");
  const [filtroEtapa, setFiltroEtapa] = useState("");
  const [orden, setOrden] = useState<"accion" | "valor" | "nombre">("accion");
  const [excepcion, setExcepcion] = useState<{ id: string; nombre: string; motivo: string } | null>(null);
  const hoy = hoyGT();

  function correr(fn: () => Promise<{ error: string | null }>, despues?: () => void) {
    setMsg(null);
    startTransition(async () => {
      const r = await fn();
      if (r.error) setMsg({ ok: false, texto: r.error });
      else despues?.();
    });
  }

  // Mover a «Ganado» sin propuesta/contrato exige una excepción con motivo; el resto de etapas pasa directo.
  function mover(l: Lead, etapa: string) {
    setMsg(null);
    startTransition(async () => {
      const r = await cambiarEtapa(l.id, etapa);
      if (r.error && etapa === "ganado" && /Ganado/.test(r.error)) setExcepcion({ id: l.id, nombre: l.nombre, motivo: "" });
      else if (r.error) setMsg({ ok: false, texto: r.error });
    });
  }

  const visibles = useMemo(() => {
    const t = buscar.trim().toLowerCase();
    const lista = leads.filter((l) => (!filtroEtapa || l.etapa === filtroEtapa) && (!t || `${l.nombre} ${l.contacto ?? ""} ${l.ciudad ?? ""} ${l.email ?? ""}`.toLowerCase().includes(t)));
    return [...lista].sort((a, b) => orden === "valor" ? b.valor_mensual - a.valor_mensual : orden === "nombre" ? a.nombre.localeCompare(b.nombre, "es")
      : (a.proximo_paso_fecha ?? "9999-12-31").localeCompare(b.proximo_paso_fecha ?? "9999-12-31"));
  }, [leads, buscar, filtroEtapa, orden]);

  const abiertaEtapa = ["prospecto", "demo", "propuesta", "negociacion"].includes(f.etapa);
  const falta = !f.nombre.trim() ? "Escribe el nombre del gimnasio o estudio"
    : abiertaEtapa && (f.proximoPaso.trim().length < 3 || !f.proximoPasoFecha) ? "Indica la próxima acción y su fecha"
    : f.etapa === "ganado" ? "Para crear una oportunidad ya ganada, regístrala primero como prospecto y sigue el flujo de propuesta y contrato" : "";

  const accionTexto = (l: Lead) => l.proximo_paso ? `${l.proximo_paso}${l.proximo_paso_fecha ? ` (${formatoFecha(l.proximo_paso_fecha)})` : ""}` : "Sin próxima acción";
  const vencida = (l: Lead) => !!l.proximo_paso_fecha && l.proximo_paso_fecha < hoy && !["ganado", "perdido"].includes(l.etapa);

  return (
    <main className="mx-auto max-w-7xl px-6 py-8 md:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Pipeline de ventas</h1>
          <p className="mt-1 text-sm text-white/60">
            {resumen?.leads_abiertos ?? 0} oportunidades abiertas · {q(resumen?.valor_pipeline ?? 0)} / mes estimados
          </p>
        </div>
        <button className="rounded-full bg-lime px-4 py-2 text-sm font-semibold text-void" onClick={() => { setF(vacio); setMasDetalles(false); setAbierto(!abierto); }}>
          + Nuevo prospecto
        </button>
      </div>

      {msg && <p role="status" className={`mt-4 rounded-xl px-4 py-3 text-sm ${msg.ok ? "bg-lime/15 text-lime" : "bg-white/10 text-white"}`}>{msg.texto}</p>}

      {abierto && (
        <section className="mt-6 rounded-2xl border border-white/10 bg-void-card p-5" aria-label="Nuevo prospecto">
          <p className="text-xs text-white/55">Lo esencial primero. Los campos con * son obligatorios.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="text-sm text-white/70">Gimnasio o estudio *
              <input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} className={input} required />
            </label>
            <label className="text-sm text-white/70">Persona de contacto
              <input value={f.contacto} onChange={(e) => setF({ ...f, contacto: e.target.value })} className={input} />
            </label>
            <label className="text-sm text-white/70">Teléfono o correo
              <input value={f.telefono} onChange={(e) => setF({ ...f, telefono: e.target.value, email: e.target.value.includes("@") ? e.target.value : f.email })} className={input} />
            </label>
            <label className="text-sm text-white/70">Etapa
              <select value={f.etapa} onChange={(e) => setF({ ...f, etapa: e.target.value })} className={input}>
                {ETAPAS.filter(([v]) => v !== "ganado").map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label className="text-sm text-white/70">Próxima acción {abiertaEtapa ? "*" : ""}
              <input value={f.proximoPaso} onChange={(e) => setF({ ...f, proximoPaso: e.target.value })} className={input} placeholder="Ej. Llamar para agendar demo" />
            </label>
            <label className="text-sm text-white/70">Fecha de la acción (dd/mm/aaaa) {abiertaEtapa ? "*" : ""}
              <CampoFecha value={f.proximoPasoFecha} onChange={(v) => setF({ ...f, proximoPasoFecha: v })} className={input} />
            </label>
          </div>
          <button type="button" className="mt-3 text-xs text-lime" aria-expanded={masDetalles} onClick={() => setMasDetalles(!masDetalles)}>
            {masDetalles ? "Ocultar detalles" : "Agregar más detalles (ciudad, sedes, plan, valor, fuente…)"}
          </button>
          {masDetalles && (
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {([["cargo", "Cargo del contacto"], ["ciudad", "Ciudad"], ["sitioWeb", "Sitio web"], ["numSedes", "Número de sedes"], ["planInteres", "Plan de interés"], ["valor", "Estimación mensual (Q / mes)"]] as const).map(([k, l]) => (
                <label key={k} className="text-sm text-white/70">{l}
                  <input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} className={input} type={k === "valor" || k === "numSedes" ? "number" : "text"} min={0} />
                </label>
              ))}
              <label className="text-sm text-white/70">Cómo llegó (fuente)
                <select value={f.fuente} onChange={(e) => setF({ ...f, fuente: e.target.value })} className={input}>
                  {FUENTES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
              <label className="text-sm text-white/70">Tipo
                <select value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })} className={input}>
                  <option value="estudio">Estudio (pilates, yoga…)</option>
                  <option value="gimnasio">Gimnasio</option>
                  <option value="otro">Otro</option>
                </select>
              </label>
            </div>
          )}
          {falta && <p className="mt-3 text-xs text-white/60">Para guardar: {falta}.</p>}
          <div className="mt-4 flex gap-3">
            <button
              className="rounded-full bg-lime px-4 py-2 text-sm font-semibold text-void disabled:opacity-50"
              disabled={isPending || !!falta}
              onClick={() => correr(() => crearProspecto({ ...f, valor: Number(f.valor || 0), numSedes: f.numSedes ? Number(f.numSedes) : null }), () => { setF(vacio); setAbierto(false); setMsg({ ok: true, texto: "Prospecto guardado." }); })}
            >
              {isPending ? "Guardando…" : "Guardar"}
            </button>
            <button className="text-sm text-white/60" onClick={() => setAbierto(false)}>Cancelar</button>
          </div>
        </section>
      )}

      {excepcion && (
        <section role="alertdialog" aria-label="Excepción para Ganado" className="mt-6 rounded-2xl border border-yellow-300/40 bg-void-card p-5">
          <h2 className="text-base font-semibold">«{excepcion.nombre}» no tiene propuesta aceptada ni contrato</h2>
          <p className="mt-1 text-sm text-white/65">Lo normal es <Link href={`/owner/pipeline/${excepcion.id}`} className="text-lime underline">crear la propuesta y el contrato</Link>. Si es una excepción real, queda registrada con tu nombre y la fecha.</p>
          <label className="mt-3 block text-sm text-white/70">Motivo de la excepción * (mínimo 10 caracteres)
            <input className={input} value={excepcion.motivo} onChange={(e) => setExcepcion({ ...excepcion, motivo: e.target.value })} />
          </label>
          <div className="mt-3 flex gap-3">
            <button className="rounded-full bg-lime px-4 py-2 text-sm font-semibold text-void disabled:opacity-50" disabled={isPending || excepcion.motivo.trim().length < 10}
              onClick={() => correr(() => cambiarEtapa(excepcion.id, "ganado", excepcion.motivo), () => setExcepcion(null))}>
              {isPending ? "Guardando…" : "Marcar como Ganado con excepción"}
            </button>
            <button className="text-sm text-white/60" onClick={() => setExcepcion(null)}>Cancelar</button>
          </div>
        </section>
      )}

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <label className="text-xs text-white/60">Buscar
          <input className={`${input} mt-1 w-56`} value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Nombre, contacto, ciudad…" />
        </label>
        <label className="text-xs text-white/60">Etapa
          <select className={`${input} mt-1 w-40`} value={filtroEtapa} onChange={(e) => setFiltroEtapa(e.target.value)}>
            <option value="">Todas</option>{ETAPAS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className="text-xs text-white/60">Ordenar por
          <select className={`${input} mt-1 w-44`} value={orden} onChange={(e) => setOrden(e.target.value as typeof orden)}>
            <option value="accion">Próxima acción</option><option value="valor">Valor estimado</option><option value="nombre">Nombre</option>
          </select>
        </label>
        <div className="ml-auto flex gap-2 text-xs" role="group" aria-label="Vista">
          {(["tablero", "tabla"] as const).map((v) => (
            <button key={v} aria-pressed={vista === v} onClick={() => setVista(v)} className={`rounded-full px-3 py-1.5 ${vista === v ? "bg-lime text-void" : "border border-white/15 text-white/70"}`}>{v === "tablero" ? "Tablero" : "Tabla"}</button>
          ))}
        </div>
      </div>

      {leads.length === 0 && <p className="mt-8 text-sm text-white/60">Todavía no hay oportunidades. Crea la primera con «+ Nuevo prospecto».</p>}

      {vista === "tablero" ? (
        <div className="mt-6 grid gap-4 overflow-x-auto md:grid-cols-3 xl:grid-cols-6">
          {ETAPAS.map(([etapa, label]) => {
            const col = visibles.filter((l) => l.etapa === etapa);
            return (
              <section key={etapa} className="min-w-[200px] rounded-2xl border border-white/10 bg-void-card p-3">
                <h2 className="px-1 text-xs font-medium tracking-wide text-white/60">
                  {label} <span className="text-white/45">({col.length})</span>
                </h2>
                <ul className="mt-3 space-y-2">
                  {col.map((l) => (
                    <li key={l.id} className="rounded-xl border border-white/10 bg-void p-3 text-sm">
                      <Link href={`/owner/pipeline/${l.id}`} className="font-medium text-white hover:text-lime">{l.nombre}</Link>
                      <p className="text-xs text-white/60">{l.tipo}{l.ciudad ? ` · ${l.ciudad}` : ""} · {q(l.valor_mensual)}/mes</p>
                      <p className={`mt-1 text-xs ${vencida(l) ? "text-red-300" : "text-white/70"}`}>→ {accionTexto(l)}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <select aria-label={`Etapa de ${l.nombre}`} value={l.etapa} disabled={isPending} onChange={(e) => mover(l, e.target.value)} className="rounded bg-void-card px-1 py-1 text-xs text-white/80">
                          {ETAPAS.map(([v, lb]) => <option key={v} value={v}>{lb}</option>)}
                        </select>
                        <button className="text-xs text-white/50 hover:text-white" disabled={isPending} onClick={() => correr(() => eliminarLead(l.id))}>Eliminar</button>
                      </div>
                    </li>
                  ))}
                  {col.length === 0 && <li className="px-1 text-xs text-white/40">Sin oportunidades</li>}
                </ul>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10 bg-void-card">
          <table className="w-full min-w-[760px] text-sm">
            <caption className="sr-only">Oportunidades del pipeline</caption>
            <thead className="text-left text-xs text-white/60">
              <tr><th className="p-3">Gimnasio / estudio</th><th>Etapa</th><th className="text-right">Estimación / mes</th><th className="pl-4">Próxima acción</th><th>Fuente</th><th></th></tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {visibles.length === 0 && <tr><td className="p-3 text-white/60" colSpan={6}>Ninguna oportunidad coincide con el filtro.</td></tr>}
              {visibles.map((l) => (
                <tr key={l.id}>
                  <td className="p-3"><Link href={`/owner/pipeline/${l.id}`} className="font-medium hover:text-lime">{l.nombre}</Link><p className="text-xs text-white/55">{l.contacto ?? "Sin contacto"}{l.ciudad ? ` · ${l.ciudad}` : ""}</p></td>
                  <td>
                    <select aria-label={`Etapa de ${l.nombre}`} value={l.etapa} disabled={isPending} onChange={(e) => mover(l, e.target.value)} className="rounded bg-void px-1 py-1 text-xs text-white/80">
                      {ETAPAS.map(([v, lb]) => <option key={v} value={v}>{lb}</option>)}
                    </select>
                    <span className="sr-only">{etiqueta(l.etapa)}</span>
                  </td>
                  <td className="text-right">{q(l.valor_mensual)}</td>
                  <td className={`pl-4 ${vencida(l) ? "text-red-300" : "text-white/75"}`}>{accionTexto(l)}</td>
                  <td className="text-white/60">{FUENTES.find(([v]) => v === l.fuente)?.[1] ?? l.fuente ?? "—"}</td>
                  <td className="pr-3 text-right"><button className="text-xs text-white/50 hover:text-white" disabled={isPending} onClick={() => correr(() => eliminarLead(l.id))}>Eliminar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
