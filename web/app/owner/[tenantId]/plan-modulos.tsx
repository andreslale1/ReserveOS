"use client";

import { useState, useTransition } from "react";
import { aplicarPlan, cambiarModulo } from "./actions";

type Modulo = { key: string; nombre: string; descripcion: string; depende_de: string[]; activo: boolean };
type Plan = { key: string; nombre: string; precio_mensual: number; max_sedes: number | null };

const input = "rounded-lg border border-white/15 bg-void px-2 py-1.5 text-sm text-white outline-none focus:border-lime/60";

export default function PlanModulos({
  tenantId,
  modulos,
  planes,
  planActual,
}: {
  tenantId: string;
  modulos: Modulo[];
  planes: Plan[];
  planActual: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [plan, setPlan] = useState(planActual ?? "");
  const [motivo, setMotivo] = useState("");

  function correr(fn: () => Promise<{ error: string | null }>, ok: string) {
    setMsg(null);
    startTransition(async () => {
      const r = await fn();
      setMsg(r.error ?? ok);
    });
  }

  return (
    <section className="mt-10">
      <h2 className="text-sm font-medium uppercase tracking-wide text-white/40">Plan y módulos</h2>
      {msg && <p className="mt-3 rounded-xl bg-white/10 px-4 py-3 text-sm">{msg}</p>}
      <div className="mt-3 flex flex-wrap items-end gap-3 rounded-2xl border border-white/10 bg-void-card p-4">
        <label className="text-xs text-white/50">
          Plan<br />
          <select className={input} value={plan} onChange={(e) => setPlan(e.target.value)}>
            <option value="">Elige…</option>
            {planes.map((p) => (
              <option key={p.key} value={p.key}>
                {p.nombre} · Q{Number(p.precio_mensual).toLocaleString("es-GT")} · {p.max_sedes ?? "∞"} sede(s)
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-white/50">
          Motivo del cambio<br />
          <input className={`${input} w-64`} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. contrato firmado" />
        </label>
        <button
          className="rounded-full bg-lime px-4 py-1.5 text-sm font-semibold text-void disabled:opacity-50"
          disabled={isPending || !plan || motivo.trim().length < 3}
          onClick={() => correr(() => aplicarPlan(tenantId, plan, motivo), "Plan aplicado.")}
        >
          Aplicar plan
        </button>
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {modulos.map((m) => (
          <li key={m.key} className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-void-card p-3 text-sm">
            <div>
              <p className={m.activo ? "text-white" : "text-white/40"}>{m.nombre}</p>
              <p className="text-xs text-white/40">{m.descripcion}</p>
            </div>
            <button
              className={`shrink-0 rounded-full px-3 py-1 text-xs ${m.activo ? "bg-lime text-void" : "border border-white/15 text-white/60"}`}
              disabled={isPending || motivo.trim().length < 3}
              title={motivo.trim().length < 3 ? "Escribe primero el motivo del cambio" : ""}
              onClick={() => correr(() => cambiarModulo(tenantId, m.key, !m.activo, motivo), m.activo ? "Módulo desactivado." : "Módulo activado.")}
            >
              {m.activo ? "Activo" : "Apagado"}
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-white/35">Apagar un módulo bloquea su uso, pero conserva todo su historial.</p>
    </section>
  );
}
