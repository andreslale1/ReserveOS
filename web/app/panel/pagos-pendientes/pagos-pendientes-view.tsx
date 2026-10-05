"use client";

import { useState, useTransition } from "react";
import { confirmarPago, rechazarPago } from "./actions";

type Pendiente = {
  id: string;
  metodoPago: string;
  referenciaPago: string | null;
  comprobanteUrl: string | null;
  fecha: string;
  clienteNombre: string;
  clienteTelefono: string;
  paqueteNombre: string;
  paquetePrecio: number;
  sedeNombre: string;
};

function fmt(n: number) {
  return `Q${Number(n).toLocaleString("es-GT", { maximumFractionDigits: 0 })}`;
}

export default function PagosPendientesView({
  pendientes,
}: {
  pendientes: Pendiente[];
}) {
  const [isPending, startTransition] = useTransition();
  const [rechazando, setRechazando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [mensaje, setMensaje] = useState<string | null>(null);

  function confirmar(id: string) {
    setMensaje(null);
    startTransition(async () => {
      const res = await confirmarPago(id);
      if (res.error) setMensaje(`Error: ${res.error}`);
    });
  }

  function rechazar(id: string) {
    setMensaje(null);
    startTransition(async () => {
      const res = await rechazarPago(id, motivo);
      if (res.error) setMensaje(`Error: ${res.error}`);
      setRechazando(null);
      setMotivo("");
    });
  }

  return (
    <main className="min-h-screen bg-cream">
      <header className="border-b border-white/10 bg-card px-6 py-6 md:px-10">
        <h1 className="text-2xl font-semibold text-ink md:text-3xl">
          Pagos pendientes
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Transferencias reportadas por clientas, esperando que el estudio
          confirme que el dinero llegó.
        </p>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8 md:px-10">
        {mensaje && (
          <p className="mb-4 text-sm text-red-500">{mensaje}</p>
        )}

        {pendientes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-card p-8 text-center text-sm text-ink-soft">
            No hay pagos pendientes de confirmar.
          </div>
        ) : (
          <ul className="space-y-3">
            {pendientes.map((p) => (
              <li
                key={p.id}
                className="rounded-2xl border border-white/10 bg-card p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-ink">
                      {p.clienteNombre}{" "}
                      <span className="text-xs text-ink-soft">
                        {p.clienteTelefono}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-ink-soft">
                      {p.paqueteNombre} · {fmt(p.paquetePrecio)} · {p.sedeNombre}
                    </p>
                    <p className="mt-1 text-xs text-ink-soft">
                      {p.metodoPago === "transferencia"
                        ? `Referencia: ${p.referenciaPago ?? "—"}`
                        : p.metodoPago}
                      {p.comprobanteUrl && (
                        <>
                          {" · "}
                          <a
                            href={p.comprobanteUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="underline"
                          >
                            Ver comprobante
                          </a>
                        </>
                      )}
                    </p>
                    <p className="mt-1 text-[11px] text-ink-soft">
                      Reportado{" "}
                      {new Date(p.fecha).toLocaleString("es-GT", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <div className="flex gap-2">
                      <button
                        disabled={isPending}
                        onClick={() => confirmar(p.id)}
                        className="press-spring rounded-full bg-sage px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-cream disabled:opacity-50"
                      >
                        Confirmar
                      </button>
                      <button
                        disabled={isPending}
                        onClick={() =>
                          setRechazando(rechazando === p.id ? null : p.id)
                        }
                        className="rounded-full border border-red-400/40 px-4 py-1.5 text-xs text-red-500 hover:bg-red-500/10"
                      >
                        Rechazar
                      </button>
                    </div>
                    {rechazando === p.id && (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={motivo}
                          onChange={(e) => setMotivo(e.target.value)}
                          placeholder="Motivo (opcional)"
                          className="rounded-lg border border-white/15 bg-cream px-2 py-1 text-xs text-ink outline-none"
                        />
                        <button
                          disabled={isPending}
                          onClick={() => rechazar(p.id)}
                          className="rounded-full bg-red-500 px-3 py-1 text-xs font-medium text-white"
                        >
                          Confirmar rechazo
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
