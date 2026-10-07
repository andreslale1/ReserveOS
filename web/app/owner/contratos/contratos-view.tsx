"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { formatoFecha } from "@/lib/fechas";
import { actualizarContrato, altaDesdeContrato, aplicarSuscripcion, cambiarEstadoContrato } from "./actions";

export type Contrato = {
  id: string; lead_id: string | null; empresa: string | null; tenant_id: string | null; estudio: string | null; estado: string; fecha_firma: string;
  vigencia_meses: number; fecha_vencimiento: string; dias_para_vencer: number; renovacion_auto: boolean; mensualidad: number; setup_monto: number;
  documento_url: string | null; notas: string | null; version_propuesta: number | null;
  plan_key?: string | null; version_terminos?: string | null; firmantes?: string | null; alcance_sedes?: number | null; alcance_modulos?: string[]; con_suscripcion?: boolean;
};
const q = (n: number) => `Q${Number(n).toLocaleString("es-GT")}`;
const input = "mt-1 rounded-lg border border-white/15 bg-void px-2 py-1.5 text-sm text-white outline-none focus:border-lime/60";
const ESTADOS: Record<string, { texto: string; clase: string; siguiente?: [string, string] }> = {
  borrador: { texto: "Borrador", clase: "bg-white/10 text-white/80", siguiente: ["enviado", "Marcar como enviado"] },
  enviado: { texto: "Enviado a firma", clase: "bg-blue-400/15 text-blue-200", siguiente: ["firmado", "Registrar firma"] },
  firmado: { texto: "Firmado", clase: "bg-yellow-300/15 text-yellow-200", siguiente: ["vigente", "Poner vigente"] },
  vigente: { texto: "Vigente", clase: "bg-lime/15 text-lime" },
  vencido: { texto: "Vencido", clase: "bg-red-400/15 text-red-300" },
  cancelado: { texto: "Cancelado", clase: "bg-white/5 text-white/55" },
};

export default function ContratosView({ contratos, estudios }: { contratos: Contrato[]; estudios: { id: string; name: string }[] }) {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [sel, setSel] = useState<Record<string, string>>({});
  const [firmantes, setFirmantes] = useState<Record<string, string>>({});
  const [alta, setAlta] = useState<{ id: string; slug: string; nombre: string; sede: string; email: string; nombreDuena: string; confirmar: boolean; pideConfirmar: boolean } | null>(null);
  const [enlace, setEnlace] = useState<string | null>(null);
  const [cancelando, setCancelando] = useState<{ id: string; motivo: string } | null>(null);

  function correr(fn: () => Promise<{ error: string | null }>, ok: string, despues?: () => void) {
    setMsg(null);
    startTransition(async () => { const r = await fn(); if (r.error) setMsg({ ok: false, texto: r.error }); else { setMsg({ ok: true, texto: ok }); despues?.(); } });
  }
  function crearEstudio() {
    if (!alta) return;
    setMsg(null); setEnlace(null);
    startTransition(async () => {
      const r = await altaDesdeContrato({ contratoId: alta.id, slug: alta.slug, nombre: alta.nombre, sede: alta.sede, zona: "America/Guatemala", email: alta.email, nombreDuena: alta.nombreDuena, confirmar: alta.confirmar });
      if (r.error) {
        setMsg({ ok: false, texto: r.error });
        if (/Posible duplicado/.test(r.error)) setAlta({ ...alta, pideConfirmar: true });
        return;
      }
      setMsg({ ok: true, texto: r.resultado?.reanudado ? "Alta reanudada: el estudio ya existía y se completó lo que faltaba." : "Estudio creado en borrador. Sigue su checklist en Activaciones." });
      if (r.resultado?.token) setEnlace(`${window.location.origin}/invitar/personal/${r.resultado.token}`);
      setAlta(null);
    });
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-8 md:px-10">
      <h1 className="text-2xl font-semibold">Contratos y renovaciones</h1>
      <p className="mt-1 text-sm text-white/60">Cada contrato nace de una propuesta aceptada y pasa por borrador, enviado, firmado y vigente. Solo un contrato vigente da de alta el estudio y fija el plan y el precio de su suscripción.</p>
      {msg && <p role="status" className={`mt-4 rounded-xl px-4 py-3 text-sm ${msg.ok ? "bg-lime/15 text-lime" : "bg-white/10 text-white"}`}>{msg.texto}</p>}
      {enlace && (
        <div className="mt-3 rounded-xl border border-white/10 bg-void-card p-4 text-sm">
          <p className="font-medium">Enlace de invitación para la dueña (cópialo y envíaselo):</p>
          <p className="mt-1 break-all text-lime">{enlace}</p>
          <button className="mt-2 text-xs text-white/70 underline" onClick={() => navigator.clipboard?.writeText(enlace)}>Copiar enlace</button>
        </div>
      )}
      <ul className="mt-6 grid gap-4">
        {contratos.length === 0 && (
          <li className="rounded-2xl border border-white/10 bg-void-card p-6 text-sm text-white/70">
            Aún no hay contratos. Un contrato se crea desde una propuesta aceptada: abre una oportunidad en el <Link href="/owner/pipeline" className="text-lime underline">Pipeline</Link>, crea y envía la propuesta y, al aceptarla, elige «Crear contrato».
          </li>
        )}
        {contratos.map((c) => {
          const e = ESTADOS[c.estado] ?? ESTADOS.borrador;
          const aviso = c.estado === "vigente" && c.dias_para_vencer <= 60;
          const abierto = ["borrador", "enviado", "firmado"].includes(c.estado);
          return (
            <li key={c.id} className="rounded-2xl border border-white/10 bg-void-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-base font-semibold">{c.empresa ?? "—"} {c.version_propuesta ? <span className="text-xs font-normal text-white/55">· propuesta v{c.version_propuesta}</span> : null}</p>
                  <p className="text-xs text-white/60">Firma {formatoFecha(c.fecha_firma)} · {c.vigencia_meses} meses · vence {formatoFecha(c.fecha_vencimiento)}{c.renovacion_auto ? " · renovación automática" : ""}</p>
                  <p className="mt-1 text-sm">{q(c.mensualidad)} / mes · configuración inicial {q(c.setup_monto)}</p>
                  <p className="mt-1 text-xs text-white/60">
                    Plan: {c.plan_key ?? "—"} · alcance: {c.alcance_sedes ?? "—"} sede(s), {(c.alcance_modulos ?? []).length} módulo(s)
                    {c.version_terminos ? ` · términos ${c.version_terminos}` : ""}{c.firmantes ? ` · firmantes: ${c.firmantes}` : ""}
                  </p>
                </div>
                <div className="text-right text-xs">
                  <span className={`rounded-full px-2.5 py-1 ${e.clase}`}>{e.texto}</span>
                  {aviso && <p className={c.dias_para_vencer < 0 ? "mt-1 text-red-300" : "mt-1 text-yellow-300"}>{c.dias_para_vencer < 0 ? `Venció hace ${-c.dias_para_vencer} días` : `Vence en ${c.dias_para_vencer} días`}</p>}
                  {c.lead_id && <Link href={`/owner/pipeline/${c.lead_id}`} className="mt-1 block text-white/60 hover:text-white">Ir a la oportunidad</Link>}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-end gap-2">
                {e.siguiente && (
                  <>
                    {e.siguiente[0] === "firmado" && (
                      <label className="text-xs text-white/60">Firmantes *
                        <input className={`${input} block w-64`} value={firmantes[c.id] ?? c.firmantes ?? ""} onChange={(x) => setFirmantes({ ...firmantes, [c.id]: x.target.value })} placeholder="Quién firmó por el estudio y por ReserveOS" />
                      </label>
                    )}
                    <button className="rounded-full bg-lime px-4 py-1.5 text-xs font-semibold text-void disabled:opacity-50"
                      disabled={isPending || (e.siguiente[0] === "firmado" && (firmantes[c.id] ?? c.firmantes ?? "").trim().length < 3)}
                      onClick={() => correr(() => cambiarEstadoContrato(c.id, e.siguiente![0], firmantes[c.id] ?? "", ""), `Contrato: ${ESTADOS[e.siguiente![0]].texto.toLowerCase()}.`)}>
                      {isPending ? "Guardando…" : e.siguiente[1]}
                    </button>
                  </>
                )}
                {(abierto || c.estado === "vigente") && !(cancelando?.id === c.id) && (
                  <button className="text-xs text-white/55 hover:text-white" onClick={() => setCancelando({ id: c.id, motivo: "" })}>Cancelar contrato</button>
                )}
                {c.documento_url && <a href={c.documento_url} target="_blank" rel="noreferrer" className="text-xs text-lime underline">Ver documento</a>}
              </div>

              {cancelando?.id === c.id && (
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <label className="text-xs text-white/60">Motivo de la cancelación *
                    <input className={`${input} block w-72`} value={cancelando.motivo} onChange={(x) => setCancelando({ id: c.id, motivo: x.target.value })} />
                  </label>
                  <button className="rounded-full border border-red-300/50 px-3 py-1.5 text-xs text-red-300 disabled:opacity-50" disabled={isPending || cancelando.motivo.trim().length < 3}
                    onClick={() => correr(() => cambiarEstadoContrato(c.id, "cancelado", "", cancelando.motivo), "Contrato cancelado.", () => setCancelando(null))}>Confirmar cancelación</button>
                  <button className="text-xs text-white/55" onClick={() => setCancelando(null)}>No cancelar</button>
                </div>
              )}

              {c.estado === "vigente" && (
                <div className="mt-4 border-t border-white/10 pt-3">
                  {c.tenant_id ? (
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <span>Estudio: <strong>{c.estudio}</strong></span>
                      <button className="rounded-full border border-white/15 px-3 py-1.5 text-xs disabled:opacity-50" disabled={isPending}
                        onClick={() => correr(() => aplicarSuscripcion(c.id), "Suscripción actualizada con el plan y precio del contrato.")}>
                        {c.con_suscripcion ? "Re-aplicar a la suscripción" : "Aplicar a la suscripción"}
                      </button>
                      <button className="text-xs text-white/60 underline" onClick={() => setAlta({ id: c.id, slug: "", nombre: c.empresa ?? "", sede: "", email: "", nombreDuena: "", confirmar: false, pideConfirmar: false })}>Completar alta (invitar dueña)</button>
                      <Link href="/owner/activaciones" className="text-xs text-lime underline">Ver checklist de activación</Link>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3">
                      <button className="rounded-full bg-lime px-4 py-1.5 text-xs font-semibold text-void" onClick={() => setAlta({ id: c.id, slug: "", nombre: c.empresa ?? "", sede: "", email: "", nombreDuena: "", confirmar: false, pideConfirmar: false })}>Crear estudio desde este contrato</button>
                      <span className="text-xs text-white/55">o vincula uno que ya existe:</span>
                      <select aria-label="Estudio existente" className={input} value={sel[c.id] ?? ""} onChange={(x) => setSel({ ...sel, [c.id]: x.target.value })}>
                        <option value="">Elegir estudio…</option>{estudios.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                      <button className="rounded-full border border-white/15 px-3 py-1.5 text-xs disabled:opacity-50" disabled={isPending || !sel[c.id]}
                        onClick={() => correr(() => actualizarContrato(c.id, c.estado, sel[c.id], c.renovacion_auto, c.documento_url ?? "", c.notas ?? ""), "Estudio vinculado.")}>Vincular</button>
                    </div>
                  )}
                </div>
              )}

              {alta?.id === c.id && (
                <div className="mt-4 rounded-xl border border-white/10 bg-void p-4" role="group" aria-label="Alta guiada del estudio">
                  <p className="text-sm font-medium">Alta guiada del estudio</p>
                  <p className="mt-1 text-xs text-white/60">Se crea en borrador con su primera sede, el plan del contrato y la suscripción en pausa (se activa al salir en vivo). Se detectan enlaces y nombres duplicados.</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    {c.tenant_id ? null : (
                      <>
                        <label className="text-xs text-white/60">Nombre comercial *<input className={`${input} w-full`} value={alta.nombre} onChange={(x) => setAlta({ ...alta, nombre: x.target.value })} /></label>
                        <label className="text-xs text-white/60">Enlace (reserveos.app/e/…) *<input className={`${input} w-full`} value={alta.slug} onChange={(x) => setAlta({ ...alta, slug: x.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} /></label>
                        <label className="text-xs text-white/60">Primera sede *<input className={`${input} w-full`} value={alta.sede} onChange={(x) => setAlta({ ...alta, sede: x.target.value })} /></label>
                      </>
                    )}
                    <label className="text-xs text-white/60">Correo de la dueña<input type="email" className={`${input} w-full`} value={alta.email} onChange={(x) => setAlta({ ...alta, email: x.target.value })} /></label>
                    <label className="text-xs text-white/60">Nombre de la dueña<input className={`${input} w-full`} value={alta.nombreDuena} onChange={(x) => setAlta({ ...alta, nombreDuena: x.target.value })} /></label>
                  </div>
                  {alta.pideConfirmar && (
                    <label className="mt-3 flex items-center gap-2 text-xs text-yellow-200"><input type="checkbox" checked={alta.confirmar} onChange={(x) => setAlta({ ...alta, confirmar: x.target.checked })} /> Revisé el posible duplicado y quiero continuar</label>
                  )}
                  <div className="mt-3 flex gap-3">
                    <button className="rounded-full bg-lime px-4 py-1.5 text-xs font-semibold text-void disabled:opacity-50"
                      disabled={isPending || (!c.tenant_id && (alta.nombre.trim().length < 2 || alta.slug.length < 2 || alta.sede.trim().length < 2)) || (alta.pideConfirmar && !alta.confirmar)} onClick={crearEstudio}>
                      {isPending ? "Creando…" : c.tenant_id ? "Completar alta" : "Crear estudio"}
                    </button>
                    <button className="text-xs text-white/60" onClick={() => setAlta(null)}>Cancelar</button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
