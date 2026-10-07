"use client";

import CampoFecha from "@/lib/campo-fecha";
import { useState, useTransition } from "react";
import { cambiarEstadoPropuesta, crearContrato, guardarPropuesta } from "./propuestas-actions";

export type Propuesta = {
  id: string; version: number; estado: string; plan_key: string | null; num_sedes: number; sedes_extra: number; setup_monto: number;
  mensualidad: number; app_propia: boolean; soporte_nivel: string; inicio: string | null; notas: string | null; created_at: string;
};
export type PlanOpt = { key: string; nombre: string; precio_mensual: number; estado?: string };

const q = (n: number) => `Q${Number(n).toLocaleString("es-GT")}`;
const input = "w-full rounded-lg border border-white/15 bg-void px-2 py-1.5 text-sm text-white outline-none focus:border-lime/60";
const SIG: Record<string, string[]> = { borrador: ["enviada"], enviada: ["negociando", "aceptada", "perdida"], negociando: ["aceptada", "perdida"] };

export default function Propuestas({ leadId, propuestas, planes: planesTodos, tieneContrato }: { leadId: string; propuestas: Propuesta[]; planes: PlanOpt[]; tieneContrato: Record<string, boolean> }) {
  const ultima = propuestas.find((p) => p.estado !== "reemplazada");
  const planes = planesTodos.filter((p) => !p.estado || p.estado === "publicado"); // solo se ofrece lo publicado
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [f, setF] = useState({
    plan: ultima?.plan_key ?? "", sedes: String(ultima?.num_sedes ?? 1), sedesExtra: String(ultima?.sedes_extra ?? 0), setup: String(ultima?.setup_monto ?? 0),
    mensualidad: String(ultima?.mensualidad ?? 0), appPropia: ultima?.app_propia ?? false, soporte: ultima?.soporte_nivel ?? "estandar", inicio: ultima?.inicio ?? "", notas: "",
  });
  const [vig, setVig] = useState({ meses: "12", auto: true, doc: "", terminos: "", firmantes: "" });

  function correr(fn: () => Promise<{ error: string | null }>, ok: string, despues?: () => void) {
    setMsg(null);
    startTransition(async () => { const r = await fn(); if (r.error) setMsg(r.error); else { setMsg(ok); despues?.(); } });
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-void-card p-5 lg:col-span-2">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Propuestas y contrato</h2>
        <button className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/70" onClick={() => setAbierto(!abierto)}>
          {ultima && ultima.estado !== "borrador" ? "+ Nueva versión" : ultima ? "Editar borrador" : "+ Crear propuesta"}
        </button>
      </div>
      {msg && <p className="mt-3 rounded-xl bg-white/10 px-4 py-2 text-sm">{msg}</p>}
      {abierto && (
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <label className="text-xs text-white/50">Plan
            <select className={input} value={f.plan} onChange={(e) => { const pl = planes.find((x) => x.key === e.target.value); setF({ ...f, plan: e.target.value, mensualidad: pl ? String(pl.precio_mensual) : f.mensualidad }); }}>
              <option value="">—</option>{planes.map((p) => <option key={p.key} value={p.key}>{p.nombre}</option>)}</select></label>
          <label className="text-xs text-white/50">Sedes incluidas<input type="number" min={1} className={input} value={f.sedes} onChange={(e) => setF({ ...f, sedes: e.target.value })} /></label>
          <label className="text-xs text-white/50">Sedes adicionales<input type="number" min={0} className={input} value={f.sedesExtra} onChange={(e) => setF({ ...f, sedesExtra: e.target.value })} /></label>
          <label className="text-xs text-white/50">Inicio (dd/mm/aaaa)<CampoFecha className={input} value={f.inicio} onChange={(v) => setF({ ...f, inicio: v })} /></label>
          <label className="text-xs text-white/50">Configuración inicial (Q)<input type="number" className={input} value={f.setup} onChange={(e) => setF({ ...f, setup: e.target.value })} /></label>
          <label className="text-xs text-white/50">Mensualidad (Q)<input type="number" className={input} value={f.mensualidad} onChange={(e) => setF({ ...f, mensualidad: e.target.value })} /></label>
          <label className="text-xs text-white/50">Soporte
            <select className={input} value={f.soporte} onChange={(e) => setF({ ...f, soporte: e.target.value })}><option value="estandar">Estándar</option><option value="prioritario">Prioritario</option></select></label>
          <label className="flex items-end gap-2 pb-1.5 text-xs text-white/60"><input type="checkbox" checked={f.appPropia} onChange={(e) => setF({ ...f, appPropia: e.target.checked })} /> App de marca propia</label>
          <input aria-label="Notas: qué cambió en esta versión" className={`${input} sm:col-span-3`} placeholder="Notas / qué cambió" value={f.notas} onChange={(e) => setF({ ...f, notas: e.target.value })} />
          <button className="rounded-full bg-lime px-4 py-1.5 text-sm font-semibold text-void disabled:opacity-50" disabled={isPending}
            onClick={() => correr(() => guardarPropuesta(leadId, { plan: f.plan, sedes: Number(f.sedes || 1), sedesExtra: Number(f.sedesExtra || 0), setup: Number(f.setup || 0), mensualidad: Number(f.mensualidad || 0), appPropia: f.appPropia, soporte: f.soporte, inicio: f.inicio, notas: f.notas }), "Propuesta guardada.", () => setAbierto(false))}>Guardar</button>
        </div>
      )}
      <ul className="mt-4 divide-y divide-white/10">
        {propuestas.length === 0 && <li className="py-2 text-sm text-white/50">Aún no hay propuestas.</li>}
        {propuestas.map((p) => (
          <li key={p.id} className={`py-3 text-sm ${p.estado === "reemplazada" ? "opacity-45" : ""}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span><strong>v{p.version}</strong> · {p.plan_key ?? "sin plan"} · {p.num_sedes + p.sedes_extra} sede(s) · setup {q(p.setup_monto)} · {q(p.mensualidad)}/mes{p.app_propia ? " · app propia" : ""}
                <span className={`ml-2 text-xs ${p.estado === "aceptada" ? "text-lime" : p.estado === "perdida" ? "text-red-300" : "text-white/50"}`}>{p.estado}</span></span>
              <span className="flex gap-2">
                {(SIG[p.estado] ?? []).map((e) => (
                  <button key={e} className="rounded-full border border-white/15 px-2.5 py-1 text-xs text-white/75 hover:text-white" disabled={isPending} onClick={() => correr(() => cambiarEstadoPropuesta(leadId, p.id, e), `Propuesta ${e}.`)}>{e}</button>
                ))}
              </span>
            </div>
            {p.notas && <p className="text-xs text-white/45">{p.notas}</p>}
            {p.estado === "aceptada" && !tieneContrato[p.id] && (
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <label className="text-xs text-white/50">Vigencia (meses)<input type="number" min={1} className={`${input} w-24`} value={vig.meses} onChange={(e) => setVig({ ...vig, meses: e.target.value })} /></label>
                <label className="flex items-center gap-2 pb-1.5 text-xs text-white/60"><input type="checkbox" checked={vig.auto} onChange={(e) => setVig({ ...vig, auto: e.target.checked })} /> Renovación automática</label>
                <label className="text-xs text-white/50">Enlace al documento<input className={`${input} w-56`} value={vig.doc} onChange={(e) => setVig({ ...vig, doc: e.target.value })} /></label>
                <label className="text-xs text-white/50">Versión de los términos<input className={`${input} w-40`} placeholder="Ej. T&C 2026-10" value={vig.terminos} onChange={(e) => setVig({ ...vig, terminos: e.target.value })} /></label>
                <button className="rounded-full bg-lime px-4 py-1.5 text-xs font-semibold text-void" disabled={isPending} onClick={() => correr(() => crearContrato(leadId, p.id, Number(vig.meses || 12), vig.auto, vig.doc, vig.terminos), "Contrato creado.")}>Crear contrato</button>
              </div>
            )}
            {p.estado === "aceptada" && tieneContrato[p.id] && <p className="mt-1 text-xs text-lime">Contrato creado · ver en Contratos</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
