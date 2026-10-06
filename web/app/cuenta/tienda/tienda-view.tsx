"use client";

import { useState, useTransition } from "react";
import { agregarAlCarrito, cambiarCantidad, confirmarPedido, quitarDelCarrito } from "./actions";

export type ProductoCat = { id: string; nombre: string; descripcion: string; precio: number; imagen: string | null; categoria: string | null; variantes: { id: string; nombre: string; stock: number }[] };
export type Item = { item_id: string; tipo: string; cantidad: number; producto_nombre: string | null; variante_nombre: string | null; stock_disponible: number | null; paquete_nombre: string | null; precio_unitario: number };
export type Pedido = { pedido_id: string; estado: string; metodo_pago: string; total: number; created_at: string; items: string };
const q = (n: number) => `Q${Number(n).toLocaleString("es-GT")}`;
const EST: Record<string, string> = { pendiente_pago: "Por pagar en el estudio", pagado: "Pagado · por recoger", entregado: "Entregado", cancelado: "Cancelado" };

export default function TiendaView({ tenantId, productos, carrito, pedidos }: { tenantId: string; productos: ProductoCat[]; carrito: Item[]; pedidos: Pedido[] }) {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [sel, setSel] = useState<Record<string, string>>({});
  const [codigo, setCodigo] = useState("");
  const total = carrito.reduce((a, i) => a + Number(i.precio_unitario) * i.cantidad, 0);

  function correr(fn: () => Promise<{ error: string | null }>, ok: string) {
    setMsg(null);
    startTransition(async () => { const r = await fn(); setMsg(r.error ? { ok: false, texto: r.error } : { ok: true, texto: ok }); });
  }
  return (
    <div className="grid gap-5">
      <h1 className="font-serif text-2xl text-ink">Tienda</h1>
      {msg && <p className={`rounded-xl px-4 py-3 text-sm ${msg.ok ? "bg-sage-tint text-sage" : "bg-peach-tint text-ink"}`}>{msg.texto}</p>}

      {carrito.length > 0 && (
        <section className="rounded-2xl border border-black/10 bg-white p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink/50">Mi carrito</h2>
          <ul className="mt-2 divide-y divide-black/5">
            {carrito.map((i) => (
              <li key={i.item_id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="text-ink">{i.producto_nombre ?? i.paquete_nombre}{i.variante_nombre && i.variante_nombre !== "Única" ? ` · ${i.variante_nombre}` : ""}<span className="block text-xs text-ink/50">{q(i.precio_unitario)} c/u</span></span>
                <span className="flex items-center gap-2">
                  <button className="h-7 w-7 rounded-full border border-black/15" disabled={isPending} onClick={() => correr(() => i.cantidad <= 1 ? quitarDelCarrito(i.item_id) : cambiarCantidad(i.item_id, i.cantidad - 1), "Carrito actualizado.")}>−</button>
                  <span className="w-5 text-center">{i.cantidad}</span>
                  <button className="h-7 w-7 rounded-full border border-black/15" disabled={isPending || (i.stock_disponible !== null && i.cantidad >= i.stock_disponible)} onClick={() => correr(() => cambiarCantidad(i.item_id, i.cantidad + 1), "Carrito actualizado.")}>+</button>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center justify-between border-t border-black/10 pt-3 text-sm"><span className="text-ink/60">Total</span><strong className="text-lg text-ink">{q(total)}</strong></div>
          <input className="mt-3 w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm" placeholder="Código de descuento (opcional)" value={codigo} onChange={(e) => setCodigo(e.target.value)} />
          <button className="mt-3 w-full rounded-full bg-ink px-4 py-3 text-sm font-medium text-cream disabled:opacity-50" disabled={isPending} onClick={() => correr(() => confirmarPedido(tenantId, codigo), "¡Pedido hecho! Págalo y recógelo en el estudio.")}>Hacer pedido (pago en el estudio)</button>
        </section>
      )}

      <section className="grid gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink/50">Productos</h2>
        {productos.length === 0 && <p className="text-sm text-ink/60">El estudio todavía no publica productos.</p>}
        {productos.map((p) => {
          const v = p.variantes.find((x) => x.id === (sel[p.id] ?? p.variantes[0]?.id));
          return (
            <div key={p.id} className="flex gap-4 rounded-2xl border border-black/10 bg-white p-4">
              {p.imagen && /^https?:\/\//.test(p.imagen) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.imagen} alt={p.nombre} className="h-20 w-20 shrink-0 rounded-xl object-cover" />
              )}
              <div className="flex-1">
                <p className="font-semibold text-ink">{p.nombre} <span className="font-normal text-ink/60">· {q(p.precio)}</span></p>
                {p.descripcion && <p className="text-sm text-ink/65">{p.descripcion}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {p.variantes.length > 1 && (
                    <select className="rounded-lg border border-black/15 bg-white px-2 py-1.5 text-sm" value={v?.id} onChange={(e) => setSel({ ...sel, [p.id]: e.target.value })}>
                      {p.variantes.map((x) => <option key={x.id} value={x.id}>{x.nombre}{x.stock <= 0 ? " (agotado)" : ""}</option>)}
                    </select>
                  )}
                  <button className="rounded-full bg-ink px-4 py-1.5 text-sm font-medium text-cream disabled:opacity-40" disabled={isPending || !v || v.stock <= 0} onClick={() => v && correr(() => agregarAlCarrito(tenantId, p.id, v.id, 1), "Agregado al carrito.")}>{v && v.stock <= 0 ? "Agotado" : "Agregar"}</button>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {pedidos.length > 0 && (
        <section className="rounded-2xl border border-black/10 bg-white p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink/50">Mis pedidos</h2>
          <ul className="mt-2 divide-y divide-black/5">
            {pedidos.map((o) => (
              <li key={o.pedido_id} className="py-2.5 text-sm"><div className="flex justify-between"><span className="text-ink">{o.items}</span><span className="text-ink">{q(o.total)}</span></div><p className="text-xs text-ink/50">{EST[o.estado] ?? o.estado} · {new Date(o.created_at).toLocaleDateString("es-GT", { day: "numeric", month: "short" })}</p></li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
