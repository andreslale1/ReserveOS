"use client";

import { useState, useTransition } from "react";
import { corregirInstructora, guardarReto } from "./actions";

export type Clase = {
  horario_id: string; fecha: string; hora_inicio: string; nombre_clase: string; sede: string; instructora: string | null; es_sustitucion: boolean;
  cupo: number; reservadas: number; asistieron: number; no_vinieron: number; sin_marcar: number; canceladas: number; clase_cancelada: boolean; ocupacion_pct: number;
};

const campo = "mt-1 w-full rounded-lg border border-white/15 bg-cream px-3 py-2 text-sm text-ink outline-none focus:border-ink/30";
const llave = (c: Pick<Clase, "horario_id" | "fecha">) => `${c.horario_id}|${c.fecha}`;

export default function ClasesView({ tenantId, clases, instructoras, puedeCorregir, retoActual }: {
  tenantId: string; clases: Clase[]; instructoras: { id: string; nombre: string }[]; puedeCorregir: boolean; retoActual: number | null;
}) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [instructora, setInstructora] = useState("");
  const [motivo, setMotivo] = useState("");
  const [sustitucion, setSustitucion] = useState(false);
  const [meta, setMeta] = useState(String(retoActual ?? 12));
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const alternar = (c: Clase) => setSel((s) => { const n = new Set(s); n.has(llave(c)) ? n.delete(llave(c)) : n.add(llave(c)); return n; });
  const motivoCorto = motivo.trim().length < 5;

  function aplicar() {
    setMsg(null);
    startTransition(async () => {
      const r = await corregirInstructora(tenantId, [...sel].map((k) => { const [horario_id, fecha] = k.split("|"); return { horario_id, fecha }; }), instructora, motivo, sustitucion);
      if (r.error) setMsg({ ok: false, texto: r.error });
      else { setMsg({ ok: true, texto: `${r.n} clase${r.n === 1 ? "" : "s"} ${sustitucion ? "con sustitución registrada" : "corregida" + (r.n === 1 ? "" : "s")}.` }); setSel(new Set()); setMotivo(""); }
    });
  }
  function guardar() {
    setMsg(null);
    startTransition(async () => {
      const r = await guardarReto(tenantId, Number(meta));
      setMsg(r.error ? { ok: false, texto: r.error } : { ok: true, texto: "Meta del reto mensual guardada." });
    });
  }

  return (
    <>
      {msg && <p role={msg.ok ? "status" : "alert"} className={`rounded-xl px-4 py-3 text-sm ${msg.ok ? "bg-sage-tint text-sage" : "bg-peach-tint text-ink"}`}>{msg.texto}</p>}

      <section className="overflow-x-auto rounded-2xl border border-white/10 bg-card p-5" aria-label="Clases dadas">
        <h2 className="text-base font-semibold text-ink">Clase por clase</h2>
        <table className="mt-3 w-full min-w-[760px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-ink/50">
            <tr>{puedeCorregir && <th className="w-8 py-2"><span className="sr-only">Elegir</span></th>}<th className="py-2">Fecha</th><th>Clase</th><th>Sede</th><th>Instructora</th><th>Reservadas</th><th>Asistieron</th><th>Sin marcar</th><th>Cancel.</th><th>Ocupación</th></tr>
          </thead>
          <tbody className="divide-y divide-white/10 text-ink">
            {clases.length === 0 && <tr><td colSpan={10} className="py-4 text-ink/55">No hay clases dadas con esos filtros.</td></tr>}
            {clases.map((c) => (
              <tr key={llave(c)} className={c.clase_cancelada ? "opacity-50" : ""}>
                {puedeCorregir && <td className="py-2"><input type="checkbox" aria-label={`Elegir ${c.nombre_clase} del ${c.fecha}`} checked={sel.has(llave(c))} onChange={() => alternar(c)} /></td>}
                <td className="py-2 whitespace-nowrap">{c.fecha.split("-").reverse().join("/")} {c.hora_inicio.slice(0, 5)}</td>
                <td>{c.nombre_clase}{c.clase_cancelada && <span className="ml-1 text-xs text-ink/50">(cancelada)</span>}</td>
                <td>{c.sede}</td>
                <td>{c.instructora ?? "Sin asignar"}{c.es_sustitucion && <span className="ml-1 rounded-full bg-white/10 px-2 py-0.5 text-xs">sustitución</span>}</td>
                <td>{c.reservadas}/{c.cupo}</td><td>{c.asistieron}</td><td className={c.sin_marcar > 0 ? "text-peach" : ""}>{c.sin_marcar}</td><td>{c.canceladas}</td><td>{Number(c.ocupacion_pct)}%</td>
              </tr>
            ))}
          </tbody>
        </table>

        {puedeCorregir && (
          <div className="mt-5 grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-[1fr_2fr_auto]">
            <label className="text-sm text-ink/70">Quién dio las clases elegidas ({sel.size})
              <select value={instructora} onChange={(e) => setInstructora(e.target.value)} className={campo}><option value="">Elige instructora…</option>{instructoras.map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}</select>
            </label>
            <label className="text-sm text-ink/70">Motivo (obligatorio, queda en la auditoría)
              <input value={motivo} onChange={(e) => setMotivo(e.target.value)} className={campo} placeholder="Ej.: la titular estaba enferma" />
            </label>
            <div className="flex flex-col justify-end gap-2">
              <label className="flex items-center gap-2 text-sm text-ink/70"><input type="checkbox" checked={sustitucion} onChange={(e) => setSustitucion(e.target.checked)} /> Es una sustitución</label>
              <button onClick={aplicar} disabled={isPending || sel.size === 0 || !instructora || motivoCorto} className="press-spring rounded-full bg-ink px-5 py-2 text-sm font-medium text-cream disabled:opacity-50">{isPending ? "Guardando…" : "Aplicar"}</button>
            </div>
            {(sel.size === 0 || !instructora || motivoCorto) && <p className="text-xs text-ink/50 sm:col-span-3">{sel.size === 0 ? "Marca las clases a corregir. " : ""}{!instructora ? "Elige quién las dio. " : ""}{motivoCorto ? "Escribe el motivo (mínimo 5 letras)." : ""}</p>}
          </div>
        )}
      </section>

      {retoActual !== null && (
        <section className="rounded-2xl border border-white/10 bg-card p-5" aria-label="Reto mensual">
          <h2 className="text-base font-semibold text-ink">Reto mensual de las clientas</h2>
          <p className="mt-1 text-sm text-ink/60">Las clientas ven en su inicio una barra de progreso hacia esta meta de clases asistidas en el mes.</p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="text-sm text-ink/70">Clases al mes<input type="number" min={1} max={60} value={meta} onChange={(e) => setMeta(e.target.value)} className={`${campo} w-28`} /></label>
            <button onClick={guardar} disabled={isPending || Number(meta) < 1 || Number(meta) > 60 || Number(meta) === retoActual} className="press-spring rounded-full bg-ink px-5 py-2 text-sm font-medium text-cream disabled:opacity-50">Guardar meta</button>
          </div>
        </section>
      )}
    </>
  );
}
