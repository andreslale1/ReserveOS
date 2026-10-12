"use client";

import { useState, useTransition } from "react";
import { guardarGastoMarketing, guardarMeta } from "./actions";

const input = "mt-1 w-full rounded-lg border border-white/15 bg-cream px-3 py-2 text-ink outline-none focus:border-ink/30";
const boton = "press-spring rounded-full bg-ink px-4 py-2 text-sm font-medium text-cream disabled:opacity-50";

const NOMBRES: Record<string, string> = {
  ingresos: "Ingresos del mes (Q)",
  reservas: "Reservas del mes",
  clientas_nuevas: "Clientas nuevas",
  clientas_con_paquete: "Clientas con paquete activo",
};

export function MetasForm({ tenantId, mes, metas }: { tenantId: string; mes: string; metas: { tipo: string; meta: number | null }[] }) {
  const [isPending, startTransition] = useTransition();
  const [valores, setValores] = useState<Record<string, string>>(Object.fromEntries(metas.map((m) => [m.tipo, m.meta === null ? "" : String(m.meta)])));
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  function guardar(tipo: string) {
    const n = Number(valores[tipo]);
    if (!Number.isFinite(n) || n < 0 || valores[tipo] === "") { setMsg({ ok: false, texto: "Escribe un número válido para la meta." }); return; }
    setMsg(null);
    startTransition(async () => {
      const r = await guardarMeta(tenantId, mes, tipo, n);
      setMsg(r.error ? { ok: false, texto: r.error } : { ok: true, texto: "Meta guardada." });
    });
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-card p-5" aria-label="Definir metas del mes">
      <h3 className="text-base font-semibold text-ink">Metas de este mes</h3>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {metas.map((m) => (
          <div key={m.tipo} className="flex items-end gap-2">
            <label className="flex-1 text-sm text-ink-soft" htmlFor={`meta-${m.tipo}`}>
              {NOMBRES[m.tipo] ?? m.tipo}
              <input id={`meta-${m.tipo}`} inputMode="decimal" className={input} value={valores[m.tipo] ?? ""} onChange={(e) => setValores({ ...valores, [m.tipo]: e.target.value })} />
            </label>
            <button className={boton} disabled={isPending} onClick={() => guardar(m.tipo)}>Guardar</button>
          </div>
        ))}
      </div>
      {msg && <p role="status" className={`mt-3 text-sm ${msg.ok ? "text-sage" : "text-ink"}`}>{msg.texto}</p>}
    </section>
  );
}

export function GastoMarketingForm({ tenantId, mes }: { tenantId: string; mes: string }) {
  const [isPending, startTransition] = useTransition();
  const [canal, setCanal] = useState("");
  const [monto, setMonto] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  function guardar() {
    const n = Number(monto);
    if (!canal.trim()) { setMsg({ ok: false, texto: "Escribe el canal (por ejemplo, Instagram)." }); return; }
    if (!Number.isFinite(n) || n < 0 || monto === "") { setMsg({ ok: false, texto: "Escribe un monto válido." }); return; }
    setMsg(null);
    startTransition(async () => {
      const r = await guardarGastoMarketing(tenantId, mes, canal, n);
      if (r.error) setMsg({ ok: false, texto: r.error });
      else { setMsg({ ok: true, texto: "Gasto guardado: el CAC se recalcula." }); setCanal(""); setMonto(""); }
    });
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-card p-5" aria-label="Registrar gasto de marketing">
      <h3 className="text-base font-semibold text-ink">Gasto de marketing de este mes</h3>
      <p className="mt-1 text-xs text-ink-soft">El canal debe escribirse igual que «¿Cómo te enteraste?» de las clientas para que el CAC cuadre.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="text-sm text-ink-soft" htmlFor="gm-canal">Canal<input id="gm-canal" className={input} value={canal} onChange={(e) => setCanal(e.target.value)} /></label>
        <label className="text-sm text-ink-soft" htmlFor="gm-monto">Monto (Q)<input id="gm-monto" inputMode="decimal" className={input} value={monto} onChange={(e) => setMonto(e.target.value)} /></label>
        <button className={boton} disabled={isPending} onClick={guardar}>{isPending ? "Guardando…" : "Guardar"}</button>
      </div>
      {msg && <p role="status" className={`mt-3 text-sm ${msg.ok ? "text-sage" : "text-ink"}`}>{msg.texto}</p>}
    </section>
  );
}
