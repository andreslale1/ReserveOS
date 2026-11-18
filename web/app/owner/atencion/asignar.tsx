"use client";

import { useState, useTransition } from "react";
import { asignarEstudio } from "./actions";

export default function Asignar({ tenantId, equipo, responsables }: { tenantId: string; equipo: { user_id: string; nombre: string }[]; responsables: string[] }) {
  const [pend, ir] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [sel, setSel] = useState("");
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
      <span className="text-white/50">Responsable: {responsables.length ? responsables.join(", ") : "sin asignar"}</span>
      <select value={sel} onChange={(e) => setSel(e.target.value)} aria-label="Asignar responsable" className="rounded-md border border-white/15 bg-void px-2 py-1 text-white">
        <option value="">Elegir…</option>
        {equipo.map((m) => <option key={m.user_id} value={m.user_id}>{m.nombre}</option>)}
      </select>
      <button disabled={!sel || pend} onClick={() => ir(async () => { const r = await asignarEstudio(tenantId, sel, true); setErr(r.error); setSel(""); })} className="rounded-md bg-lime px-2 py-1 font-semibold text-void disabled:opacity-40">Asignar</button>
      {responsables.length > 0 && (
        <button disabled={!sel || pend} onClick={() => ir(async () => { const r = await asignarEstudio(tenantId, sel, false); setErr(r.error); setSel(""); })} className="rounded-md border border-white/20 px-2 py-1 text-white/70 disabled:opacity-40">Quitar</button>
      )}
      {err && <span role="alert" className="text-red-300">{err}</span>}
    </div>
  );
}
