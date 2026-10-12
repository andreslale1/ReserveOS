"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type Opcion = { horarioId: string; fecha: string; hora: string; clase: string; instructora: string; sede: string };

const etiquetaFecha = (f: string) => new Date(`${f}T12:00:00Z`).toLocaleDateString("es-GT", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

export default function PruebaForm({ slug, nombre, color, opciones }: { slug: string; nombre: string; color: string; opciones: Opcion[] }) {
  const sedes = useMemo(() => [...new Set(opciones.map((o) => o.sede))], [opciones]);
  const [sede, setSede] = useState(sedes[0] ?? "");
  const [sel, setSel] = useState<string>("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState<Opcion | null>(null);

  const visibles = opciones.filter((o) => o.sede === sede);
  const fechas = [...new Set(visibles.map((o) => o.fecha))];

  async function agendar() {
    const o = opciones.find((x) => `${x.horarioId}|${x.fecha}` === sel);
    if (!o) return;
    setError(null); setCargando(true);
    const { error: err } = await createClient().rpc("agendar_clase_prueba_propia", { p_horario_id: o.horarioId, p_fecha: o.fecha, p_cliente_id: null });
    setCargando(false);
    if (err) return setError(err.message);
    setListo(o);
  }

  if (listo) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-cream px-6">
        <div className="w-full max-w-md rounded-3xl border border-ink/10 bg-card p-8 text-ink" role="status">
          <h1 className="font-serif text-2xl">¡Tu clase de prueba está reservada!</h1>
          <p className="mt-3 text-ink/70 capitalize">{etiquetaFecha(listo.fecha)} · {listo.hora} · {listo.clase}</p>
          <p className="text-sm text-ink/60">{listo.sede}. Te esperamos en {nombre}.</p>
          <div className="mt-6 flex gap-3 text-sm">
            <Link href="/cuenta/clases" className="rounded-full px-5 py-2.5 font-semibold text-ink" style={{ backgroundColor: color }}>Ver mis reservas</Link>
            <Link href={`/e/${slug}`} className="rounded-full border border-ink/25 px-5 py-2.5 font-semibold">Volver al sitio</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-cream px-6 py-10 text-ink">
      <div className="mx-auto max-w-2xl">
        <Link href={`/e/${slug}`} className="text-sm text-ink/60 underline">← {nombre}</Link>
        <h1 className="mt-3 font-serif text-3xl">Agenda tu clase de prueba</h1>
        <p className="mt-1 text-ink/65">Elige el día y la hora que mejor te quede. Es tu primera clase con nosotras.</p>
        {opciones.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-ink/10 bg-card p-5 text-sm text-ink/70">Por ahora no hay clases disponibles en los próximos días. Escríbenos y te ayudamos a encontrar un lugar.</p>
        ) : (
          <>
            {sedes.length > 1 && (
              <div className="mt-5" role="group" aria-label="Sede">
                {sedes.map((s) => (
                  <button key={s} onClick={() => { setSede(s); setSel(""); }} aria-pressed={s === sede}
                    className={`mr-2 rounded-full border px-4 py-1.5 text-sm ${s === sede ? "border-ink bg-ink text-cream" : "border-ink/25"}`}>{s}</button>
                ))}
              </div>
            )}
            <fieldset className="mt-5 space-y-5">
              <legend className="sr-only">Clases disponibles</legend>
              {fechas.map((f) => (
                <div key={f}>
                  <p className="text-sm font-semibold capitalize">{etiquetaFecha(f)}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {visibles.filter((o) => o.fecha === f).map((o) => {
                      const id = `${o.horarioId}|${o.fecha}`;
                      return (
                        <label key={id} className={`cursor-pointer rounded-xl border px-4 py-2 text-sm ${sel === id ? "border-ink bg-ink text-cream" : "border-ink/20 bg-card"}`}>
                          <input type="radio" name="clase" value={id} checked={sel === id} onChange={() => setSel(id)} className="sr-only" />
                          {o.hora} · {o.clase}{o.instructora ? ` · ${o.instructora}` : ""}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </fieldset>
            {error && <p role="alert" className="mt-4 rounded-xl bg-peach-tint px-4 py-3 text-sm">{error}</p>}
            <button onClick={agendar} disabled={!sel || cargando} className="mt-6 rounded-full px-6 py-3 text-sm font-semibold text-ink disabled:opacity-50" style={{ backgroundColor: color }}>
              {cargando ? "Reservando…" : "Reservar mi clase de prueba"}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
