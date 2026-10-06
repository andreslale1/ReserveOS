"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useTransition } from "react";
import { anotarEspera, cancelar, reservar, salirEspera } from "./actions";

export type Clase = {
  id: string; nombre: string; inicio: string; fin: string; instructora: string; lugares: number; reservaId: string | null; esperaId: string | null;
  elig: { puede: boolean; codigo: string; motivo?: string; puede_espera?: boolean; en_espera?: boolean };
};

export default function ClasesView({ sedes, sedeId, dias, dia, dependientes, para, clases, horasCancelacion }: {
  sedes: { id: string; name: string }[]; sedeId: string; dias: { fecha: string; label: string; num: number }[]; dia: string;
  dependientes: { id: string; nombre: string }[]; para: string; clases: Clase[]; horasCancelacion: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const ir = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ sede: sedeId, dia, para, ...patch });
    router.push(`/cuenta/clases?${p.toString()}`);
  };
  function correr(fn: () => Promise<{ error: string | null; penalizada?: boolean }>, ok: string) {
    setMsg(null);
    startTransition(async () => {
      const r = await fn();
      if (r.error) setMsg({ ok: false, texto: r.error });
      else { setMsg({ ok: true, texto: r.penalizada ? "Cancelada. Como fue tarde, no se devuelve la clase." : ok }); router.refresh(); }
    });
  }

  return (
    <div className="grid gap-4">
      <h1 className="font-serif text-2xl text-ink">Clases</h1>
      <div className="flex flex-wrap gap-3">
        {sedes.length > 1 && (
          <select className="rounded-lg border border-black/15 bg-white px-3 py-2 text-sm" value={sedeId} onChange={(e) => ir({ sede: e.target.value })}>
            {sedes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
        {dependientes.length > 1 && (
          <select className="rounded-lg border border-black/15 bg-white px-3 py-2 text-sm" value={para} onChange={(e) => ir({ para: e.target.value })}>
            {dependientes.map((d) => <option key={d.id} value={d.id}>Reservar para: {d.nombre}</option>)}
          </select>
        )}
      </div>
      <div className="-mx-1 flex gap-2 overflow-x-auto pb-1">
        {dias.map((d) => (
          <button key={d.fecha} onClick={() => ir({ dia: d.fecha })} className={`flex w-14 shrink-0 flex-col items-center rounded-2xl border px-2 py-2 text-xs ${d.fecha === dia ? "border-ink bg-ink text-cream" : "border-black/10 bg-white text-ink"}`}>
            <span className="uppercase">{d.label}</span><span className="text-lg font-semibold">{d.num}</span>
          </button>
        ))}
      </div>
      {msg && <p className={`rounded-xl px-4 py-3 text-sm ${msg.ok ? "bg-sage-tint text-sage" : "bg-peach-tint text-ink"}`}>{msg.texto}</p>}

      <ul className="grid gap-3">
        {clases.length === 0 && <li className="rounded-2xl border border-black/10 bg-white p-5 text-sm text-ink/60">No hay clases ese día en esta sede.</li>}
        {clases.map((c) => (
          <li key={c.id} className="rounded-2xl border border-black/10 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-ink">{c.inicio} · {c.nombre}</p>
                <p className="text-xs text-ink/55">{c.inicio}–{c.fin}{c.instructora ? ` · ${c.instructora}` : ""} · {c.lugares === 0 ? "llena" : `${c.lugares} lugar${c.lugares === 1 ? "" : "es"}`}</p>
              </div>
              {c.reservaId ? (
                <button className="shrink-0 rounded-full border border-black/20 px-4 py-2 text-sm text-ink disabled:opacity-50" disabled={isPending}
                  onClick={() => correr(() => cancelar(c.reservaId!), "Reserva cancelada.")}>Cancelar</button>
              ) : c.elig.puede ? (
                <button className="shrink-0 rounded-full bg-ink px-4 py-2 text-sm font-medium text-cream disabled:opacity-50" disabled={isPending}
                  onClick={() => correr(() => reservar(c.id, dia, para), "¡Reservada!")}>Reservar</button>
              ) : c.elig.codigo === "llena" && c.elig.puede_espera ? (
                <button className="shrink-0 rounded-full border border-ink px-4 py-2 text-sm text-ink disabled:opacity-50" disabled={isPending}
                  onClick={() => correr(() => anotarEspera(c.id, dia, para), "Te anotamos en la lista de espera.")}>Lista de espera</button>
              ) : c.esperaId ? (
                <button className="shrink-0 rounded-full border border-black/20 px-4 py-2 text-sm text-ink disabled:opacity-50" disabled={isPending}
                  onClick={() => correr(() => salirEspera(c.esperaId!), "Saliste de la lista de espera.")}>Salir de espera</button>
              ) : null}
            </div>
            {c.reservaId ? (
              <p className="mt-2 text-xs text-sage">✓ Tienes lugar. Cancela con al menos {horasCancelacion} h de anticipación para recuperar la clase.</p>
            ) : !c.elig.puede && c.elig.motivo ? (
              <p className="mt-2 text-xs text-ink/65">{c.elig.motivo}{["sin_paquete", "no_cubre_sede", "sin_creditos", "vencido"].includes(c.elig.codigo) && <> <Link href="/cuenta/paquetes" className="underline">Ver paquetes</Link></>}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
