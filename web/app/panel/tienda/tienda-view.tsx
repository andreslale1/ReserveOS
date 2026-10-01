"use client";

import { useState, useTransition } from "react";
import { marcarCarritoPerdido } from "./actions";

type Producto = {
  nombre: string;
  precio: number;
  unidad: string;
  categoria: string | null;
  variantes: { id: string; nombre: string; stock: number }[];
};
type Pedido = {
  id: string;
  estado: string;
  metodoPago: string;
  total: number;
  fecha: string;
  clienteNombre: string;
};
type CarritoAbandonado = {
  carrito_id: string;
  cliente_nombre: string;
  cliente_telefono: string;
  actualizado_at: string;
  items: string;
  total: number;
};

const ESTADO_LABEL: Record<string, { label: string; className: string }> = {
  pendiente_pago: { label: "Pendiente de pago", className: "bg-peach-tint text-ink" },
  pagado: { label: "Pagado", className: "bg-sage-tint text-sage" },
  entregado: { label: "Entregado", className: "bg-sage-tint text-sage" },
  cancelado: { label: "Cancelado", className: "bg-neutral-tint text-ink/50" },
};

function fmt(n: number) {
  return `Q${Number(n).toLocaleString("es-GT", { maximumFractionDigits: 0 })}`;
}

const TABS = ["Catálogo", "Pedidos", "Carritos abandonados"] as const;

export default function TiendaView({
  productos,
  pedidos,
  carritosAbandonados,
  esDuenaOGerente,
}: {
  productos: Producto[];
  pedidos: Pedido[];
  carritosAbandonados: CarritoAbandonado[];
  esDuenaOGerente: boolean;
}) {
  const tabs = esDuenaOGerente ? TABS : TABS.slice(0, 2);
  const [tab, setTab] = useState<(typeof TABS)[number]>(tabs[0]);
  const [isPending, startTransition] = useTransition();

  return (
    <main className="min-h-screen bg-cream">
      <header className="border-b border-white/10 bg-card px-6 py-6 md:px-10">
        <h1 className="text-2xl font-semibold text-ink md:text-3xl">
          Tienda
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Productos adicionales del estudio — ropa, accesorios, botellas.
        </p>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8 md:px-10">
        <div className="mb-6 flex gap-2">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full px-4 py-1.5 text-sm transition-colors duration-200 ${
                tab === t
                  ? "bg-ink text-cream"
                  : "bg-card text-ink-soft hover:text-ink"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "Catálogo" &&
          (productos.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 bg-card p-8 text-center text-sm text-ink-soft">
              No hay productos cargados todavía.
            </div>
          ) : (
            <ul className="space-y-2">
              {productos.map((p, i) => (
                <li
                  key={i}
                  className="rounded-2xl border border-white/10 bg-card p-5"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-ink">
                      {p.nombre}
                      {p.categoria ? (
                        <span className="ml-2 text-xs text-ink-soft">
                          {p.categoria}
                        </span>
                      ) : null}
                    </p>
                    <span className="text-sm font-semibold text-ink">
                      {fmt(p.precio)} / {p.unidad}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {p.variantes.map((v) => (
                      <span
                        key={v.id}
                        className={`rounded-full px-3 py-1 text-xs ${
                          v.stock > 0
                            ? "bg-neutral-tint text-ink-soft"
                            : "bg-red-500/10 text-red-400"
                        }`}
                      >
                        {v.nombre} · {v.stock > 0 ? `${v.stock} en stock` : "sin stock"}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          ))}

        {tab === "Pedidos" &&
          (pedidos.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 bg-card p-8 text-center text-sm text-ink-soft">
              No hay pedidos todavía.
            </div>
          ) : (
            <ul className="space-y-2">
              {pedidos.map((p) => {
                const estado = ESTADO_LABEL[p.estado] ?? ESTADO_LABEL.cancelado;
                return (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-card p-4"
                  >
                    <div>
                      <p className="text-sm font-medium text-ink">
                        {p.clienteNombre}
                      </p>
                      <p className="text-xs text-ink-soft">
                        {new Date(p.fecha).toLocaleDateString("es-GT")} ·{" "}
                        {p.metodoPago}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${estado.className}`}
                      >
                        {estado.label}
                      </span>
                      <span className="text-sm font-semibold text-ink">
                        {fmt(p.total)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          ))}

        {tab === "Carritos abandonados" &&
          (carritosAbandonados.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 bg-card p-8 text-center text-sm text-ink-soft">
              No hay carritos abandonados (más de 2 horas sin actividad).
            </div>
          ) : (
            <ul className="space-y-2">
              {carritosAbandonados.map((c) => (
                <li
                  key={c.carrito_id}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-card p-4"
                >
                  <div>
                    <p className="text-sm font-medium text-ink">
                      {c.cliente_nombre}{" "}
                      <span className="text-xs text-ink-soft">
                        {c.cliente_telefono}
                      </span>
                    </p>
                    <p className="text-xs text-ink-soft">{c.items}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-ink">
                      {fmt(c.total)}
                    </span>
                    <button
                      disabled={isPending}
                      onClick={() =>
                        startTransition(() => {
                          marcarCarritoPerdido(c.carrito_id);
                        })
                      }
                      className="rounded-full border border-white/15 px-3 py-1 text-xs text-ink-soft hover:text-ink"
                    >
                      Marcar perdido
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ))}
      </div>
    </main>
  );
}
