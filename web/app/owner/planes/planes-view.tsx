"use client";

import { useState, useTransition } from "react";
import { guardarPlan } from "./actions";

export type Plan = {
  key: string; nombre: string; descripcion: string | null; precio_mensual: number;
  max_sedes: number | null; max_staff: number | null; modulos: string[]; activo: boolean;
};
export type ModuloCat = { key: string; name: string; description: string; depends_on: string[] };

const input = "mt-1 w-full rounded-lg border border-white/15 bg-void px-3 py-2 text-white outline-none focus:border-lime/60";
const vacio = { key: "", nombre: "", descripcion: "", precio: "", maxSedes: "", maxStaff: "", modulos: [] as string[], activo: true };

export default function PlanesView({ planes, modulos }: { planes: Plan[]; modulos: ModuloCat[] }) {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [f, setF] = useState(vacio);
  const [editando, setEditando] = useState(false);

  function editar(p: Plan) {
    setF({ key: p.key, nombre: p.nombre, descripcion: p.descripcion ?? "", precio: String(p.precio_mensual), maxSedes: p.max_sedes === null ? "" : String(p.max_sedes), maxStaff: p.max_staff === null ? "" : String(p.max_staff), modulos: p.modulos, activo: p.activo });
    setEditando(true);
  }
  function toggle(k: string) {
    const quitar = f.modulos.includes(k);
    let nuevos = quitar ? f.modulos.filter((x) => x !== k) : [...f.modulos, k];
    if (!quitar) {
      // agrega automáticamente los requisitos
      const req = modulos.find((m) => m.key === k)?.depends_on ?? [];
      nuevos = Array.from(new Set([...nuevos, ...req]));
    } else {
      // quita los que dependían de este
      nuevos = nuevos.filter((x) => !(modulos.find((m) => m.key === x)?.depends_on ?? []).includes(k));
    }
    setF({ ...f, modulos: nuevos });
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-8 md:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Planes</h1>
          <p className="mt-1 text-sm text-white/50">Qué incluye cada plan, su precio y sus límites. Los precios están en Q0 hasta que los definas.</p>
        </div>
        <button className="rounded-full bg-lime px-4 py-2 text-sm font-semibold text-void" onClick={() => { setF(vacio); setEditando(true); }}>+ Nuevo plan</button>
      </div>
      {msg && <p className="mt-4 rounded-xl bg-white/10 px-4 py-3 text-sm">{msg}</p>}

      {editando && (
        <section className="mt-6 rounded-2xl border border-white/10 bg-void-card p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm text-white/60">Clave (sin espacios)<input className={input} value={f.key} onChange={(e) => setF({ ...f, key: e.target.value })} /></label>
            <label className="text-sm text-white/60">Nombre<input className={input} value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></label>
            <label className="text-sm text-white/60">Precio mensual (Q)<input type="number" className={input} value={f.precio} onChange={(e) => setF({ ...f, precio: e.target.value })} /></label>
            <label className="text-sm text-white/60">Máx. sedes (vacío = sin límite)<input type="number" className={input} value={f.maxSedes} onChange={(e) => setF({ ...f, maxSedes: e.target.value })} /></label>
            <label className="text-sm text-white/60">Máx. personal (vacío = sin límite)<input type="number" className={input} value={f.maxStaff} onChange={(e) => setF({ ...f, maxStaff: e.target.value })} /></label>
            <label className="text-sm text-white/60">Descripción<input className={input} value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} /></label>
          </div>
          <p className="mt-4 text-xs uppercase tracking-wide text-white/45">Módulos incluidos</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {modulos.map((m) => (
              <label key={m.key} className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={f.modulos.includes(m.key)} onChange={() => toggle(m.key)} className="mt-1" />
                <span>
                  {m.name}
                  {m.depends_on.length > 0 && <span className="text-xs text-white/35"> · requiere {m.depends_on.length}</span>}
                </span>
              </label>
            ))}
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm text-white/70">
            <input type="checkbox" checked={f.activo} onChange={(e) => setF({ ...f, activo: e.target.checked })} /> Plan disponible para vender
          </label>
          <div className="mt-4 flex gap-3">
            <button
              className="rounded-full bg-lime px-4 py-2 text-sm font-semibold text-void disabled:opacity-50"
              disabled={isPending || !f.key.trim() || !f.nombre.trim()}
              onClick={() => {
                setMsg(null);
                startTransition(async () => {
                  const r = await guardarPlan({ key: f.key.trim(), nombre: f.nombre, descripcion: f.descripcion, precio: Number(f.precio || 0), maxSedes: f.maxSedes ? Number(f.maxSedes) : null, maxStaff: f.maxStaff ? Number(f.maxStaff) : null, modulos: f.modulos, activo: f.activo });
                  if (r.error) setMsg(r.error);
                  else { setMsg("Plan guardado."); setEditando(false); }
                });
              }}
            >
              Guardar plan
            </button>
            <button className="text-sm text-white/50" onClick={() => setEditando(false)}>Cancelar</button>
          </div>
        </section>
      )}

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {planes.map((p) => (
          <section key={p.key} className={`rounded-2xl border p-5 ${p.activo ? "border-white/10 bg-void-card" : "border-white/5 bg-void opacity-60"}`}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">{p.nombre}</h2>
                <p className="text-xs text-white/45">{p.key}{p.activo ? "" : " · inactivo"}</p>
              </div>
              <button className="text-xs text-white/50 hover:text-white" onClick={() => editar(p)}>Editar</button>
            </div>
            <p className="mt-3 text-2xl font-semibold text-lime">Q{Number(p.precio_mensual).toLocaleString("es-GT")}<span className="text-sm font-normal text-white/40">/mes</span></p>
            <p className="mt-1 text-xs text-white/50">{p.max_sedes ?? "Sin límite de"} sede(s) · {p.max_staff ?? "sin límite de"} personal</p>
            {p.descripcion && <p className="mt-2 text-sm text-white/65">{p.descripcion}</p>}
            <p className="mt-3 text-xs text-white/45">{p.modulos.length} módulos</p>
          </section>
        ))}
      </div>
    </main>
  );
}
