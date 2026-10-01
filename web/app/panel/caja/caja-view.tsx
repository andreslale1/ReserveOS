"use client";

import { useMemo, useState, useTransition } from "react";
import { cerrarCaja } from "./actions";

type Esperado = { metodo_pago: string; monto: number };
type Detalle = {
  origen: string;
  cliente_nombre: string;
  concepto: string;
  monto: number;
  metodo_pago: string;
  hora: string;
};
type Historial = {
  fecha: string;
  efectivo_sistema: number;
  efectivo_contado: number;
  tarjeta_sistema: number;
  tarjeta_contado: number;
  transferencia_sistema: number;
  transferencia_contado: number;
  notas: string | null;
  cerrado_por_nombre: string | null;
  cerrado_at: string;
};
type SedeData = {
  sedeId: string;
  sedeNombre: string;
  fecha: string;
  esperado: Esperado[];
  detalle: Detalle[];
  historial: Historial[];
};

const METODO_LABEL: Record<string, string> = {
  efectivo: "Efectivo",
  tarjeta_estudio: "Tarjeta",
  transferencia: "Transferencia",
};

function fmt(n: number) {
  return `Q${n.toLocaleString("es-GT", { maximumFractionDigits: 0 })}`;
}

function montoDe(esperado: Esperado[], metodo: string) {
  return esperado.find((e) => e.metodo_pago === metodo)?.monto ?? 0;
}

export default function CajaView({
  tenantId,
  sedes,
  puedeCerrar,
}: {
  tenantId: string;
  sedes: SedeData[];
  puedeCerrar: boolean;
}) {
  const [sedeActiva, setSedeActiva] = useState(0);
  const sede = sedes[sedeActiva];

  const [efectivo, setEfectivo] = useState("");
  const [tarjeta, setTarjeta] = useState("");
  const [transferencia, setTransferencia] = useState("");
  const [notas, setNotas] = useState("");
  const [isPending, startTransition] = useTransition();
  const [mensaje, setMensaje] = useState<string | null>(null);

  const totalEsperado = useMemo(
    () => sede?.esperado.reduce((acc, e) => acc + Number(e.monto), 0) ?? 0,
    [sede],
  );

  if (!sede) {
    return (
      <main className="min-h-screen bg-cream">
        <header className="border-b border-white/10 bg-card px-6 py-6 md:px-10">
          <h1 className="text-2xl font-semibold text-ink md:text-3xl">
            Caja
          </h1>
        </header>
        <div className="mx-auto max-w-5xl px-6 py-8 text-sm text-ink-soft md:px-10">
          No tenés sedes asignadas.
        </div>
      </main>
    );
  }

  function confirmarCierre() {
    setMensaje(null);
    startTransition(async () => {
      const res = await cerrarCaja({
        tenantId,
        sedeId: sede.sedeId,
        fecha: sede.fecha,
        efectivoContado: Number(efectivo || 0),
        tarjetaContado: Number(tarjeta || 0),
        transferenciaContado: Number(transferencia || 0),
        notas,
      });
      setMensaje(res.error ? `Error: ${res.error}` : "Caja cerrada.");
    });
  }

  return (
    <main className="min-h-screen bg-cream">
      <header className="border-b border-white/10 bg-card px-6 py-6 md:px-10">
        <h1 className="text-2xl font-semibold text-ink md:text-3xl">Caja</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Cobros en efectivo, tarjeta y transferencia del día — los pagos por
          pasarela en línea no entran aquí.
        </p>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8 md:px-10">
        {sedes.length > 1 && (
          <div className="mb-6 flex gap-2 overflow-x-auto">
            {sedes.map((s, i) => (
              <button
                key={s.sedeId}
                onClick={() => setSedeActiva(i)}
                className={`shrink-0 rounded-full px-4 py-1.5 text-sm transition-colors duration-200 ${
                  i === sedeActiva
                    ? "bg-ink text-cream"
                    : "bg-card text-ink-soft hover:text-ink"
                }`}
              >
                {s.sedeNombre}
              </button>
            ))}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-card p-5">
            <p className="text-xs uppercase tracking-wide text-ink-soft">
              Efectivo
            </p>
            <p className="mt-2 text-2xl font-bold text-ink">
              {fmt(montoDe(sede.esperado, "efectivo"))}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-card p-5">
            <p className="text-xs uppercase tracking-wide text-ink-soft">
              Tarjeta
            </p>
            <p className="mt-2 text-2xl font-bold text-ink">
              {fmt(montoDe(sede.esperado, "tarjeta_estudio"))}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-card p-5">
            <p className="text-xs uppercase tracking-wide text-ink-soft">
              Transferencia
            </p>
            <p className="mt-2 text-2xl font-bold text-ink">
              {fmt(montoDe(sede.esperado, "transferencia"))}
            </p>
          </div>
        </div>

        <p className="mt-3 text-sm text-ink-soft">
          Total esperado hoy: <span className="text-ink">{fmt(totalEsperado)}</span>
        </p>

        <h2 className="mt-10 text-sm font-medium uppercase tracking-wide text-ink-soft">
          Detalle del día
        </h2>
        {sede.detalle.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-white/15 bg-card p-8 text-center text-sm text-ink-soft">
            No hay cobros registrados hoy en esta sede.
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {sede.detalle.map((d, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-card p-4"
              >
                <div>
                  <p className="text-sm font-medium text-ink">
                    {d.cliente_nombre} · {d.concepto}
                  </p>
                  <p className="text-xs text-ink-soft">
                    {d.origen} · {METODO_LABEL[d.metodo_pago] ?? d.metodo_pago}{" "}
                    · {d.hora?.slice(0, 5)}
                  </p>
                </div>
                <span className="text-sm font-semibold text-ink">
                  {fmt(Number(d.monto))}
                </span>
              </li>
            ))}
          </ul>
        )}

        {puedeCerrar && (
          <>
            <h2 className="mt-10 text-sm font-medium uppercase tracking-wide text-ink-soft">
              Cerrar caja de hoy
            </h2>
            <div className="mt-4 grid gap-4 rounded-2xl border border-white/10 bg-card p-5 sm:grid-cols-3">
              <label className="text-sm text-ink-soft">
                Efectivo contado
                <input
                  type="number"
                  value={efectivo}
                  onChange={(e) => setEfectivo(e.target.value)}
                  placeholder={String(montoDe(sede.esperado, "efectivo"))}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-cream px-3 py-2 text-ink outline-none focus:border-lime/50"
                />
              </label>
              <label className="text-sm text-ink-soft">
                Tarjeta contada
                <input
                  type="number"
                  value={tarjeta}
                  onChange={(e) => setTarjeta(e.target.value)}
                  placeholder={String(montoDe(sede.esperado, "tarjeta_estudio"))}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-cream px-3 py-2 text-ink outline-none focus:border-lime/50"
                />
              </label>
              <label className="text-sm text-ink-soft">
                Transferencia contada
                <input
                  type="number"
                  value={transferencia}
                  onChange={(e) => setTransferencia(e.target.value)}
                  placeholder={String(
                    montoDe(sede.esperado, "transferencia"),
                  )}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-cream px-3 py-2 text-ink outline-none focus:border-lime/50"
                />
              </label>
              <label className="text-sm text-ink-soft sm:col-span-3">
                Notas
                <input
                  type="text"
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  placeholder="Opcional"
                  className="mt-1 w-full rounded-lg border border-white/15 bg-cream px-3 py-2 text-ink outline-none focus:border-lime/50"
                />
              </label>
              <div className="sm:col-span-3">
                <button
                  onClick={confirmarCierre}
                  disabled={isPending}
                  className="press-spring rounded-full bg-lime px-6 py-2.5 text-sm font-bold uppercase tracking-wide text-void disabled:opacity-50"
                >
                  {isPending ? "Cerrando…" : "Cerrar caja"}
                </button>
                {mensaje && (
                  <span className="ml-4 text-sm text-ink-soft">
                    {mensaje}
                  </span>
                )}
              </div>
            </div>

            <h2 className="mt-10 text-sm font-medium uppercase tracking-wide text-ink-soft">
              Historial de cierres
            </h2>
            {sede.historial.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-white/15 bg-card p-8 text-center text-sm text-ink-soft">
                Sin cierres anteriores.
              </div>
            ) : (
              <ul className="mt-4 space-y-2">
                {sede.historial.map((h, i) => {
                  const diff =
                    h.efectivo_contado -
                    h.efectivo_sistema +
                    (h.tarjeta_contado - h.tarjeta_sistema) +
                    (h.transferencia_contado - h.transferencia_sistema);
                  return (
                    <li
                      key={i}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-card p-4"
                    >
                      <div>
                        <p className="text-sm font-medium text-ink">
                          {h.fecha}
                        </p>
                        <p className="text-xs text-ink-soft">
                          Cerrado por {h.cerrado_por_nombre ?? "—"}
                          {h.notas ? ` · ${h.notas}` : ""}
                        </p>
                      </div>
                      <span
                        className={`text-sm font-semibold ${diff === 0 ? "text-sage" : "text-red-400"}`}
                      >
                        {diff === 0 ? "Cuadrada" : `${diff > 0 ? "+" : ""}${fmt(diff)}`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </main>
  );
}
