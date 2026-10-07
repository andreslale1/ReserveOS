"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { formatoFecha, hoyGT } from "@/lib/fechas";
import { altaManual, marcarEtapa, marcarHitoModulo, publicarProyecto, vincularEstudio } from "./actions";

type Etapa = { key: string; nombre: string; obligatoria: boolean; hecha: boolean };
export type Proyecto = {
  id: string; nombre: string; estado: string; tenant_id: string | null; lead_id: string | null; etapas: Etapa[]; created_at: string; en_vivo_at: string | null;
  excepcion_motivo?: string | null;
};
export type Gate = { key: string; nombre: string; ok: boolean; bloquea: boolean; detalle: string };
export type ModuloEstado = {
  module_key: string; nombre: string; contratado: boolean; habilitado: boolean; configurado: boolean; probado: boolean; produccion: boolean;
  estado: string; falta: string | null; evidencia: string | null;
};

const input = "mt-1 rounded-lg border border-white/15 bg-void px-2 py-1.5 text-sm text-white outline-none focus:border-lime/60";
const ETIQ_ESTADO: Record<string, string> = { no_contratado: "No contratado", contratado: "Contratado", habilitado: "Habilitado", configurado: "Configurado", probado: "Probado", en_produccion: "En producción" };
const PASOS: [keyof ModuloEstado, string][] = [["contratado", "Contratado"], ["habilitado", "Habilitado"], ["configurado", "Configurado"], ["probado", "Probado"], ["produccion", "En producción"]];

export default function ActivacionesView({ proyectos, tenants, gates, modulos }: { proyectos: Proyecto[]; tenants: { id: string; name: string }[]; gates: Record<string, Gate[]>; modulos: Record<string, ModuloEstado[]> }) {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [sel, setSel] = useState<Record<string, string>>({});
  const [excepcion, setExcepcion] = useState<Record<string, string>>({});
  const [evidencia, setEvidencia] = useState<Record<string, string>>({});
  const [manual, setManual] = useState<{ slug: string; nombre: string; sede: string; motivo: string; email: string; nombreDuena: string; confirmar: boolean; pide: boolean } | null>(null);
  const [enlace, setEnlace] = useState<string | null>(null);

  function correr(fn: () => Promise<{ error: string | null }>, ok?: string, despues?: () => void) {
    setMsg(null);
    startTransition(async () => { const r = await fn(); if (r.error) setMsg({ ok: false, texto: r.error }); else { if (ok) setMsg({ ok: true, texto: ok }); despues?.(); } });
  }
  function crearManual() {
    if (!manual) return;
    setMsg(null); setEnlace(null);
    startTransition(async () => {
      const r = await altaManual(manual);
      if (r.error) { setMsg({ ok: false, texto: r.error }); if (/Posible duplicado/.test(r.error)) setManual({ ...manual, pide: true }); return; }
      setMsg({ ok: true, texto: "Estudio creado por alta manual excepcional. Queda marcado con su motivo." });
      if (r.token) setEnlace(`${window.location.origin}/invitar/personal/${r.token}`);
      setManual(null);
    });
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-8 md:px-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Activaciones</h1>
          <p className="mt-1 text-sm text-white/60">Cada oportunidad ganada crea un proyecto para dejar al estudio funcionando. El estudio solo sale en vivo cuando pasa todas las puertas; si no, hace falta una excepción con motivo, que queda registrada.</p>
        </div>
        <button className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/75 hover:text-white" onClick={() => setManual(manual ? null : { slug: "", nombre: "", sede: "", motivo: "", email: "", nombreDuena: "", confirmar: false, pide: false })}>
          Alta manual excepcional
        </button>
      </div>
      {msg && <p role="status" className={`mt-4 rounded-xl px-4 py-3 text-sm ${msg.ok ? "bg-lime/15 text-lime" : "bg-white/10 text-white"}`}>{msg.texto}</p>}
      {enlace && (
        <div className="mt-3 rounded-xl border border-white/10 bg-void-card p-4 text-sm">
          <p className="font-medium">Enlace de invitación para la dueña:</p>
          <p className="mt-1 break-all text-lime">{enlace}</p>
          <button className="mt-2 text-xs text-white/70 underline" onClick={() => navigator.clipboard?.writeText(enlace)}>Copiar enlace</button>
        </div>
      )}

      {manual && (
        <section className="mt-5 rounded-2xl border border-yellow-300/30 bg-void-card p-5" aria-label="Alta manual excepcional">
          <h2 className="text-base font-semibold">Alta manual excepcional</h2>
          <p className="mt-1 text-xs text-white/60">Úsala solo cuando no hay contrato (piloto, estudio interno, caso especial). El camino normal es Pipeline → propuesta → contrato → «Crear estudio». Queda registrado el motivo.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="text-xs text-white/60">Nombre comercial *<input className={`${input} block w-full`} value={manual.nombre} onChange={(e) => setManual({ ...manual, nombre: e.target.value })} /></label>
            <label className="text-xs text-white/60">Enlace (reserveos.app/e/…) *<input className={`${input} block w-full`} value={manual.slug} onChange={(e) => setManual({ ...manual, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} /></label>
            <label className="text-xs text-white/60">Primera sede *<input className={`${input} block w-full`} value={manual.sede} onChange={(e) => setManual({ ...manual, sede: e.target.value })} /></label>
            <label className="text-xs text-white/60 sm:col-span-3">Motivo de la excepción * (mínimo 10 caracteres)<input className={`${input} block w-full`} value={manual.motivo} onChange={(e) => setManual({ ...manual, motivo: e.target.value })} /></label>
            <label className="text-xs text-white/60">Correo de la dueña<input type="email" className={`${input} block w-full`} value={manual.email} onChange={(e) => setManual({ ...manual, email: e.target.value })} /></label>
            <label className="text-xs text-white/60">Nombre de la dueña<input className={`${input} block w-full`} value={manual.nombreDuena} onChange={(e) => setManual({ ...manual, nombreDuena: e.target.value })} /></label>
          </div>
          {manual.pide && <label className="mt-3 flex items-center gap-2 text-xs text-yellow-200"><input type="checkbox" checked={manual.confirmar} onChange={(e) => setManual({ ...manual, confirmar: e.target.checked })} /> Revisé el posible duplicado y quiero continuar</label>}
          <div className="mt-3 flex gap-3">
            <button className="rounded-full bg-lime px-4 py-1.5 text-xs font-semibold text-void disabled:opacity-50" disabled={isPending || manual.nombre.trim().length < 2 || manual.slug.length < 2 || manual.sede.trim().length < 2 || manual.motivo.trim().length < 10 || (manual.pide && !manual.confirmar)} onClick={crearManual}>
              {isPending ? "Creando…" : "Crear estudio"}
            </button>
            <button className="text-xs text-white/60" onClick={() => setManual(null)}>Cancelar</button>
          </div>
        </section>
      )}

      {proyectos.length === 0 && (
        <p className="mt-8 text-sm text-white/60">Aún no hay proyectos. Aparecen cuando una oportunidad se gana en el <Link href="/owner/pipeline" className="text-lime underline">Pipeline</Link>; de ahí pasan a propuesta, contrato y alta del estudio.</p>
      )}
      <div className="mt-6 grid gap-5">
        {proyectos.map((p) => {
          const hechas = p.etapas.filter((e) => e.hecha).length;
          const obligFalta = p.etapas.filter((e) => e.obligatoria && !e.hecha).length;
          const g = gates[p.id] ?? [];
          const bloqueos = g.filter((x) => x.bloquea && !x.ok);
          const mods = modulos[p.id] ?? [];
          const enCurso = p.estado === "en_curso";
          return (
            <section key={p.id} className="rounded-2xl border border-white/10 bg-void-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold">{p.nombre}</h2>
                  <p className="text-xs text-white/60">{hechas}/{p.etapas.length} etapas · {p.estado === "en_vivo" ? `en vivo desde ${formatoFecha(p.en_vivo_at ? hoyGT(new Date(p.en_vivo_at)) : null)}` : p.estado === "cancelado" ? "cancelado" : `${obligFalta} obligatorias pendientes`}
                    {p.lead_id && <> · <Link href={`/owner/pipeline/${p.lead_id}`} className="text-lime underline">ver oportunidad</Link></>}</p>
                  {p.excepcion_motivo && <p className="mt-1 text-xs text-yellow-200">Excepción registrada: {p.excepcion_motivo}</p>}
                </div>
                {enCurso && (
                  <div className="flex flex-wrap items-center gap-2">
                    {!p.tenant_id && (
                      <>
                        <select aria-label="Estudio a vincular" className={input} value={sel[p.id] ?? ""} onChange={(e) => setSel({ ...sel, [p.id]: e.target.value })}>
                          <option value="">Vincular estudio creado…</option>
                          {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                        <button className="rounded-full border border-white/15 px-3 py-1.5 text-xs disabled:opacity-50" disabled={isPending || !(sel[p.id])} onClick={() => correr(() => vincularEstudio(p.id, sel[p.id]), "Estudio vinculado.")}>Vincular</button>
                      </>
                    )}
                    {!p.tenant_id && <span className="text-xs text-white/55">o crea el estudio desde <Link href="/owner/contratos" className="text-lime underline">su contrato</Link></span>}
                  </div>
                )}
              </div>

              {enCurso && p.tenant_id && (
                <div className="mt-4 rounded-xl border border-white/10 bg-void p-4">
                  <h3 className="text-sm font-medium">Puertas para salir en vivo</h3>
                  <ul className="mt-2 grid gap-1 text-sm">
                    {g.map((x) => (
                      <li key={x.key} className="flex items-start gap-2">
                        <span aria-hidden className={x.ok ? "text-lime" : x.bloquea ? "text-red-300" : "text-yellow-300"}>{x.ok ? "✓" : x.bloquea ? "✗" : "!"}</span>
                        <span><span className="sr-only">{x.ok ? "Cumplida: " : x.bloquea ? "Bloquea: " : "Aviso: "}</span><strong className="font-medium">{x.nombre}</strong> <span className="text-white/60">· {x.detalle}</span></span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex flex-wrap items-end gap-2">
                    {bloqueos.length === 0 ? (
                      <button className="rounded-full bg-lime px-4 py-1.5 text-xs font-semibold text-void disabled:opacity-50" disabled={isPending} onClick={() => correr(() => publicarProyecto(p.id), "¡Estudio en vivo! Su suscripción quedó activa.")}>
                        {isPending ? "Publicando…" : "Salir en vivo"}
                      </button>
                    ) : (
                      <>
                        <label className="text-xs text-white/60">Excepción: por qué sale en vivo sin cumplir las puertas * (mínimo 10 caracteres)
                          <input className={`${input} block w-96 max-w-full`} value={excepcion[p.id] ?? ""} onChange={(e) => setExcepcion({ ...excepcion, [p.id]: e.target.value })} />
                        </label>
                        <button className="rounded-full border border-yellow-300/50 px-3 py-1.5 text-xs text-yellow-200 disabled:opacity-50" disabled={isPending || (excepcion[p.id] ?? "").trim().length < 10}
                          onClick={() => correr(() => publicarProyecto(p.id, excepcion[p.id]), "Estudio en vivo con excepción registrada.")}>
                          {isPending ? "Publicando…" : "Salir en vivo con excepción"}
                        </button>
                        <span className="text-xs text-white/55">{bloqueos.length} puerta(s) pendiente(s)</span>
                      </>
                    )}
                  </div>
                </div>
              )}

              {p.tenant_id && mods.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium">Estado de cada módulo</h3>
                  <p className="text-xs text-white/55">Contratado ≠ habilitado ≠ configurado ≠ probado ≠ en producción. Un módulo encendido no significa que esté funcionando.</p>
                  <ul className="mt-2 grid gap-2">
                    {mods.map((m) => (
                      <li key={m.module_key} className="rounded-xl border border-white/10 bg-void p-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <strong className="font-medium">{m.nombre}</strong>
                          <span className="text-xs text-white/70">{ETIQ_ESTADO[m.estado] ?? m.estado}</span>
                        </div>
                        <ol className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label={`Avance de ${m.nombre}`}>
                          {PASOS.map(([k, l]) => <li key={k} className={m[k] ? "text-lime" : "text-white/45"}>{m[k] ? "✓" : "○"} {l}</li>)}
                        </ol>
                        {m.falta && <p className="mt-1 text-xs text-yellow-200">{m.falta}</p>}
                        {m.evidencia && <p className="mt-1 text-xs text-white/55">Evidencia: {m.evidencia}</p>}
                        {m.habilitado && (
                          <div className="mt-2 flex flex-wrap items-end gap-2">
                            {!m.configurado && <button className="rounded-full border border-white/15 px-3 py-1 text-xs disabled:opacity-50" disabled={isPending} onClick={() => correr(() => marcarHitoModulo(p.tenant_id!, m.module_key, "configurado", true), "Módulo marcado como configurado.")}>Marcar configurado</button>}
                            {m.configurado && !m.probado && (
                              <>
                                <label className="text-xs text-white/60">Evidencia de la prueba *<input className={`${input} block w-72 max-w-full`} value={evidencia[`${p.id}:${m.module_key}`] ?? ""} onChange={(e) => setEvidencia({ ...evidencia, [`${p.id}:${m.module_key}`]: e.target.value })} placeholder="Qué se probó y el resultado" /></label>
                                <button className="rounded-full border border-white/15 px-3 py-1 text-xs disabled:opacity-50" disabled={isPending || (evidencia[`${p.id}:${m.module_key}`] ?? "").trim().length < 5} onClick={() => correr(() => marcarHitoModulo(p.tenant_id!, m.module_key, "probado", true, evidencia[`${p.id}:${m.module_key}`]), "Prueba registrada.")}>Registrar prueba</button>
                              </>
                            )}
                            {m.probado && !m.produccion && m.contratado && <button className="rounded-full border border-white/15 px-3 py-1 text-xs disabled:opacity-50" disabled={isPending} onClick={() => correr(() => marcarHitoModulo(p.tenant_id!, m.module_key, "produccion", true), "Módulo aprobado para producción.")}>Aprobar para producción</button>}
                            {m.configurado && <button className="text-xs text-white/50 hover:text-white" disabled={isPending} onClick={() => correr(() => marcarHitoModulo(p.tenant_id!, m.module_key, "configurado", false), "Se quitó la configuración (y las pruebas que dependían de ella).")}>Deshacer configuración</button>}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <h3 className="mt-4 text-sm font-medium">Checklist</h3>
              <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                {p.etapas.map((e) => (
                  <li key={e.key} className="flex items-center gap-2 text-sm">
                    <input id={`${p.id}-${e.key}`} type="checkbox" checked={e.hecha} disabled={isPending || !enCurso} onChange={(x) => correr(() => marcarEtapa(p.id, e.key, x.target.checked))} />
                    <label htmlFor={`${p.id}-${e.key}`} className={e.hecha ? "text-white/50 line-through" : ""}>{e.nombre}{!e.obligatoria && <span className="text-xs text-white/50"> (opcional)</span>}</label>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </main>
  );
}
