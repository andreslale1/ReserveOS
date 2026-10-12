"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cancelar, reservarPrivada } from "../actions";

export type Hueco = { horario_id: string; sede_id: string; sede: string; fecha: string; hora_inicio: string; hora_fin: string; nombre_clase: string; cupo_disponible: number; instructor_nombre: string | null };
export type MiPrivada = { id: string; fecha: string; clase: string; inicio: string; fin: string; sede: string; instructora: string };

const fmt = (f: string) => new Date(f + "T00:00:00").toLocaleDateString("es-GT", { weekday: "long", day: "numeric", month: "long" });

export default function PrivadasClienta({ clienteId, puedeReservar, huecos, mias }: { clienteId: string; puedeReservar: boolean; huecos: Hueco[]; mias: MiPrivada[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  function correr(fn: () => Promise<{ error: string | null; penalizada?: boolean }>, ok: string) {
    setMsg(null);
    startTransition(async () => { const r = await fn(); if (r.error) setMsg({ ok: false, texto: r.error }); else { setMsg({ ok: true, texto: r.penalizada ? "Cancelada. Como fue tarde, no se devuelve la clase." : ok }); router.refresh(); } });
  }
  const libres = huecos.filter((h) => h.cupo_disponible > 0);
  const porDia = new Map<string, Hueco[]>();
  for (const h of libres) porDia.set(h.fecha, [...(porDia.get(h.fecha) ?? []), h]);

  return (
    <>
      {msg && <p role={msg.ok ? "status" : "alert"} className={`rounded-xl px-4 py-3 text-sm ${msg.ok ? "bg-sage-tint text-sage" : "bg-peach-tint text-ink"}`}>{msg.texto}</p>}
      {mias.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-card p-5" aria-label="Mis clases privadas">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink/50">Mis clases privadas</h2>
          <ul className="mt-2 divide-y divide-white/5">
            {mias.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <span><span className="block font-medium capitalize text-ink">{fmt(m.fecha)} · {m.inicio}</span><span className="text-xs text-ink/60">{m.clase} · {m.sede}{m.instructora ? ` · ${m.instructora}` : ""}</span></span>
                <button className="rounded-full border border-white/20 px-4 py-1.5 text-xs text-ink disabled:opacity-50" disabled={isPending} onClick={() => correr(() => cancelar(m.id), "Clase privada cancelada.")}>Cancelar</button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="rounded-2xl border border-white/10 bg-card p-5" aria-label="Horarios disponibles">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink/50">Horarios disponibles · próximos 14 días</h2>
        {porDia.size === 0 && <p className="mt-2 text-sm text-ink/60">No hay horarios privados libres por ahora.</p>}
        {[...porDia.entries()].map(([dia, hs]) => (
          <div key={dia} className="mt-3">
            <p className="text-sm font-medium capitalize text-ink">{fmt(dia)}</p>
            <ul className="mt-1 grid gap-2">
              {hs.map((h) => (
                <li key={`${h.horario_id}|${h.fecha}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm">
                  <span><span className="font-medium text-ink">{h.hora_inicio.slice(0, 5)}–{h.hora_fin.slice(0, 5)}</span> <span className="text-xs text-ink/60">· {h.sede}{h.instructor_nombre ? ` · ${h.instructor_nombre}` : ""}</span></span>
                  <button className="rounded-full bg-ink px-4 py-1.5 text-xs font-medium text-cream disabled:opacity-50" disabled={isPending || !puedeReservar} title={puedeReservar ? "" : "Necesitas un paquete de clases privadas"}
                    onClick={() => correr(() => reservarPrivada(h.horario_id, h.fecha, clienteId), "¡Clase privada reservada!")}>Reservar</button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </>
  );
}
