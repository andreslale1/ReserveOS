"use client";

import { useState, useTransition } from "react";
import { marcarDevuelto, resolverReembolso } from "./actions";

export type Reembolso = { id: string; clienta: string; paquete: string; monto: number; motivo: string; estado: string; por_clienta: boolean; created_at: string; resuelto_at: string | null; nota: string | null; devuelto_at: string | null };
export type Transaccion = { id: string; created_at: string; clienta: string; concepto: string; monto: number; estado: string; proveedor: string; referencia: string | null };
const q = (n: number) => `Q${Number(n).toLocaleString("es-GT")}`;
const input = "rounded-lg border border-white/15 bg-cream px-3 py-1.5 text-sm text-ink outline-none focus:border-ink/30";
const EST: Record<string, string> = { solicitado: "Por resolver", aprobado: "Aprobado · falta devolver el dinero", rechazado: "Rechazado", devuelto: "Devuelto" };
const EST_TX: Record<string, string> = { iniciado: "Esperando pago", confirmado: "Pagado", rechazado: "Rechazado", reembolsado: "Reembolsado", revision: "En revisión (monto distinto)" };

export default function PagosView({ reembolsos, transacciones, puedeResolver }: { reembolsos: Reembolso[]; transacciones: Transaccion[]; puedeResolver: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [nota, setNota] = useState<Record<string, string>>({});
  const fecha = (s: string) => new Date(s).toLocaleDateString("es-GT", { timeZone: "America/Guatemala", day: "numeric", month: "short" });

  function correr(fn: () => Promise<{ error: string | null }>, ok: string) {
    setMsg(null);
    startTransition(async () => { const r = await fn(); setMsg(r.error ? { ok: false, texto: r.error } : { ok: true, texto: ok }); });
  }
  return (
    <main className="min-h-screen bg-cream">
      <header className="border-b border-white/10 bg-card px-6 py-6 md:px-10">
        <h1 className="font-serif text-2xl text-ink md:text-3xl">Pagos y reembolsos</h1>
        <p className="mt-1 text-sm text-ink/60">Lo cobrado en línea y las solicitudes de reembolso de tus clientas.</p>
      </header>
      <div className="mx-auto grid max-w-4xl gap-6 px-6 py-8 md:px-10">
        {msg && <p className={`rounded-xl px-4 py-3 text-sm ${msg.ok ? "bg-sage-tint text-sage" : "bg-peach-tint text-ink"}`}>{msg.texto}</p>}
        <section className="rounded-2xl border border-white/10 bg-card p-5">
          <h2 className="text-base font-semibold text-ink">Reembolsos</h2>
          <ul className="mt-3 divide-y divide-white/10">
            {reembolsos.length === 0 && <li className="py-3 text-sm text-ink/50">No hay solicitudes.</li>}
            {reembolsos.map((r) => (
              <li key={r.id} className="py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-ink"><strong>{r.clienta}</strong> · {r.paquete} · {q(r.monto)}<span className="block text-xs text-ink/55">{fecha(r.created_at)} · {r.por_clienta ? "pedido por la clienta" : "pedido por el personal"} · “{r.motivo}”</span></span>
                  <span className="text-xs text-ink/70">{EST[r.estado] ?? r.estado}</span>
                </div>
                {r.estado === "solicitado" && puedeResolver && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input className={`${input} w-56`} placeholder="Nota (obligatoria si rechazas)" value={nota[r.id] ?? ""} onChange={(e) => setNota({ ...nota, [r.id]: e.target.value })} />
                    <button className="press-spring rounded-full bg-ink px-3 py-1.5 text-xs font-medium text-cream" disabled={isPending} onClick={() => correr(() => resolverReembolso(r.id, true, nota[r.id] ?? ""), "Aprobado: la compra se anuló y las reservas futuras se cancelaron.")}>Aprobar</button>
                    <button className="rounded-full border border-white/20 px-3 py-1.5 text-xs text-ink" disabled={isPending} onClick={() => correr(() => resolverReembolso(r.id, false, nota[r.id] ?? ""), "Rechazado.")}>Rechazar</button>
                  </div>
                )}
                {r.estado === "aprobado" && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input className={`${input} w-56`} placeholder="Referencia de la devolución" value={nota[r.id] ?? ""} onChange={(e) => setNota({ ...nota, [r.id]: e.target.value })} />
                    <button className="rounded-full border border-white/20 px-3 py-1.5 text-xs text-ink" disabled={isPending} onClick={() => correr(() => marcarDevuelto(r.id, nota[r.id] ?? ""), "Marcado como devuelto.")}>Ya devolví el dinero</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-2xl border border-white/10 bg-card p-5">
          <h2 className="text-base font-semibold text-ink">Cobros en línea</h2>
          <ul className="mt-3 divide-y divide-white/10">
            {transacciones.length === 0 && <li className="py-3 text-sm text-ink/50">Aún no hay cobros en línea.</li>}
            {transacciones.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <span className="text-ink">{fecha(t.created_at)} · {t.clienta} · {t.concepto} · {q(t.monto)}</span>
                <span className={`text-xs ${t.estado === "revision" ? "text-ink font-medium" : "text-ink/60"}`}>{EST_TX[t.estado] ?? t.estado}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
