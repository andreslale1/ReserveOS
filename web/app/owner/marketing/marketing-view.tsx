"use client";

import { useState, useTransition } from "react";
import { excluirCorreo, guardarCampana } from "./actions";

export type Campana = {
  id: string; nombre: string; canal: string; fuente: string; presupuesto: number; inicio: string | null; fin: string | null; estado: string; notas: string | null;
  prospectos: number; demos: number; propuestas: number; ganados: number; valor_ganado: number; costo_por_prospecto: number | null;
};
export type Exclusion = { email: string; motivo: string | null };

const CANALES = ["email", "redes", "evento", "referido", "web", "alianza", "otro"];
const vacio = { id: null as string | null, nombre: "", canal: "redes", fuente: "", presupuesto: "", inicio: "", fin: "", estado: "planificada", notas: "" };
const input = "rounded-lg border border-white/15 bg-void px-2 py-1.5 text-sm text-white outline-none focus:border-lime/60";
const q = (n: number) => `Q${Number(n).toLocaleString("es-GT")}`;

export default function MarketingView({ campanas, exclusiones }: { campanas: Campana[]; exclusiones: Exclusion[] }) {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [f, setF] = useState(vacio);
  const [abierto, setAbierto] = useState(false);
  const [ex, setEx] = useState({ email: "", motivo: "" });
  const sitio = "https://reserveos.app";

  function correr(fn: () => Promise<{ error: string | null }>, despues?: () => void) {
    setMsg(null);
    startTransition(async () => { const r = await fn(); if (r.error) setMsg(r.error); else despues?.(); });
  }
  const totalProspectos = campanas.reduce((a, c) => a + Number(c.prospectos), 0);
  const totalGanados = campanas.reduce((a, c) => a + Number(c.ganados), 0);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8 md:px-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Marketing de ReserveOS</h1>
          <p className="mt-1 text-sm text-white/50">Campañas para captar gimnasios y estudios. La atribución usa la <strong>fuente</strong> registrada en cada oportunidad; no se afirma causalidad por una visita.</p>
        </div>
        <button className="rounded-full bg-lime px-4 py-2 text-sm font-semibold text-void" onClick={() => { setF(vacio); setAbierto(!abierto); }}>+ Nueva campaña</button>
      </div>
      {msg && <p className="mt-4 rounded-xl bg-white/10 px-4 py-3 text-sm">{msg}</p>}

      <section className="mt-6 rounded-2xl border border-lime/30 bg-void-card p-5 text-sm">
        <h2 className="text-base font-semibold">Formulario de captación</h2>
        <p className="mt-1 text-white/60">Cada consulta crea o vincula la empresa y el contacto, abre la oportunidad con su fuente y genera una tarea para responder hoy. Usa un enlace distinto por campaña:</p>
        <code className="mt-2 block break-all rounded-lg bg-void px-3 py-2 text-xs text-lime">{sitio}/contacto?fuente=<em>la-fuente-de-tu-campaña</em></code>
      </section>

      {abierto && (
        <section className="mt-6 grid gap-3 rounded-2xl border border-white/10 bg-void-card p-5 sm:grid-cols-4">
          <input className={input} placeholder="Nombre de la campaña" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
          <select className={input} value={f.canal} onChange={(e) => setF({ ...f, canal: e.target.value })}>{CANALES.map((c) => <option key={c}>{c}</option>)}</select>
          <input className={input} placeholder="Fuente (ej. instagram-oct)" value={f.fuente} onChange={(e) => setF({ ...f, fuente: e.target.value })} />
          <input className={input} type="number" placeholder="Presupuesto Q" value={f.presupuesto} onChange={(e) => setF({ ...f, presupuesto: e.target.value })} />
          <input className={input} type="date" value={f.inicio} onChange={(e) => setF({ ...f, inicio: e.target.value })} />
          <input className={input} type="date" value={f.fin} onChange={(e) => setF({ ...f, fin: e.target.value })} />
          <select className={input} value={f.estado} onChange={(e) => setF({ ...f, estado: e.target.value })}><option>planificada</option><option>activa</option><option>terminada</option></select>
          <input className={input} placeholder="Notas" value={f.notas} onChange={(e) => setF({ ...f, notas: e.target.value })} />
          <button className="w-fit rounded-full bg-lime px-4 py-1.5 text-sm font-semibold text-void disabled:opacity-50" disabled={isPending || f.nombre.trim().length < 2 || f.fuente.trim().length < 2}
            onClick={() => correr(() => guardarCampana({ ...f, presupuesto: Number(f.presupuesto || 0) }), () => { setAbierto(false); setF(vacio); })}>Guardar</button>
        </section>
      )}

      <section className="mt-6 overflow-x-auto rounded-2xl border border-white/10 bg-void-card p-5">
        <h2 className="text-base font-semibold">Campañas <span className="text-sm font-normal text-white/45">· {totalProspectos} prospectos, {totalGanados} ganados</span></h2>
        <table className="mt-3 w-full text-sm">
          <thead className="text-left text-xs text-white/45"><tr><th className="py-2">Campaña</th><th>Fuente</th><th className="text-right">Presup.</th><th className="text-right">Prospectos</th><th className="text-right">Demos</th><th className="text-right">Propuestas</th><th className="text-right">Ganados</th><th className="text-right">Valor/mes</th><th className="text-right">Q/prospecto</th><th></th></tr></thead>
          <tbody className="divide-y divide-white/10">
            {campanas.length === 0 && <tr><td colSpan={10} className="py-4 text-white/50">Aún no hay campañas.</td></tr>}
            {campanas.map((c) => (
              <tr key={c.id}>
                <td className="py-2"><span className="font-medium">{c.nombre}</span><span className="block text-xs text-white/45">{c.canal} · {c.estado}</span></td>
                <td className="text-white/60">{c.fuente}</td><td className="text-right">{q(c.presupuesto)}</td>
                <td className="text-right">{c.prospectos}</td><td className="text-right">{c.demos}</td><td className="text-right">{c.propuestas}</td><td className="text-right text-lime">{c.ganados}</td>
                <td className="text-right">{q(c.valor_ganado)}</td><td className="text-right text-white/60">{c.costo_por_prospecto === null ? "—" : q(c.costo_por_prospecto)}</td>
                <td className="text-right"><button className="text-xs text-white/45 hover:text-white" onClick={() => { setF({ id: c.id, nombre: c.nombre, canal: c.canal, fuente: c.fuente, presupuesto: String(c.presupuesto), inicio: c.inicio ?? "", fin: c.fin ?? "", estado: c.estado, notas: c.notas ?? "" }); setAbierto(true); }}>Editar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-6 rounded-2xl border border-white/10 bg-void-card p-5">
        <h2 className="text-base font-semibold">Lista de exclusión</h2>
        <p className="mt-1 text-xs text-white/45">Correos que pidieron no ser contactados. Cuando se conecte el envío de email, esta lista se respeta siempre.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input className={`${input} flex-1`} placeholder="Correo" value={ex.email} onChange={(e) => setEx({ ...ex, email: e.target.value })} />
          <input className={`${input} flex-1`} placeholder="Motivo" value={ex.motivo} onChange={(e) => setEx({ ...ex, motivo: e.target.value })} />
          <button className="rounded-full border border-white/15 px-4 py-1.5 text-sm disabled:opacity-50" disabled={isPending || !ex.email.includes("@")} onClick={() => correr(() => excluirCorreo(ex.email, ex.motivo), () => setEx({ email: "", motivo: "" }))}>Excluir</button>
        </div>
        <ul className="mt-3 text-sm text-white/70">{exclusiones.map((x) => <li key={x.email}>{x.email}<span className="text-white/40">{x.motivo ? ` · ${x.motivo}` : ""}</span></li>)}</ul>
      </section>
    </main>
  );
}
