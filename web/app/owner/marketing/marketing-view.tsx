"use client";

import { useRef, useState, useTransition } from "react";
import { Campo, enfocarPrimerError, inputOwner } from "@/components/owner/campo";
import { EstadoVacio } from "@/components/owner/estado-vacio";
import { excluirCorreo, guardarCampana } from "./actions";

export type Campana = {
  id: string; nombre: string; canal: string; fuente: string; presupuesto: number; inicio: string | null; fin: string | null; estado: string; notas: string | null;
  prospectos: number; demos: number; propuestas: number; ganados: number; valor_ganado: number; costo_por_prospecto: number | null;
};
export type Exclusion = { email: string; motivo: string | null };

const CANALES = ["email", "redes", "evento", "referido", "web", "alianza", "otro"];
const vacio = { id: null as string | null, nombre: "", canal: "redes", fuente: "", presupuesto: "", inicio: "", fin: "", estado: "planificada", notas: "" };
const q = (n: number) => `Q${Number(n).toLocaleString("es-GT")}`;

export default function MarketingView({ campanas, exclusiones }: { campanas: Campana[]; exclusiones: Exclusion[] }) {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [copiado, setCopiado] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const exRef = useRef<HTMLFormElement>(null);
  const [f, setF] = useState(vacio);
  const [abierto, setAbierto] = useState(false);
  const [ex, setEx] = useState({ email: "", motivo: "" });
  const sitio = "https://reserveos.app";

  function correr(fn: () => Promise<{ error: string | null }>, ok: string, despues?: () => void) {
    setMsg(null);
    startTransition(async () => { const r = await fn(); if (r.error) setMsg({ ok: false, texto: r.error }); else { setMsg({ ok: true, texto: ok }); despues?.(); } });
  }
  const slug = (v: string) => v.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const enlace = f.fuente.trim().length >= 2 ? `${sitio}/contacto?fuente=${slug(f.fuente)}` : "";
  function guardar(e: React.FormEvent) {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (f.nombre.trim().length < 2) er.nombre = "Escribe el nombre de la campaña.";
    if (f.fuente.trim().length < 2) er.fuente = "La fuente es lo que une cada oportunidad con la campaña.";
    if (f.inicio && f.fin && f.fin < f.inicio) er.fin = "La fecha de fin debe ser posterior al inicio.";
    if (f.presupuesto && Number(f.presupuesto) < 0) er.presupuesto = "El presupuesto no puede ser negativo.";
    setErrs(er);
    if (Object.keys(er).length) { setTimeout(() => enfocarPrimerError(formRef.current), 0); return; }
    correr(() => guardarCampana({ ...f, fuente: slug(f.fuente), presupuesto: Number(f.presupuesto || 0) }), "Campaña guardada.", () => { setAbierto(false); setF(vacio); });
  }
  function excluir(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(ex.email)) { setErrs({ exEmail: "Escribe un correo válido." }); setTimeout(() => enfocarPrimerError(exRef.current), 0); return; }
    setErrs({});
    correr(() => excluirCorreo(ex.email, ex.motivo), "Correo excluido.", () => setEx({ email: "", motivo: "" }));
  }
  const fechaCorta = (v: string | null) => (v ? v.split("-").reverse().join("/") : "");
  const totalProspectos = campanas.reduce((a, c) => a + Number(c.prospectos), 0);
  const totalGanados = campanas.reduce((a, c) => a + Number(c.ganados), 0);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8 md:px-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Marketing de ReserveOS</h1>
          <p className="mt-1 text-sm text-white/70">Campañas para captar gimnasios y estudios. La atribución usa la <strong>fuente</strong> registrada en cada oportunidad; no se afirma causalidad por una visita.</p>
        </div>
        <button type="button" aria-expanded={abierto} className="rounded-full bg-lime px-4 py-2 text-sm font-semibold text-void" onClick={() => { setF(vacio); setErrs({}); setAbierto(!abierto); }}>+ Nueva campaña</button>
      </div>
      <div aria-live="polite">{msg && <p role={msg.ok ? "status" : "alert"} className={`mt-4 rounded-xl px-4 py-3 text-sm ${msg.ok ? "bg-lime/15 text-lime" : "bg-red-400/15 text-red-200"}`}>{msg.texto}</p>}</div>

      <section className="mt-6 rounded-2xl border border-lime/30 bg-void-card p-5 text-sm">
        <h2 className="text-base font-semibold">Formulario de captación</h2>
        <p className="mt-1 text-white/70">Cada consulta crea o vincula la empresa y el contacto, abre la oportunidad con su fuente y genera una tarea para responder hoy. Usa un enlace distinto por campaña:</p>
        <code className="mt-2 block break-all rounded-lg bg-void px-3 py-2 text-xs text-lime">{sitio}/contacto?fuente=<em>la-fuente-de-tu-campaña</em></code>
      </section>

      {abierto && (
        <form ref={formRef} onSubmit={guardar} noValidate aria-label={f.id ? "Editar campaña" : "Nueva campaña"} className="mt-6 grid gap-3 rounded-2xl border border-white/15 bg-void-card p-5 sm:grid-cols-2 lg:grid-cols-4">
          <Campo label="Nombre de la campaña" requerido error={errs.nombre}>{(p) => <input {...p} className={inputOwner} value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />}</Campo>
          <Campo label="Canal">{(p) => <select {...p} className={inputOwner} value={f.canal} onChange={(e) => setF({ ...f, canal: e.target.value })}>{CANALES.map((c) => <option key={c}>{c}</option>)}</select>}</Campo>
          <Campo label="Fuente" requerido error={errs.fuente} ayuda="Una palabra o frase corta, ej. instagram-oct.">{(p) => <input {...p} className={inputOwner} value={f.fuente} onChange={(e) => setF({ ...f, fuente: e.target.value })} />}</Campo>
          <Campo label="Presupuesto (Q)" error={errs.presupuesto}>{(p) => <input {...p} type="number" min={0} inputMode="decimal" className={inputOwner} value={f.presupuesto} onChange={(e) => setF({ ...f, presupuesto: e.target.value })} />}</Campo>
          <Campo label="Inicio">{(p) => <input {...p} type="date" className={inputOwner} value={f.inicio} onChange={(e) => setF({ ...f, inicio: e.target.value })} />}</Campo>
          <Campo label="Fin" error={errs.fin}>{(p) => <input {...p} type="date" className={inputOwner} value={f.fin} onChange={(e) => setF({ ...f, fin: e.target.value })} />}</Campo>
          <Campo label="Estado">{(p) => <select {...p} className={inputOwner} value={f.estado} onChange={(e) => setF({ ...f, estado: e.target.value })}><option>planificada</option><option>activa</option><option>terminada</option></select>}</Campo>
          <Campo label="Notas">{(p) => <input {...p} className={inputOwner} value={f.notas} onChange={(e) => setF({ ...f, notas: e.target.value })} />}</Campo>
          {enlace && (
            <div className="sm:col-span-2 lg:col-span-4">
              <p className="text-xs font-medium text-white/80">Enlace rastreable de esta campaña</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <code className="min-w-0 flex-1 break-all rounded-lg bg-void px-3 py-2 text-xs text-lime">{enlace}</code>
                <button type="button" className="rounded-full border border-white/25 px-3 py-1.5 text-xs text-white" onClick={async () => { try { await navigator.clipboard.writeText(enlace); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { setMsg({ ok: false, texto: "No se pudo copiar; selecciónalo y cópialo a mano." }); } }}>{copiado ? "¡Copiado!" : "Copiar"}</button>
              </div>
            </div>
          )}
          <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
            <button type="submit" disabled={isPending} className="rounded-full bg-lime px-5 py-2 text-sm font-semibold text-void disabled:opacity-50">{isPending ? "Guardando…" : "Guardar campaña"}</button>
            <button type="button" disabled={isPending} className="rounded-full border border-white/25 px-5 py-2 text-sm text-white/80" onClick={() => { setAbierto(false); setErrs({}); }}>Cancelar</button>
          </div>
        </form>
      )}

      <section className="mt-6 overflow-x-auto rounded-2xl border border-white/10 bg-void-card p-5">
        <h2 className="text-base font-semibold">Campañas <span className="text-sm font-normal text-white/65">· {totalProspectos} prospectos, {totalGanados} ganados</span></h2>
        <table className="mt-3 w-full text-sm">
          <thead className="text-left text-xs text-white/70"><tr><th className="py-2">Campaña</th><th>Fuente</th><th className="text-right">Presup.</th><th className="text-right">Prospectos</th><th className="text-right">Demos</th><th className="text-right">Propuestas</th><th className="text-right">Ganados</th><th className="text-right">Valor/mes</th><th className="text-right">Q/prospecto</th><th><span className="sr-only">Acciones</span></th></tr></thead>
          <tbody className="divide-y divide-white/10">
            {campanas.length === 0 && <tr><td colSpan={10} className="py-4"><EstadoVacio titulo="Aún no hay campañas" texto="Crea la primera para medir qué fuente trae más prospectos." /></td></tr>}
            {campanas.map((c) => (
              <tr key={c.id}>
                <td className="py-2"><span className="font-medium">{c.nombre}</span><span className="block text-xs text-white/65">{c.canal} · {c.estado}{c.inicio ? ` · ${fechaCorta(c.inicio)}` : ""}{c.fin ? `–${fechaCorta(c.fin)}` : ""}</span></td>
                <td className="text-white/70">{c.fuente}</td><td className="text-right">{q(c.presupuesto)}</td>
                <td className="text-right">{c.prospectos}</td><td className="text-right">{c.demos}</td><td className="text-right">{c.propuestas}</td><td className="text-right text-lime">{c.ganados}</td>
                <td className="text-right">{q(c.valor_ganado)}</td><td className="text-right text-white/70">{c.costo_por_prospecto === null ? "—" : q(c.costo_por_prospecto)}</td>
                <td className="text-right"><button type="button" aria-label={`Editar ${c.nombre}`} className="text-xs text-white/70 underline-offset-2 hover:text-white hover:underline" onClick={() => { setF({ id: c.id, nombre: c.nombre, canal: c.canal, fuente: c.fuente, presupuesto: String(c.presupuesto), inicio: c.inicio ?? "", fin: c.fin ?? "", estado: c.estado, notas: c.notas ?? "" }); setAbierto(true); }}>Editar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-6 rounded-2xl border border-white/10 bg-void-card p-5">
        <h2 className="text-base font-semibold">Lista de exclusión</h2>
        <p className="mt-1 text-xs text-white/65">Correos que pidieron no ser contactados. Cuando se conecte el envío de email, esta lista se respeta siempre.</p>
        <form ref={exRef} onSubmit={excluir} noValidate className="mt-3 flex flex-wrap items-start gap-3">
          <Campo label="Correo" requerido error={errs.exEmail} className="min-w-[14rem] flex-1">{(p) => <input {...p} type="email" className={inputOwner} value={ex.email} onChange={(e) => setEx({ ...ex, email: e.target.value })} />}</Campo>
          <Campo label="Motivo" className="min-w-[14rem] flex-1">{(p) => <input {...p} className={inputOwner} value={ex.motivo} onChange={(e) => setEx({ ...ex, motivo: e.target.value })} />}</Campo>
          <button type="submit" disabled={isPending} className="mt-5 rounded-full border border-white/25 px-4 py-2 text-sm disabled:opacity-50">{isPending ? "Guardando…" : "Excluir correo"}</button>
        </form>
        {exclusiones.length === 0 ? <p className="mt-3 text-sm text-white/65">Nadie ha pedido ser excluido.</p> : <ul className="mt-3 text-sm text-white/80">{exclusiones.map((x) => <li key={x.email}>{x.email}<span className="text-white/70">{x.motivo ? ` · ${x.motivo}` : ""}</span></li>)}</ul>}
      </section>
    </main>
  );
}
