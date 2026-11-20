"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useTransition } from "react";
import { anotarEspera, cancelar, reservar, reservarCarril, salirEspera } from "./actions";

export type Clase = {
  id: string; nombre: string; inicio: string; fin: string; instructora: string; lugares: number; reservaId: string | null; esperaId: string | null;
  elig: { puede: boolean; codigo: string; motivo?: string; puede_espera?: boolean; en_espera?: boolean };
  modo?: "cupo" | "carril"; carriles?: { recurso_id: string; nombre: string; ocupado: boolean; mio: boolean }[];
};

export default function ClasesView({ sedes, sedeId, dias, dia, dependientes, para, clases, horasCancelacion, vocab }: {
  sedes: { id: string; name: string }[]; sedeId: string; dias: { fecha: string; label: string; num: number }[]; dia: string;
  dependientes: { id: string; nombre: string }[]; para: string; clases: Clase[]; horasCancelacion: number; vocab: { clase: string; clases: string; persona: string };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [carril, setCarril] = useState<Record<string, string>>({});
  const indiceDia = Math.max(0, dias.findIndex((d) => d.fecha === dia));
  const [semana, setSemana] = useState(Math.floor(indiceDia / 7));
  const visibles = dias.slice(semana * 7, semana * 7 + 7);
  const rango = visibles.length ? `${visibles[0].num} – ${visibles[visibles.length - 1].num}` : "";
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
    <div className="ro-screen ro-client-booking grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl text-ink">Reservar {vocab.clase}</h1>
        <Link href="/cuenta/clases/privadas" className="text-sm text-ink underline">Clases privadas 1 a 1</Link>
      </div>
      <div className="flex flex-wrap gap-3">
        {sedes.length > 1 && (
          <select className="rounded-lg border border-ink/15 bg-card px-3 py-2 text-sm" value={sedeId} onChange={(e) => ir({ sede: e.target.value })}>
            {sedes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
        {dependientes.length > 1 && (
          <select className="rounded-lg border border-ink/15 bg-card px-3 py-2 text-sm" value={para} onChange={(e) => ir({ para: e.target.value })}>
            {dependientes.map((d) => <option key={d.id} value={d.id}>Reservar para: {d.nombre}</option>)}
          </select>
        )}
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between text-xs text-ink/60">
          <button type="button" disabled={semana === 0} onClick={() => setSemana(semana - 1)} className="press-spring rounded-md px-2 py-1 hover:bg-ink/5 disabled:opacity-30">← Semana anterior</button>
          <span aria-live="polite">{rango}</span>
          <button type="button" disabled={(semana + 1) * 7 >= dias.length} onClick={() => setSemana(semana + 1)} className="press-spring rounded-md px-2 py-1 hover:bg-ink/5 disabled:opacity-30">Semana siguiente →</button>
        </div>
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2" role="group" aria-label="Días">
          {visibles.map((d) => (
            <button key={d.fecha} onClick={() => ir({ dia: d.fecha })} aria-pressed={d.fecha === dia}
              className={`press-spring flex flex-col items-center rounded-xl border px-1 py-2.5 text-[11px] sm:text-xs ${d.fecha === dia ? "border-ink bg-ink text-cream" : "border-ink/10 bg-card text-ink hover:border-ink/30"}`}>
              <span className="uppercase tracking-wide opacity-70">{d.label}</span><span className="mt-0.5 text-lg font-semibold">{d.num}</span>
            </button>
          ))}
        </div>
      </div>
      {msg && <p className={`rounded-xl px-4 py-3 text-sm ${msg.ok ? "bg-sage-tint text-sage" : "bg-peach-tint text-ink"}`}>{msg.texto}</p>}

      <ul className="ro-session-list grid gap-3">
        {clases.length === 0 && <li className="rounded-2xl border border-ink/10 bg-card p-5 text-sm text-ink/60">No hay {vocab.clases} ese día en esta sede.</li>}
        {clases.map((c) => (
          <li key={c.id} className="ro-session-card rounded-2xl border border-ink/10 bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-ink">{c.inicio} · {c.nombre}</p>
                <p className="text-xs text-ink/55">{c.inicio}–{c.fin}{c.instructora ? ` · ${c.instructora}` : ""} · {c.lugares === 0 ? "llena" : `${c.lugares} lugar${c.lugares === 1 ? "" : "es"}`}</p>
              </div>
              {c.reservaId ? (
                <button className="shrink-0 rounded-full border border-ink/20 px-4 py-2 text-sm text-ink disabled:opacity-50" disabled={isPending}
                  onClick={() => correr(() => cancelar(c.reservaId!), "Reserva cancelada.")}>Cancelar</button>
              ) : c.elig.puede ? (
                <button className="shrink-0 rounded-full bg-ink px-4 py-2 text-sm font-medium text-cream disabled:opacity-50" disabled={isPending}
                  onClick={() => {
                    if (c.modo === "carril") {
                      if (!carril[c.id]) { setMsg({ ok: false, texto: "Elige primero tu carril." }); return; }
                      correr(() => reservarCarril(c.id, dia, carril[c.id], para), "¡Reservada! Tu carril está confirmado.");
                    } else correr(() => reservar(c.id, dia, para), "¡Reservada!");
                  }}>{c.modo === "carril" && carril[c.id] ? `Reservar ${c.carriles?.find((x) => x.recurso_id === carril[c.id])?.nombre ?? "carril"}` : "Reservar"}</button>
              ) : c.elig.codigo === "llena" && c.elig.puede_espera ? (
                <button className="shrink-0 rounded-full border border-ink px-4 py-2 text-sm text-ink disabled:opacity-50" disabled={isPending}
                  onClick={() => correr(() => anotarEspera(c.id, dia, para), "Te anotamos en la lista de espera.")}>Lista de espera</button>
              ) : c.esperaId ? (
                <button className="shrink-0 rounded-full border border-ink/20 px-4 py-2 text-sm text-ink disabled:opacity-50" disabled={isPending}
                  onClick={() => correr(() => salirEspera(c.esperaId!), "Saliste de la lista de espera.")}>Salir de espera</button>
              ) : null}
            </div>
            {c.modo === "carril" && (c.carriles ?? []).length > 0 && (c.elig.puede || c.reservaId) && (
              <div className="mt-3" role="group" aria-label="Carriles de la clase">
                <p className="mb-1.5 text-xs text-ink/55">{c.reservaId ? "Tu carril" : "Elige tu carril"}</p>
                <div className="flex flex-wrap gap-1.5">
                  {c.carriles!.map((k) => {
                    const sel = carril[c.id] === k.recurso_id;
                    return (
                      <button key={k.recurso_id} type="button" disabled={k.ocupado || !!c.reservaId || isPending} aria-pressed={k.mio || sel}
                        aria-label={`${k.nombre}${k.ocupado ? (k.mio ? ", es tuyo" : ", ocupado") : ""}`}
                        onClick={() => setCarril((m) => ({ ...m, [c.id]: sel ? "" : k.recurso_id }))}
                        className={`press-spring tabular h-9 min-w-9 rounded-md border px-2 text-sm font-semibold ${k.mio ? "border-ink bg-ink text-cream" : k.ocupado ? "cursor-not-allowed border-transparent bg-ink/10 text-ink/35" : sel ? "border-lime bg-lime text-white" : "border-ink/20 text-ink hover:border-ink/50"}`}>
                        {k.nombre.replace(/^\D+\s*/, "") || k.nombre}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
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
