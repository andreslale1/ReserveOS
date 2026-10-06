"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { actualizarContrato, aplicarSuscripcion } from "./actions";

export type Contrato = {
  id: string; lead_id: string | null; empresa: string | null; tenant_id: string | null; estudio: string | null; estado: string; fecha_firma: string;
  vigencia_meses: number; fecha_vencimiento: string; dias_para_vencer: number; renovacion_auto: boolean; mensualidad: number; setup_monto: number;
  documento_url: string | null; notas: string | null; version_propuesta: number | null;
};
const q = (n: number) => `Q${Number(n).toLocaleString("es-GT")}`;
const input = "rounded-lg border border-white/15 bg-void px-2 py-1.5 text-sm text-white outline-none focus:border-lime/60";

export default function ContratosView({ contratos, estudios }: { contratos: Contrato[]; estudios: { id: string; name: string }[] }) {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [sel, setSel] = useState<Record<string, string>>({});

  function correr(fn: () => Promise<{ error: string | null }>, ok: string) {
    setMsg(null);
    startTransition(async () => { const r = await fn(); setMsg(r.error ?? ok); });
  }
  return (
    <main className="mx-auto max-w-5xl px-6 py-8 md:px-10">
      <h1 className="text-2xl font-semibold">Contratos y renovaciones</h1>
      <p className="mt-1 text-sm text-white/50">Cada contrato nace de una propuesta aceptada. Aplicarlo a la suscripción deja el plan y precio del estudio conforme a lo firmado, sin tocar cobros ya generados.</p>
      {msg && <p className="mt-4 rounded-xl bg-white/10 px-4 py-3 text-sm">{msg}</p>}
      <ul className="mt-6 grid gap-4">
        {contratos.length === 0 && <li className="text-sm text-white/50">Aún no hay contratos.</li>}
        {contratos.map((c) => {
          const proximo = c.estado === "vigente" && c.dias_para_vencer <= 60;
          return (
            <li key={c.id} className="rounded-2xl border border-white/10 bg-void-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-base font-semibold">{c.empresa ?? "—"} {c.version_propuesta ? <span className="text-xs font-normal text-white/45">· propuesta v{c.version_propuesta}</span> : null}</p>
                  <p className="text-xs text-white/50">Firmado {c.fecha_firma} · {c.vigencia_meses} meses · vence {c.fecha_vencimiento}{c.renovacion_auto ? " · renovación automática" : ""}</p>
                  <p className="mt-1 text-sm">{q(c.mensualidad)}/mes · setup {q(c.setup_monto)}</p>
                </div>
                <div className="text-right text-xs">
                  <span className={c.estado === "vigente" ? "text-lime" : "text-white/50"}>{c.estado}</span>
                  {proximo && <p className={c.dias_para_vencer < 0 ? "text-red-300" : "text-yellow-300"}>{c.dias_para_vencer < 0 ? `Vencido hace ${-c.dias_para_vencer} días` : `Vence en ${c.dias_para_vencer} días`}</p>}
                  {c.lead_id && <Link href={`/owner/pipeline/${c.lead_id}`} className="text-white/45 hover:text-white">ver oportunidad</Link>}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <select className={input} value={sel[c.id] ?? c.tenant_id ?? ""} onChange={(e) => setSel({ ...sel, [c.id]: e.target.value })}>
                  <option value="">Vincular estudio…</option>{estudios.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
                <button className="rounded-full border border-white/15 px-3 py-1.5 text-xs disabled:opacity-50" disabled={isPending || !(sel[c.id])}
                  onClick={() => correr(() => actualizarContrato(c.id, c.estado, sel[c.id], c.renovacion_auto, c.documento_url ?? "", c.notas ?? ""), "Estudio vinculado.")}>Vincular</button>
                <button className="rounded-full bg-lime px-3 py-1.5 text-xs font-semibold text-void disabled:opacity-50" disabled={isPending || !c.tenant_id}
                  onClick={() => correr(() => aplicarSuscripcion(c.id), "Suscripción actualizada.")}>Aplicar a la suscripción</button>
                {c.estado === "vigente" && <button className="text-xs text-white/40 hover:text-white" disabled={isPending} onClick={() => correr(() => actualizarContrato(c.id, "cancelado", c.tenant_id ?? "", c.renovacion_auto, c.documento_url ?? "", c.notas ?? ""), "Contrato cancelado.")}>Cancelar contrato</button>}
                {c.documento_url && <a href={c.documento_url} target="_blank" rel="noreferrer" className="text-xs text-lime">Ver documento</a>}
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
