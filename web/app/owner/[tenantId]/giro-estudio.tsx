"use client";

import { useState, useTransition } from "react";
import { LISTA_GIROS } from "@/lib/giros";
import { fijarGiro } from "./actions";

export default function GiroEstudio({ tenantId, actual, puede }: { tenantId: string; actual: string | null; puede: boolean }) {
  const [g, setG] = useState(actual ?? "pilates");
  const [pend, ir] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <section className="rounded-2xl border border-line bg-void-card p-5" aria-labelledby="giro-t">
      <h2 id="giro-t" className="text-base font-semibold text-ink">Giro del negocio</h2>
      <p className="mt-1 text-sm text-ink/60">Define las palabras y pantallas del estudio. Cada cliente es de un solo giro: Pilates, CrossFit, HYROX o CrossFit + HYROX.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select value={g} onChange={(e) => setG(e.target.value)} disabled={!puede || pend} aria-label="Giro del negocio" className="rounded-lg border border-line bg-void px-3 py-2 text-sm text-ink">
          {LISTA_GIROS.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
        </select>
        <button type="button" disabled={!puede || pend || g === actual} onClick={() => ir(async () => { const r = await fijarGiro(tenantId, g); setMsg(r.error ?? "Giro guardado."); })} className="press-spring rounded-lg bg-lime px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Guardar</button>
        {msg && <span role="status" className="text-sm text-ink/70">{msg}</span>}
      </div>
    </section>
  );
}
