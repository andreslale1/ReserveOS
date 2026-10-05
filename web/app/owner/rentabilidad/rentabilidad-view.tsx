"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { borrarCosto, guardarCosto } from "./actions";

export type Rent = {
  ingresos: number; costos: number; margen: number; margen_pct: number | null; costos_generales: number;
  costos_por_categoria: { categoria: string; monto: number }[];
  por_estudio: { estudio: string; ingresos: number; costos: number; margen: number }[];
};
export type Costo = { id: string; fecha: string; categoria: string; descripcion: string | null; monto: number; estudio: string | null };

const q = (n: number) => `Q${Number(n).toLocaleString("es-GT", { maximumFractionDigits: 2 })}`;
const input = "rounded-lg border border-white/15 bg-void px-2 py-1.5 text-sm text-white outline-none focus:border-lime/60";
const CATS = ["infraestructura", "mensajeria", "dominios", "soporte", "app", "marketing", "otros"];

export default function RentabilidadView({ mes, rent, costos, estudios }: { mes: string; rent: Rent; costos: Costo[]; estudios: { id: string; name: string }[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [c, setC] = useState({ fecha: new Date().toISOString().slice(0, 10), categoria: "infraestructura", descripcion: "", monto: "", tenantId: "" });

  function correr(fn: () => Promise<{ error: string | null }>, despues?: () => void) {
    setMsg(null);
    startTransition(async () => { const r = await fn(); if (r.error) setMsg(r.error); else despues?.(); });
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-8 md:px-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Rentabilidad de ReserveOS</h1>
          <p className="mt-1 text-sm text-white/50">Lo realmente cobrado menos tus costos. La caja de cada estudio no cuenta como ingreso tuyo.</p>
        </div>
        <input type="month" className={input} value={mes} onChange={(e) => e.target.value && router.push(`/owner/rentabilidad?mes=${e.target.value}`)} />
      </div>
      {msg && <p className="mt-4 rounded-xl bg-white/10 px-4 py-3 text-sm">{msg}</p>}

      <section className="mt-6 grid gap-4 sm:grid-cols-4">
        {[["Ingresos cobrados", q(rent.ingresos), "text-white"], ["Costos", q(rent.costos), "text-white"], ["Margen", q(rent.margen), rent.margen >= 0 ? "text-lime" : "text-red-300"], ["Margen %", rent.margen_pct === null ? "—" : `${rent.margen_pct}%`, "text-white"]].map(([l, v, cl]) => (
          <div key={l} className="rounded-2xl border border-white/10 bg-void-card p-5">
            <p className="text-xs uppercase tracking-wide text-white/45">{l}</p>
            <p className={`mt-1 text-2xl font-semibold ${cl}`}>{v}</p>
          </div>
        ))}
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-void-card p-5">
          <h2 className="text-base font-semibold">Por estudio</h2>
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-xs text-white/45"><tr><th>Estudio</th><th className="text-right">Ingresos</th><th className="text-right">Costos</th><th className="text-right">Margen</th></tr></thead>
            <tbody className="divide-y divide-white/10">
              {rent.por_estudio.map((e) => (
                <tr key={e.estudio}><td className="py-2">{e.estudio}</td><td className="text-right">{q(e.ingresos)}</td><td className="text-right">{q(e.costos)}</td><td className={`text-right ${e.margen < 0 ? "text-red-300" : ""}`}>{q(e.margen)}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-white/40">Costos generales sin estudio asignado: {q(rent.costos_generales)}</p>
        </section>

        <section className="rounded-2xl border border-white/10 bg-void-card p-5">
          <h2 className="text-base font-semibold">Registrar costo</h2>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <input type="date" className={input} value={c.fecha} onChange={(e) => setC({ ...c, fecha: e.target.value })} />
            <select className={input} value={c.categoria} onChange={(e) => setC({ ...c, categoria: e.target.value })}>{CATS.map((x) => <option key={x}>{x}</option>)}</select>
            <input className={`${input} w-24`} type="number" placeholder="Q" value={c.monto} onChange={(e) => setC({ ...c, monto: e.target.value })} />
            <select className={input} value={c.tenantId} onChange={(e) => setC({ ...c, tenantId: e.target.value })}>
              <option value="">General</option>{estudios.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <input className={`${input} flex-1`} placeholder="Descripción" value={c.descripcion} onChange={(e) => setC({ ...c, descripcion: e.target.value })} />
            <button className="rounded-full bg-lime px-4 py-1.5 text-sm font-semibold text-void disabled:opacity-50" disabled={isPending || !(Number(c.monto) > 0)}
              onClick={() => correr(() => guardarCosto(c.fecha, c.categoria, c.descripcion, Number(c.monto), c.tenantId), () => { setC({ ...c, monto: "", descripcion: "" }); router.refresh(); })}>Guardar</button>
          </div>
          <ul className="mt-4 divide-y divide-white/10">
            {costos.length === 0 && <li className="py-2 text-sm text-white/50">Sin costos este mes.</li>}
            {costos.map((k) => (
              <li key={k.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span>{k.fecha} · {k.categoria}{k.estudio ? ` · ${k.estudio}` : ""}<span className="text-white/50">{k.descripcion ? ` · ${k.descripcion}` : ""}</span></span>
                <span className="flex items-center gap-3">{q(k.monto)}<button className="text-xs text-white/40 hover:text-white" disabled={isPending} onClick={() => correr(() => borrarCosto(k.id), () => router.refresh())}>Quitar</button></span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
