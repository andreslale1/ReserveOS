"use client";

import { useState, useTransition } from "react";
import { agregarVariante, guardarProducto, moverStock } from "./actions";

export type Producto = { id: string; nombre: string; descripcion: string; precio: number; categoria: string; imagen: string; activo: boolean; variantes: { id: string; nombre: string; stock: number }[] };
export type Movimiento = { created_at: string; producto: string; variante: string; delta: number; saldo: number; tipo: string; motivo: string | null; actor: string | null };
const input = "mt-1 w-full rounded-lg border border-white/15 bg-cream px-3 py-2 text-ink outline-none focus:border-ink/30";
const q = (n: number) => `Q${Number(n).toLocaleString("es-GT")}`;
// Entradas y devoluciones suman, salidas restan; un ajuste respeta el signo escrito (ej. -3 baja 3).
function deltaFirmado(tipo: string, n: number) {
  if (tipo === "salida") return -Math.abs(n);
  if (tipo === "entrada" || tipo === "devolucion") return Math.abs(n);
  return n;
}
const vacio = { id: null as string | null, nombre: "", descripcion: "", precio: "", categoria: "", imagen: "", activo: true };

export default function ProductosView({ tenantId, puedeGestionar, productos, movimientos }: { tenantId: string; puedeGestionar: boolean; productos: Producto[]; movimientos: Movimiento[] }) {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [f, setF] = useState(vacio);
  const [abierto, setAbierto] = useState(false);
  const [mov, setMov] = useState<Record<string, { delta: string; tipo: string; motivo: string }>>({});
  const [nv, setNv] = useState<Record<string, string>>({});

  function correr(fn: () => Promise<{ error: string | null }>, ok: string, despues?: () => void) {
    setMsg(null);
    startTransition(async () => { const r = await fn(); if (r.error) setMsg({ ok: false, texto: r.error }); else { setMsg({ ok: true, texto: ok }); despues?.(); } });
  }
  return (
    <main className="min-h-screen bg-cream">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-card px-6 py-6 md:px-10">
        <div>
          <h1 className="font-serif text-2xl text-ink md:text-3xl">Productos e inventario</h1>
          <p className="mt-1 text-sm text-ink/60">Lo que vendes en el estudio y cuánto tienes. Cada cambio de stock queda registrado con su motivo.</p>
        </div>
        {puedeGestionar && <button className="press-spring rounded-full bg-ink px-4 py-2 text-sm font-medium text-cream" onClick={() => { setF(vacio); setAbierto(!abierto); }}>+ Nuevo producto</button>}
      </header>
      <div className="mx-auto grid max-w-4xl gap-6 px-6 py-8 md:px-10">
        {msg && <p className={`rounded-xl px-4 py-3 text-sm ${msg.ok ? "bg-sage-tint text-sage" : "bg-peach-tint text-ink"}`}>{msg.texto}</p>}
        {abierto && (
          <section className="rounded-2xl border border-white/10 bg-card p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm text-ink/60">Nombre<input className={input} value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></label>
              <label className="text-sm text-ink/60">Precio (Q)<input type="number" min={0} className={input} value={f.precio} onChange={(e) => setF({ ...f, precio: e.target.value })} /></label>
              <label className="text-sm text-ink/60">Categoría<input className={input} placeholder="ropa, accesorios…" value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value })} /></label>
              <label className="text-sm text-ink/60">Foto (enlace)<input className={input} value={f.imagen} onChange={(e) => setF({ ...f, imagen: e.target.value })} /></label>
              <label className="text-sm text-ink/60 sm:col-span-2">Descripción<input className={input} value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} /></label>
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm text-ink"><input type="checkbox" checked={f.activo} onChange={(e) => setF({ ...f, activo: e.target.checked })} /> Visible para las clientas</label>
            <button className="press-spring mt-4 rounded-full bg-ink px-4 py-2 text-sm font-medium text-cream disabled:opacity-50" disabled={isPending || f.nombre.trim().length < 2 || f.precio === ""}
              onClick={() => correr(() => guardarProducto({ id: f.id, tenantId, nombre: f.nombre, descripcion: f.descripcion, precio: Number(f.precio), categoria: f.categoria, imagen: f.imagen, activo: f.activo }), "Producto guardado. Agrega stock más abajo.", () => setAbierto(false))}>Guardar producto</button>
          </section>
        )}
        {productos.length === 0 && <p className="text-sm text-ink/55">Aún no tienes productos.</p>}
        {productos.map((p) => (
          <section key={p.id} className={`rounded-2xl border border-white/10 bg-card p-5 ${p.activo ? "" : "opacity-60"}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><h2 className="text-base font-semibold text-ink">{p.nombre} <span className="text-sm font-normal text-ink/55">· {q(p.precio)}{p.categoria ? ` · ${p.categoria}` : ""}{p.activo ? "" : " · oculto"}</span></h2>
                {p.descripcion && <p className="text-sm text-ink/60">{p.descripcion}</p>}</div>
              {puedeGestionar && <button className="text-xs text-ink/55 hover:text-ink" onClick={() => { setF({ id: p.id, nombre: p.nombre, descripcion: p.descripcion, precio: String(p.precio), categoria: p.categoria, imagen: p.imagen, activo: p.activo }); setAbierto(true); }}>Editar</button>}
            </div>
            <ul className="mt-3 divide-y divide-white/10">
              {p.variantes.map((v) => {
                const m = mov[v.id] ?? { delta: "", tipo: "entrada", motivo: "" };
                return (
                  <li key={v.id} className="py-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-ink">{v.nombre} · <strong className={v.stock <= 2 ? "text-ink" : ""}>{v.stock}</strong> en stock{v.stock <= 2 ? " ⚠ poco" : ""}</span>
                      <span className="flex flex-wrap items-center gap-2">
                        <select className={`${input} mt-0 w-28`} value={m.tipo} onChange={(e) => setMov({ ...mov, [v.id]: { ...m, tipo: e.target.value } })}><option value="entrada">Entrada</option><option value="salida">Salida</option><option value="ajuste">Ajuste</option><option value="devolucion">Devolución</option></select>
                        <input type="number" className={`${input} mt-0 w-20`} placeholder="Cant." value={m.delta} onChange={(e) => setMov({ ...mov, [v.id]: { ...m, delta: e.target.value } })} />
                        <input className={`${input} mt-0 w-44`} placeholder="Motivo" value={m.motivo} onChange={(e) => setMov({ ...mov, [v.id]: { ...m, motivo: e.target.value } })} />
                        <button className="rounded-full border border-white/20 px-3 py-1.5 text-xs text-ink disabled:opacity-50" disabled={isPending || !Number(m.delta) || m.motivo.trim().length < 3}
                          onClick={() => correr(() => moverStock(v.id, deltaFirmado(m.tipo, Number(m.delta)), m.tipo, m.motivo), "Stock actualizado.", () => setMov({ ...mov, [v.id]: { delta: "", tipo: m.tipo, motivo: "" } }))}>Registrar</button>
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
            {puedeGestionar && (
              <div className="mt-2 flex gap-2">
                <input className={`${input} mt-0 flex-1`} placeholder="Nueva variante (talla, color…)" value={nv[p.id] ?? ""} onChange={(e) => setNv({ ...nv, [p.id]: e.target.value })} />
                <button className="rounded-full border border-white/20 px-3 py-1.5 text-xs text-ink disabled:opacity-50" disabled={isPending || !(nv[p.id] ?? "").trim()} onClick={() => correr(() => agregarVariante(p.id, nv[p.id]), "Variante agregada.", () => setNv({ ...nv, [p.id]: "" }))}>+ Variante</button>
              </div>
            )}
          </section>
        ))}
        <section className="rounded-2xl border border-white/10 bg-card p-5">
          <h2 className="text-base font-semibold text-ink">Movimientos recientes</h2>
          <ul className="mt-3 divide-y divide-white/10">
            {movimientos.length === 0 && <li className="py-2 text-sm text-ink/50">Sin movimientos.</li>}
            {movimientos.map((m, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span className="text-ink">{new Date(m.created_at).toLocaleDateString("es-GT", { timeZone: "America/Guatemala", day: "numeric", month: "short" })} · {m.producto} {m.variante !== "Única" ? `(${m.variante})` : ""} · <strong>{m.delta > 0 ? `+${m.delta}` : m.delta}</strong> → {m.saldo}</span>
                <span className="text-xs text-ink/55">{m.tipo}{m.motivo ? ` · ${m.motivo}` : ""}{m.actor ? ` · ${m.actor}` : ""}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
