"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { reservarPorPersonal } from "./actions";

export default function Confirmar({ clienteId, horarioId, fecha, recursoId, puede, motivo }: { clienteId: string; horarioId: string; fecha: string; recursoId: string | null; puede: boolean; motivo?: string }) {
  const [pend, ir] = useTransition();
  const [res, setRes] = useState<{ ok: boolean; t: string } | null>(null);
  if (res?.ok) {
    return (
      <div role="status" className="border border-line bg-good-wash p-5">
        <p className="text-base font-semibold text-good">{res.t}</p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <Link href="/panel/reservar" className="press-spring bg-ink px-4 py-2 font-semibold text-void">Hacer otra reserva</Link>
          <Link href={`/panel/clase/${horarioId}/${fecha}`} className="press-spring border border-line px-4 py-2 font-semibold text-ink">Ver la clase</Link>
        </div>
      </div>
    );
  }
  return (
    <div>
      {res && !res.ok && <p role="alert" className="mb-3 bg-bad-wash px-4 py-3 text-sm text-bad">{res.t}</p>}
      <button disabled={pend || !puede} onClick={() => ir(async () => { const r = await reservarPorPersonal(clienteId, horarioId, fecha, recursoId); setRes(r.error ? { ok: false, t: r.error } : { ok: true, t: r.carril ? `Reserva confirmada. Carril: ${r.carril}.` : "Reserva confirmada." }); })}
        className="press-spring bg-lime px-6 py-3 text-sm font-semibold text-white disabled:opacity-40">{pend ? "Reservando…" : "Confirmar reserva"}</button>
      {!puede && motivo && <p className="mt-2 text-sm text-ink-soft">{motivo}</p>}
    </div>
  );
}
