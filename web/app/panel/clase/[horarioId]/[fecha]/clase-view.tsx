"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  agregarAsistente,
  anotarEnEspera,
  cambiarCupo,
  asignarSala,
  cancelarClase,
  marcarAsistencia,
  quitarAsistente,
  reabrirClase,
} from "./actions";

type Asistente = {
  id: string;
  nombre: string;
  telefono: string;
  cuidados: string;
  tipo: string;
  asistio: boolean | null;
};

const input =
  "mt-1 w-full rounded-lg border border-white/15 bg-cream px-3 py-2 text-ink outline-none focus:border-ink/30";
const boton =
  "press-spring rounded-full bg-ink px-4 py-2 text-sm font-medium text-cream disabled:opacity-50";
const botonSec =
  "rounded-full border border-white/15 px-3 py-1.5 text-xs text-ink/70 hover:text-ink disabled:opacity-50";

export default function ClaseView({
  horarioId,
  fecha,
  esFuturaOHoy,
  noEsFutura,
  clase,
  cancelada,
  salaId,
  salas,
  asistentes,
  espera,
  clientas,
  puedeGestionar,
  puedeAdminClase,
}: {
  horarioId: string;
  fecha: string;
  esFuturaOHoy: boolean;
  noEsFutura: boolean;
  clase: { nombre: string; hora: string; cupo: number; sede: string; instructora: string };
  cancelada: boolean;
  salaId: string;
  salas: { id: string; nombre: string }[];
  asistentes: Asistente[];
  espera: { id: string; nombre: string }[];
  clientas: { id: string; nombre: string }[];
  puedeGestionar: boolean;
  puedeAdminClase: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [nueva, setNueva] = useState("");
  const [cupo, setCupo] = useState(String(clase.cupo));
  const [confirmarCancelar, setConfirmarCancelar] = useState(false);
  const [sala, setSala] = useState(salaId);

  function correr(fn: () => Promise<{ error: string | null }>, ok: string, despues?: () => void) {
    setMsg(null);
    startTransition(async () => {
      const r = await fn();
      if (r.error) setMsg({ ok: false, texto: r.error });
      else {
        setMsg({ ok: true, texto: ok });
        despues?.();
      }
    });
  }

  const fechaLegible = new Date(fecha + "T00:00:00").toLocaleDateString("es-GT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const llena = asistentes.length >= clase.cupo;

  return (
    <main className="min-h-screen bg-cream">
      <header className="border-b border-white/10 bg-card px-6 py-6 md:px-10">
        <Link href="/panel/hoy" className="text-sm text-ink/60 hover:text-ink">
          ← Hoy
        </Link>
        <h1 className="mt-2 font-serif text-2xl text-ink md:text-3xl">{clase.nombre}</h1>
        <p className="mt-1 text-sm capitalize text-ink/60">
          {fechaLegible} · {clase.hora} · {clase.instructora} · {clase.sede}
        </p>
        <p className="mt-1 text-sm text-ink/60">
          {asistentes.length} de {clase.cupo} lugares
          {cancelada ? " · CLASE CANCELADA" : ""}
        </p>
      </header>

      <div className="mx-auto grid max-w-3xl gap-6 px-6 py-8 md:px-10">
        {msg && (
          <p className={`rounded-xl px-4 py-3 text-sm ${msg.ok ? "bg-sage-tint text-sage" : "bg-peach-tint text-ink"}`}>
            {msg.texto}
          </p>
        )}

        <section className="rounded-2xl border border-white/10 bg-card p-5">
          <h2 className="text-base font-semibold text-ink">Lista de la clase</h2>
          <ul className="mt-3 divide-y divide-white/10">
            {asistentes.length === 0 && <li className="py-3 text-sm text-ink/50">Nadie reservada.</li>}
            {asistentes.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="text-sm font-medium text-ink">
                    {a.nombre}
                    {a.tipo === "prueba" && <span className="ml-2 text-xs text-ink/50">clase de prueba</span>}
                  </p>
                  <p className="text-xs text-ink/55">
                    {a.telefono}
                    {a.cuidados ? ` · ⚠ ${a.cuidados}` : ""}
                  </p>
                </div>
                {(
                  <div className="flex flex-wrap items-center gap-2">
                    {noEsFutura && (
                      <>
                        <button
                          className={`${botonSec} ${a.asistio === true ? "bg-sage-tint text-sage" : ""}`}
                          disabled={isPending}
                          onClick={() => correr(() => marcarAsistencia(horarioId, fecha, a.id, true), "Asistencia registrada.")}
                        >
                          Asistió
                        </button>
                        <button
                          className={`${botonSec} ${a.asistio === false ? "bg-peach-tint text-ink" : ""}`}
                          disabled={isPending}
                          onClick={() => correr(() => marcarAsistencia(horarioId, fecha, a.id, false), "No-show registrado.")}
                        >
                          No vino
                        </button>
                      </>
                    )}
                    {puedeGestionar && esFuturaOHoy && (
                      <button
                        className={botonSec}
                        disabled={isPending}
                        onClick={() => correr(() => quitarAsistente(horarioId, fecha, a.id), "Reserva cancelada.")}
                      >
                        Quitar
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>

          {puedeGestionar && esFuturaOHoy && !cancelada && (
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
              <select value={nueva} onChange={(e) => setNueva(e.target.value)} className={input}>
                <option value="">Agregar clienta…</option>
                {clientas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
              <button
                className={boton}
                disabled={isPending || !nueva || llena}
                onClick={() => correr(() => agregarAsistente(horarioId, fecha, nueva), "Clienta agregada.", () => setNueva(""))}
              >
                Agregar
              </button>
              <button
                className={botonSec}
                disabled={isPending || !nueva || !llena}
                onClick={() => correr(() => anotarEnEspera(horarioId, fecha, nueva), "Anotada en lista de espera.", () => setNueva(""))}
              >
                A lista de espera
              </button>
            </div>
          )}
          {llena && <p className="mt-2 text-xs text-ink/50">Clase llena: puedes anotarla en lista de espera. Entra sola si alguien cancela.</p>}
        </section>

        <section className="rounded-2xl border border-white/10 bg-card p-5">
          <h2 className="text-base font-semibold text-ink">Lista de espera</h2>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-ink">
            {espera.length === 0 && <li className="list-none text-ink/50">Nadie en espera.</li>}
            {espera.map((e) => (
              <li key={e.id}>{e.nombre}</li>
            ))}
          </ol>
        </section>

        {puedeAdminClase && esFuturaOHoy && (
          <section className="rounded-2xl border border-white/10 bg-card p-5">
            <h2 className="text-base font-semibold text-ink">Administrar la clase</h2>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="text-sm text-ink/60">
                Cupo máximo (aplica a todas las semanas)
                <input type="number" min={1} value={cupo} onChange={(e) => setCupo(e.target.value)} className={`${input} w-32`} />
              </label>
              <button
                className={boton}
                disabled={isPending || Number(cupo) < 1 || Number(cupo) === clase.cupo}
                onClick={() => correr(() => cambiarCupo(horarioId, fecha, Number(cupo)), "Cupo actualizado.")}
              >
                Guardar cupo
              </button>
            </div>
            {salas.length > 0 && (
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <label className="text-sm text-ink/60">Sala
                  <select value={sala} onChange={(e) => setSala(e.target.value)} className={`${input} w-56`}>
                    <option value="">Sin sala</option>
                    {salas.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                  </select>
                </label>
                <button className={boton} disabled={isPending || sala === salaId} onClick={() => correr(() => asignarSala(horarioId, fecha, sala || null), "Sala actualizada.")}>Guardar sala</button>
              </div>
            )}
            <div className="mt-5 border-t border-white/10 pt-4">
              {cancelada ? (
                <button className={botonSec} disabled={isPending} onClick={() => correr(() => reabrirClase(horarioId, fecha), "Clase reabierta.")}>
                  Reabrir esta clase
                </button>
              ) : confirmarCancelar ? (
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-sm text-ink">
                    Se cancelan las {asistentes.length} reservas de este día y se devuelve la clase a cada paquete.
                  </p>
                  <button
                    className={boton}
                    disabled={isPending}
                    onClick={() =>
                      correr(() => cancelarClase(horarioId, fecha), "Clase cancelada.", () => setConfirmarCancelar(false))
                    }
                  >
                    Sí, cancelar clase
                  </button>
                  <button className={botonSec} onClick={() => setConfirmarCancelar(false)}>
                    No
                  </button>
                </div>
              ) : (
                <button className={botonSec} onClick={() => setConfirmarCancelar(true)}>
                  Cancelar solo esta fecha (feriado / cierre)
                </button>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
