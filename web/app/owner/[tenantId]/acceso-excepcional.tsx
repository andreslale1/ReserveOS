"use client";

import { useState, useTransition } from "react";
import { leerDatosSensibles, otorgarAcceso, revocarAcceso } from "./actions";

type Acceso = { id: string; ticket_id: string; otorgado_nombre: string | null; motivo: string; alcance: string[]; expira_at: string; revocado_at: string | null; vigente: boolean; mio: boolean; created_at: string };
type Ticket = { id: string; asunto: string; estado: string; prioridad: string };
type Clienta = { id: string; nombre: string; telefono: string; email: string | null; tiene_acceso: boolean };

const fmt = (n: number) => `Q${Number(n ?? 0).toLocaleString("es-GT", { maximumFractionDigits: 0 })}`;
const fechaHora = (iso: string) => new Date(iso).toLocaleString("es-GT", { timeZone: "America/Guatemala", dateStyle: "short", timeStyle: "short" });
const input = "mt-1 w-full rounded-lg border border-white/15 bg-void px-3 py-2 text-sm text-white outline-none focus:border-lime/50";

export default function AccesoExcepcional({ tenantId, accesos, tickets, puedeOtorgar }: { tenantId: string; accesos: Acceso[]; tickets: Ticket[]; puedeOtorgar: boolean }) {
  const [ticket, setTicket] = useState("");
  const [motivo, setMotivo] = useState("");
  const [alcance, setAlcance] = useState<string[]>(["clientas"]);
  const [horas, setHoras] = useState(4);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [clientas, setClientas] = useState<{ total: number; filas: Clienta[] } | null>(null);
  const [fin, setFin] = useState<{ ingreso_mes: number; gastos_mes: number } | null>(null);

  const vigentes = accesos.filter((a) => a.vigente && a.mio);
  const tiene = (a: string) => vigentes.some((v) => v.alcance.includes(a));

  function otorgar() {
    setError(null);
    startTransition(async () => {
      const r = await otorgarAcceso(tenantId, ticket, motivo.trim(), alcance, horas);
      if (r.error) setError(r.error);
      else { setMotivo(""); setTicket(""); }
    });
  }
  function leer(a: "clientas" | "finanzas") {
    setError(null);
    startTransition(async () => {
      const r = await leerDatosSensibles(tenantId, a);
      if (r.error) return setError(r.error);
      if (a === "clientas") setClientas({ total: (r.data as { total: number }).total, filas: (r.data as { clientas: Clienta[] }).clientas });
      else setFin(r.data as { ingreso_mes: number; gastos_mes: number });
    });
  }

  return (
    <section className="mt-10 rounded-2xl border border-white/10 bg-void-card p-5">
      <h2 className="text-sm font-medium uppercase tracking-wide text-white/40">Datos sensibles del estudio (acceso excepcional)</h2>
      <p className="mt-2 text-xs text-white/50">
        Los datos de clientas y las finanzas del estudio no se muestran de forma rutinaria. Para verlos se necesita un ticket abierto, un motivo y un plazo; cada acceso y cada lectura queda registrado y la dueña del estudio puede verlo.
      </p>
      {error && <p role="alert" className="mt-3 rounded-lg bg-red-500/15 px-3 py-2 text-xs text-red-300">{error}</p>}

      {puedeOtorgar && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-white/60 sm:col-span-2">Ticket que lo justifica
            <select value={ticket} onChange={(e) => setTicket(e.target.value)} className={input}>
              <option value="">{tickets.length ? "Elegir ticket abierto…" : "Este estudio no tiene tickets abiertos"}</option>
              {tickets.map((t) => <option key={t.id} value={t.id}>{t.asunto} ({t.prioridad})</option>)}
            </select>
          </label>
          <label className="text-xs text-white/60 sm:col-span-2">Motivo (mínimo 15 caracteres)
            <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} className={input} />
          </label>
          <fieldset className="text-xs text-white/60">
            <legend>Alcance</legend>
            {["clientas", "finanzas"].map((a) => (
              <label key={a} className="mr-4 mt-1 inline-flex items-center gap-1">
                <input type="checkbox" checked={alcance.includes(a)} onChange={(e) => setAlcance(e.target.checked ? [...alcance, a] : alcance.filter((x) => x !== a))} /> {a}
              </label>
            ))}
          </fieldset>
          <label className="text-xs text-white/60">Duración (horas, máx. 72)
            <input type="number" min={1} max={72} value={horas} onChange={(e) => setHoras(Number(e.target.value))} className={input} />
          </label>
          <div className="sm:col-span-2">
            <button onClick={otorgar} disabled={isPending || !ticket || motivo.trim().length < 15 || alcance.length === 0} className="press-spring rounded-full bg-white px-5 py-2 text-sm font-bold text-void disabled:opacity-50">
              {isPending ? "Procesando…" : "Solicitar acceso excepcional"}
            </button>
          </div>
        </div>
      )}

      {vigentes.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {tiene("clientas") && <button onClick={() => leer("clientas")} disabled={isPending} className="rounded-full border border-white/15 px-4 py-1.5 text-xs text-white hover:bg-white/10 disabled:opacity-50">Ver clientas</button>}
          {tiene("finanzas") && <button onClick={() => leer("finanzas")} disabled={isPending} className="rounded-full border border-white/15 px-4 py-1.5 text-xs text-white hover:bg-white/10 disabled:opacity-50">Ver finanzas del mes</button>}
        </div>
      )}
      {fin && <p className="mt-3 text-sm text-white">Ingreso del mes {fmt(fin.ingreso_mes)} · Gastos del mes {fmt(fin.gastos_mes)}</p>}
      {clientas && (
        <div className="mt-3">
          <p className="text-xs text-white/50">Mostrando {clientas.filas.length} de {clientas.total}</p>
          <ul className="mt-2 space-y-1">
            {clientas.filas.map((c) => (
              <li key={c.id} className="flex justify-between rounded-lg border border-white/5 px-3 py-1.5 text-xs text-white">
                <span>{c.nombre} <span className="text-white/40">{c.telefono}</span></span>
                <span className="text-white/50">{c.tiene_acceso ? "con acceso" : "sin acceso"}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <h3 className="mt-6 text-xs font-medium uppercase tracking-wide text-white/40">Historial de accesos</h3>
      <ul className="mt-2 space-y-1.5">
        {accesos.length === 0 && <li className="text-xs text-white/40">Nunca se han solicitado accesos excepcionales.</li>}
        {accesos.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/5 px-3 py-2 text-xs">
            <span className="text-white/80">
              {a.otorgado_nombre ?? "—"} · {a.alcance.join(", ")} · {fechaHora(a.created_at)} — {a.motivo}
            </span>
            <span className="flex items-center gap-2 text-white/50">
              {a.revocado_at ? "revocado" : a.vigente ? `vigente hasta ${fechaHora(a.expira_at)}` : "caducado"}
              {a.vigente && puedeOtorgar && (
                <button onClick={() => startTransition(async () => { const r = await revocarAcceso(tenantId, a.id); if (r.error) setError(r.error); })} className="rounded-full border border-white/15 px-2 py-0.5 hover:text-white">Revocar</button>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
