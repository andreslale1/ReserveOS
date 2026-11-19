"use client";

import { useState, useTransition } from "react";
import { crearCarriles, fijarModo } from "./actions";

export type ClaseCarril = { id: string; nombre: string; dia: number; inicio: string; cupo: number; modo: "cupo" | "carril" };
const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export default function CarrilesView({ sedeId, carriles, clases, puedeEditar }: { sedeId: string; carriles: { id: string; nombre: string; activo: boolean }[]; clases: ClaseCarril[]; puedeEditar: boolean }) {
  const [pend, ir] = useTransition();
  const [cantidad, setCantidad] = useState(8);
  const [tipo, setTipo] = useState("carril");
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const run = (f: () => Promise<{ error: string | null }>, ok: string) => ir(async () => { const r = await f(); setMsg(r.error ? { ok: false, t: r.error } : { ok: true, t: ok }); });

  return (
    <div className="grid gap-8">
      {msg && <p role={msg.ok ? "status" : "alert"} className={`px-4 py-3 text-sm ${msg.ok ? "bg-good-wash text-good" : "bg-bad-wash text-bad"}`}>{msg.t}</p>}

      <section aria-labelledby="car-t" className="border border-line bg-void-card p-5">
        <h2 id="car-t" className="text-base font-semibold text-ink">Carriles de esta sede</h2>
        <p className="mt-1 text-sm text-ink-soft">Cada carril o estación es un lugar numerado que tus clientes eligen al reservar.</p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {carriles.length === 0 && <span className="text-sm text-ink-soft">Aún no hay carriles. Crea los primeros abajo.</span>}
          {carriles.map((c) => <span key={c.id} className={`border px-2.5 py-1 text-sm ${c.activo ? "border-line text-ink" : "border-line text-ink/35 line-through"}`}>{c.nombre}</span>)}
        </div>
        {puedeEditar && (
          <form className="mt-5 flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); run(() => crearCarriles(sedeId, cantidad, tipo), `Se agregaron ${cantidad}.`); }}>
            <label className="text-sm text-ink-soft">Cuántos<input type="number" min={1} max={60} value={cantidad} onChange={(e) => setCantidad(Number(e.target.value))} className="mt-1 block w-24 border border-line bg-void px-3 py-2 text-ink" /></label>
            <label className="text-sm text-ink-soft">Tipo
              <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="mt-1 block border border-line bg-void px-3 py-2 text-ink">
                <option value="carril">Carriles</option><option value="estacion">Estaciones</option><option value="lugar">Lugares</option>
              </select>
            </label>
            <button disabled={pend} className="press-spring bg-lime px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Agregar</button>
          </form>
        )}
      </section>

      <section aria-labelledby="cl-t">
        <h2 id="cl-t" className="text-base font-semibold text-ink">Clases de esta sede</h2>
        <p className="mt-1 text-sm text-ink-soft">Elige cuáles se reservan por carril (por ejemplo, los bloques HYROX). El resto sigue por cupo.</p>
        <ul className="mt-4 divide-y divide-line border border-line bg-void-card">
          {clases.length === 0 && <li className="px-5 py-4 text-sm text-ink-soft">No hay clases en esta sede.</li>}
          {clases.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
              <span><b className="text-ink">{c.nombre}</b> <span className="text-ink-soft">· {DIAS[c.dia]} {c.inicio.slice(0, 5)} · cupo {c.cupo}</span></span>
              <span className="flex items-center gap-3">
                <span className={`px-2 py-0.5 text-xs ${c.modo === "carril" ? "bg-peach-tint text-lime" : "bg-neutral-tint text-ink-soft"}`}>{c.modo === "carril" ? "Por carril" : "Por cupo"}</span>
                {puedeEditar && (
                  <button disabled={pend} onClick={() => run(() => fijarModo(c.id, c.modo === "carril" ? "cupo" : "carril"), "Cambio guardado.")} className="press-spring border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:border-ink/40 disabled:opacity-50">
                    {c.modo === "carril" ? "Volver a cupo" : "Reservar por carril"}
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
