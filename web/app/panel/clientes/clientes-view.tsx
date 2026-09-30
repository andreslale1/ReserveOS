"use client";

import { useState, useTransition } from "react";
import { obtenerDetalleCliente } from "./actions";

type Fila = {
  id: string;
  nombre: string;
  telefono: string;
  email: string | null;
  estadoMembresia: string;
  clasesRestantes: number | null;
  vencimiento: string | null;
};

type Detalle = Awaited<ReturnType<typeof obtenerDetalleCliente>>;

const ESTADO_LABEL: Record<string, { label: string; className: string }> = {
  activa: { label: "Activa", className: "bg-sage-tint text-sage" },
  vencida: { label: "Vencida", className: "bg-neutral-tint text-ink/60" },
  pendiente_pago: {
    label: "Pago pendiente",
    className: "bg-peach-tint text-ink",
  },
  anulada: { label: "Anulada", className: "bg-neutral-tint text-ink/60" },
  sin_paquete: { label: "Sin paquete", className: "bg-neutral-tint text-ink/50" },
};

export default function ClientesView({ clientes }: { clientes: Fila[] }) {
  const [abierto, setAbierto] = useState<Fila | null>(null);
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [isPending, startTransition] = useTransition();

  function abrir(fila: Fila) {
    setAbierto(fila);
    setDetalle(null);
    startTransition(async () => {
      const d = await obtenerDetalleCliente(fila.id);
      setDetalle(d);
    });
  }

  return (
    <main className="min-h-screen bg-cream">
      <header className="border-b border-black/[0.06] bg-card px-6 py-6 md:px-10">
        <h1 className="font-serif text-2xl text-ink md:text-3xl">Clientas</h1>
        <p className="mt-1 text-sm text-ink/60">
          {clientes.length} clientas registradas
        </p>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8 md:px-10">
        <ul className="space-y-2">
          {clientes.map((c) => {
            const estado = ESTADO_LABEL[c.estadoMembresia] ?? ESTADO_LABEL.sin_paquete;
            return (
              <li key={c.id}>
                <button
                  onClick={() => abrir(c)}
                  className="flex w-full items-center justify-between gap-4 rounded-2xl border border-black/[0.06] bg-card p-4 text-left shadow-[0_2px_8px_-4px_rgba(17,17,17,0.08)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:shadow-[0_16px_28px_-12px_rgba(17,17,17,0.18)]"
                >
                  <div>
                    <p className="text-sm font-medium text-ink">{c.nombre}</p>
                    <p className="text-xs text-ink/50">{c.telefono}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {c.clasesRestantes !== null && (
                      <span className="text-xs text-ink/50">
                        {c.clasesRestantes} clases restantes
                      </span>
                    )}
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${estado.className}`}
                    >
                      {estado.label}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Drawer contextual — no navega, preserva el lugar exacto de la lista */}
      {abierto && (
        <>
          <div
            className="fixed inset-0 z-40 bg-ink/20 backdrop-blur-[2px] transition-opacity duration-300"
            onClick={() => setAbierto(null)}
          />
          <aside className="drawer-in fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-y-auto border-l border-black/[0.06] bg-card p-6 shadow-[0_0_60px_rgba(17,17,17,0.2)]">
            <button
              onClick={() => setAbierto(null)}
              className="text-sm text-ink/50 hover:text-ink"
            >
              ← Cerrar
            </button>

            <h2 className="mt-4 font-serif text-xl text-ink">
              {abierto.nombre}
            </h2>
            <p className="text-sm text-ink/55">
              {abierto.telefono}
              {abierto.email ? ` · ${abierto.email}` : ""}
            </p>

            {isPending || !detalle ? (
              <p className="mt-8 text-sm text-ink/40">Cargando…</p>
            ) : (
              <div className="mt-6 space-y-6">
                <div>
                  <h3 className="text-xs font-medium uppercase tracking-wide text-ink/45">
                    Membresías
                  </h3>
                  <ul className="mt-2 space-y-2">
                    {detalle.membresias.length === 0 && (
                      <p className="text-sm text-ink/50">
                        Sin membresías registradas.
                      </p>
                    )}
                    {detalle.membresias.map((m) => {
                      const estado = ESTADO_LABEL[m.estado] ?? ESTADO_LABEL.sin_paquete;
                      return (
                        <li
                          key={m.id}
                          className="rounded-xl border border-black/[0.06] bg-cream p-3 text-sm"
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${estado.className}`}
                            >
                              {estado.label}
                            </span>
                            <span className="text-xs text-ink/45">
                              Q{m.precio_final}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-ink/55">
                            {m.clases_usadas}/{m.clases_totales} clases usadas
                            {m.fecha_vencimiento
                              ? ` · vence ${m.fecha_vencimiento}`
                              : ""}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <div>
                  <h3 className="text-xs font-medium uppercase tracking-wide text-ink/45">
                    Últimas reservas
                  </h3>
                  <ul className="mt-2 space-y-2">
                    {detalle.reservas.length === 0 && (
                      <p className="text-sm text-ink/50">Sin reservas aún.</p>
                    )}
                    {detalle.reservas.map((r, i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between rounded-xl border border-black/[0.06] bg-cream p-3 text-sm"
                      >
                        <span className="text-ink/80">
                          {
                            (r.horarios as unknown as { nombre_clase: string } | null)
                              ?.nombre_clase
                          }
                        </span>
                        <span className="text-xs text-ink/45">
                          {r.fecha} ·{" "}
                          {r.asistio === true
                            ? "asistió"
                            : r.asistio === false
                              ? "no asistió"
                              : r.estado}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </aside>
        </>
      )}
    </main>
  );
}
