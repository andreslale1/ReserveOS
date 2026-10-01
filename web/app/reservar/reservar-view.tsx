"use client";

import { useState, useTransition } from "react";
import { reservarClase } from "./actions";

type Clase = {
  id: string;
  nombre: string;
  horaInicio: string;
  cupoMaximo: number;
  ocupados: number;
  instructora: string;
  yaReservada: boolean;
};

type Dia = {
  fecha: string;
  label: string;
  dayNum: number;
  clases: Clase[];
};

export default function ReservarView({
  nombre,
  sedeName,
  clasesRestantes,
  dias,
}: {
  nombre: string;
  sedeName: string;
  clasesRestantes: number | null;
  dias: Dia[];
}) {
  const [activo, setActivo] = useState(0);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function reservar(claseId: string, fecha: string) {
    setPendingId(claseId);
    setMensaje(null);
    startTransition(async () => {
      const res = await reservarClase(claseId, fecha);
      setPendingId(null);
      setMensaje(
        res.ok
          ? { tipo: "ok", texto: "¡Reservado! Te esperamos en clase." }
          : { tipo: "error", texto: res.message ?? "No se pudo reservar." },
      );
    });
  }

  const dia = dias[activo];

  return (
    <main className="min-h-screen bg-void pb-16 text-white">
      <header className="border-b border-white/10 bg-void-card px-6 py-6">
        <p className="text-xs uppercase tracking-wide text-white/40">
          {sedeName}
        </p>
        <h1 className="mt-1 text-2xl font-black uppercase tracking-tight">
          Hola, {nombre.split(" ")[0]}
        </h1>
        {clasesRestantes !== null && (
          <p className="mt-1 text-sm text-lime">
            {clasesRestantes} clases restantes en tu paquete
          </p>
        )}
      </header>

      <div className="mx-auto max-w-xl px-6 py-6">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {dias.map((d, i) => (
            <button
              key={d.fecha}
              onClick={() => setActivo(i)}
              className={`flex shrink-0 flex-col items-center rounded-2xl px-4 py-3 text-sm transition-colors duration-200 ${
                i === activo
                  ? "bg-lime text-void"
                  : "bg-void-card text-white/60 hover:text-white"
              }`}
            >
              <span className="text-xs uppercase">{d.label}</span>
              <span className="text-lg font-bold">{d.dayNum}</span>
            </button>
          ))}
        </div>

        {mensaje && (
          <p
            className={`mt-4 rounded-xl px-4 py-3 text-sm ${
              mensaje.tipo === "ok"
                ? "bg-lime/15 text-lime"
                : "bg-red-500/15 text-red-300"
            }`}
          >
            {mensaje.texto}
          </p>
        )}

        <ul className="mt-6 space-y-3">
          {dia.clases.length === 0 && (
            <li className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-white/40">
              No hay clases este día.
            </li>
          )}
          {dia.clases.map((c) => {
            const libres = c.cupoMaximo - c.ocupados;
            const lleno = libres <= 0;
            return (
              <li
                key={c.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-void-card p-4"
              >
                <div>
                  <p className="text-sm font-bold text-white">
                    {c.horaInicio} · {c.nombre}
                  </p>
                  <p className="text-xs text-white/45">{c.instructora}</p>
                  <p className="mt-1 text-xs text-white/35">
                    {lleno ? "Lleno" : `${libres} cupos libres`}
                  </p>
                </div>

                {c.yaReservada ? (
                  <span className="shrink-0 rounded-full bg-lime/15 px-4 py-2 text-xs font-semibold text-lime">
                    Reservada
                  </span>
                ) : (
                  <button
                    disabled={lleno || (isPending && pendingId === c.id)}
                    onClick={() => reservar(c.id, dia.fecha)}
                    className="press-spring shrink-0 rounded-full bg-lime px-4 py-2 text-xs font-bold uppercase text-void transition-colors duration-200 hover:bg-lime/85 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/30"
                  >
                    {pendingId === c.id ? "…" : lleno ? "Lleno" : "Reservar"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
