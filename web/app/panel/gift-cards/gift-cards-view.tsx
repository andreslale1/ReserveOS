"use client";

import { useState, useTransition } from "react";
import { anularGiftCard, venderGiftCard } from "./actions";

export type Gift = { id: string; codigo: string; paquete: string; comprador: string | null; destinatario: string; email: string | null; estado: string; vence: string; created_at: string; canjeada_at: string | null };
const input = "mt-1 w-full rounded-lg border border-white/15 bg-cream px-3 py-2 text-ink outline-none focus:border-ink/30";
const EST: Record<string, string> = { activa: "Activa", canjeada: "Canjeada", cancelada: "Anulada", vencida: "Vencida" };

export default function GiftCardsView({ tenantId, sedes, paquetes, gifts, puedeAnular }: { tenantId: string; sedes: { id: string; name: string }[]; paquetes: { id: string; nombre: string; precio: number }[]; gifts: Gift[]; puedeAnular: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [f, setF] = useState({ sedeId: sedes[0]?.id ?? "", paqueteId: "", comprador: "", destinatario: "", email: "", metodo: "efectivo" });
  const [anulando, setAnulando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const fecha = (s: string) => new Date(s + (s.length === 10 ? "T00:00:00" : "")).toLocaleDateString("es-GT", { day: "numeric", month: "short", year: "numeric" });

  return (
    <main className="min-h-screen bg-cream">
      <header className="border-b border-white/10 bg-card px-6 py-6 md:px-10">
        <h1 className="font-serif text-2xl text-ink md:text-3xl">Gift cards</h1>
        <p className="mt-1 text-sm text-ink/60">Vende un paquete como regalo. La venta entra a la caja de la sede y la tarjeta vence a los 12 meses.</p>
      </header>
      <div className="mx-auto grid max-w-4xl gap-6 px-6 py-8 md:px-10">
        {msg && <p className={`rounded-xl px-4 py-3 text-sm ${msg.ok ? "bg-sage-tint text-sage" : "bg-peach-tint text-ink"}`}>{msg.texto}</p>}
        <section className="rounded-2xl border border-white/10 bg-card p-5">
          <h2 className="text-base font-semibold text-ink">Vender una gift card</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-ink/60">Paquete<select className={input} value={f.paqueteId} onChange={(e) => setF({ ...f, paqueteId: e.target.value })}><option value="">Elige…</option>{paquetes.map((p) => <option key={p.id} value={p.id}>{p.nombre} · Q{p.precio.toLocaleString("es-GT")}</option>)}</select></label>
            <label className="text-sm text-ink/60">Sede donde se cobra<select className={input} value={f.sedeId} onChange={(e) => setF({ ...f, sedeId: e.target.value })}>{sedes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
            <label className="text-sm text-ink/60">Quién compra<input className={input} value={f.comprador} onChange={(e) => setF({ ...f, comprador: e.target.value })} /></label>
            <label className="text-sm text-ink/60">Para quién es<input className={input} value={f.destinatario} onChange={(e) => setF({ ...f, destinatario: e.target.value })} /></label>
            <label className="text-sm text-ink/60">Correo de quien la recibe (opcional)<input className={input} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
            <label className="text-sm text-ink/60">Forma de pago<select className={input} value={f.metodo} onChange={(e) => setF({ ...f, metodo: e.target.value })}><option value="efectivo">Efectivo</option><option value="tarjeta_estudio">Tarjeta (en el estudio)</option><option value="transferencia">Transferencia</option></select></label>
          </div>
          <button className="press-spring mt-4 rounded-full bg-ink px-4 py-2 text-sm font-medium text-cream disabled:opacity-50" disabled={isPending || !f.paqueteId || f.destinatario.trim().length < 2}
            onClick={() => { setMsg(null); startTransition(async () => { const r = await venderGiftCard({ tenantId, ...f }); setMsg(r.error ? { ok: false, texto: r.error } : { ok: true, texto: `Gift card creada: ${r.codigo}. Entrégala o envíale el código a quien la recibe.` }); if (!r.error) setF({ ...f, comprador: "", destinatario: "", email: "" }); }); }}>Vender y generar código</button>
        </section>
        <section className="rounded-2xl border border-white/10 bg-card p-5">
          <h2 className="text-base font-semibold text-ink">Tarjetas</h2>
          <ul className="mt-3 divide-y divide-white/10">
            {gifts.length === 0 && <li className="py-3 text-sm text-ink/50">Aún no has vendido gift cards.</li>}
            {gifts.map((g) => (
              <li key={g.id} className="py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-ink"><strong className="font-mono">{g.codigo}</strong> · {g.paquete} · para {g.destinatario}<span className="block text-xs text-ink/55">{EST[g.estado] ?? g.estado} · {g.estado === "canjeada" && g.canjeada_at ? `canjeada ${fecha(g.canjeada_at)}` : `vence ${fecha(g.vence)}`}{g.comprador ? ` · compró ${g.comprador}` : ""}</span></span>
                  {puedeAnular && g.estado === "activa" && <button className="text-xs text-ink/55 hover:text-ink" onClick={() => setAnulando(anulando === g.id ? null : g.id)}>Anular</button>}
                </div>
                {anulando === g.id && (
                  <div className="mt-2 flex gap-2">
                    <input className={`${input} mt-0 flex-1`} placeholder="Motivo de la anulación" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                    <button className="rounded-full border border-white/20 px-3 py-1.5 text-xs text-ink disabled:opacity-50" disabled={isPending || motivo.trim().length < 3}
                      onClick={() => { setMsg(null); startTransition(async () => { const r = await anularGiftCard(g.id, motivo); setMsg(r.error ? { ok: false, texto: r.error } : { ok: true, texto: "Tarjeta anulada. Recuerda devolver el dinero si corresponde." }); setAnulando(null); setMotivo(""); }); }}>Confirmar</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
