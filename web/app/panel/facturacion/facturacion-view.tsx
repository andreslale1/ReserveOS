"use client";

import { useState, useTransition } from "react";
import { anularFactura, guardarConfigFiscal, marcarEmitida, solicitarFactura } from "./actions";

export type Config = { nit_emisor: string; razon_social: string; nombre_comercial: string | null; direccion_fiscal: string; regimen: string; serie: string | null };
export type Venta = { origen_tipo: string; origen_id: string; fecha: string; sede: string | null; cliente: string; concepto: string; monto: number };
export type Doc = { id: string; created_at: string; sede: string | null; concepto: string; nit_receptor: string; nombre_receptor: string; monto: number; iva: number; estado: string; serie: string | null; numero: string | null; error: string | null; motivo_anulacion: string | null };
const q = (n: number) => `Q${Number(n).toLocaleString("es-GT", { minimumFractionDigits: 2 })}`;
const input = "mt-1 w-full rounded-lg border border-white/15 bg-cream px-3 py-2 text-ink outline-none focus:border-ink/30";
const EST: Record<string, string> = { pendiente: "Por emitir", enviando: "Enviando…", emitido: "Emitida", error: "Con error", anulacion_pendiente: "Anular (hubo devolución)", anulado: "Anulada" };

export default function FacturacionView({ tenantId, config, ventas, docs, puedeConfigurar, puedeAnular }: { tenantId: string; config: Config | null; ventas: Venta[]; docs: Doc[]; puedeConfigurar: boolean; puedeAnular: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [c, setC] = useState({ nit: config?.nit_emisor ?? "", razon: config?.razon_social ?? "", comercial: config?.nombre_comercial ?? "", direccion: config?.direccion_fiscal ?? "", regimen: config?.regimen ?? "general", serie: config?.serie ?? "" });
  const [abierto, setAbierto] = useState(!config);
  const [fv, setFv] = useState<Record<string, { nit: string; nombre: string }>>({});
  const [em, setEm] = useState<Record<string, { serie: string; numero: string }>>({});
  const [an, setAn] = useState<Record<string, string>>({});
  const pend = docs.filter((d) => ["pendiente", "error", "anulacion_pendiente"].includes(d.estado));

  function correr(fn: () => Promise<{ error: string | null }>, ok: string, despues?: () => void) {
    setMsg(null);
    startTransition(async () => { const r = await fn(); if (r.error) setMsg({ ok: false, texto: r.error }); else { setMsg({ ok: true, texto: ok }); despues?.(); } });
  }
  return (
    <main className="min-h-screen bg-cream">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-card px-6 py-6 md:px-10">
        <div><h1 className="font-serif text-2xl text-ink md:text-3xl">Facturación</h1><p className="mt-1 text-sm text-ink/60">Una factura por cada venta, con el IVA desglosado. Si una compra se devuelve, su factura queda marcada para anular.</p></div>
        {puedeConfigurar && <a href="/panel/facturacion/export" className="rounded-full border border-white/15 px-4 py-2 text-sm text-ink/70 hover:text-ink">Exportar a CSV</a>}
      </header>
      <div className="mx-auto grid max-w-5xl gap-6 px-6 py-8 md:px-10">
        {msg && <p className={`rounded-xl px-4 py-3 text-sm ${msg.ok ? "bg-sage-tint text-sage" : "bg-peach-tint text-ink"}`}>{msg.texto}</p>}
        {!config && <p className="rounded-xl bg-peach-tint px-4 py-3 text-sm text-ink">Antes de facturar, registra los datos fiscales de tu estudio.</p>}
        <section className="rounded-2xl border border-white/10 bg-card p-5">
          <div className="flex items-center justify-between"><h2 className="text-base font-semibold text-ink">Datos del emisor</h2>{config && <button className="text-xs text-ink/55 hover:text-ink" onClick={() => setAbierto(!abierto)}>{abierto ? "Cerrar" : "Editar"}</button>}</div>
          {config && !abierto && <p className="mt-2 text-sm text-ink/70">{config.razon_social} · NIT {config.nit_emisor} · {config.regimen === "general" ? "Régimen general (IVA 12%)" : "Pequeño contribuyente"}</p>}
          {abierto && (
            <>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-sm text-ink/60">NIT del estudio<input className={input} value={c.nit} onChange={(e) => setC({ ...c, nit: e.target.value })} /></label>
                <label className="text-sm text-ink/60">Razón social<input className={input} value={c.razon} onChange={(e) => setC({ ...c, razon: e.target.value })} /></label>
                <label className="text-sm text-ink/60">Nombre comercial<input className={input} value={c.comercial} onChange={(e) => setC({ ...c, comercial: e.target.value })} /></label>
                <label className="text-sm text-ink/60">Serie (opcional)<input className={input} value={c.serie} onChange={(e) => setC({ ...c, serie: e.target.value })} /></label>
                <label className="text-sm text-ink/60 sm:col-span-2">Dirección fiscal<input className={input} value={c.direccion} onChange={(e) => setC({ ...c, direccion: e.target.value })} /></label>
                <label className="text-sm text-ink/60">Régimen<select className={input} value={c.regimen} onChange={(e) => setC({ ...c, regimen: e.target.value })}><option value="general">General (IVA 12% incluido)</option><option value="pequeno_contribuyente">Pequeño contribuyente</option></select></label>
              </div>
              {puedeConfigurar ? <button className="press-spring mt-4 rounded-full bg-ink px-4 py-2 text-sm font-medium text-cream disabled:opacity-50" disabled={isPending} onClick={() => correr(() => guardarConfigFiscal(tenantId, c), "Datos fiscales guardados.", () => setAbierto(false))}>Guardar</button> : <p className="mt-3 text-xs text-ink/55">Solo la dueña, gerencia o contabilidad edita estos datos.</p>}
            </>
          )}
        </section>

        <section className="rounded-2xl border border-white/10 bg-card p-5">
          <h2 className="text-base font-semibold text-ink">Ventas sin factura <span className="text-sm font-normal text-ink/50">(últimos 60 días)</span></h2>
          <ul className="mt-3 divide-y divide-white/10">
            {ventas.length === 0 && <li className="py-3 text-sm text-ink/50">Todo está facturado.</li>}
            {ventas.map((v) => {
              const k = `${v.origen_tipo}:${v.origen_id}`; const f = fv[k] ?? { nit: "", nombre: "" };
              return (
                <li key={k} className="py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-ink">{v.fecha} · {v.cliente} · {v.concepto}{v.sede ? ` · ${v.sede}` : ""}</span><strong className="text-ink">{q(v.monto)}</strong></div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input className={`${input} mt-0 w-36`} placeholder="NIT (vacío = CF)" value={f.nit} onChange={(e) => setFv({ ...fv, [k]: { ...f, nit: e.target.value } })} />
                    <input className={`${input} mt-0 w-56`} placeholder="Nombre en la factura" value={f.nombre} onChange={(e) => setFv({ ...fv, [k]: { ...f, nombre: e.target.value } })} />
                    <button className="rounded-full border border-white/20 px-3 py-1.5 text-xs text-ink disabled:opacity-50" disabled={isPending || !config} onClick={() => correr(() => solicitarFactura(tenantId, v.origen_tipo, v.origen_id, f.nit, f.nombre, ""), "Factura generada: queda por emitir.")}>Generar factura</button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="rounded-2xl border border-white/10 bg-card p-5">
          <h2 className="text-base font-semibold text-ink">Facturas</h2>
          <p className="mt-1 text-xs text-ink/55">Mientras no haya un certificador conectado, emite cada factura en tu sistema de facturación (SAT/certificador) y registra aquí su serie y número.</p>
          <ul className="mt-3 divide-y divide-white/10">
            {docs.length === 0 && <li className="py-3 text-sm text-ink/50">Aún no hay facturas.</li>}
            {docs.map((d) => (
              <li key={d.id} className="py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-ink">{new Date(d.created_at).toLocaleDateString("es-GT", { timeZone: "America/Guatemala", day: "numeric", month: "short" })} · {d.nombre_receptor} ({d.nit_receptor}) · {d.concepto}<span className="block text-xs text-ink/55">{q(d.monto)} · IVA {q(d.iva)}{d.numero ? ` · ${d.serie ?? ""} ${d.numero}` : ""}{d.error ? ` · ${d.error}` : ""}{d.motivo_anulacion ? ` · ${d.motivo_anulacion}` : ""}</span></span>
                  <span className={`text-xs ${d.estado === "anulacion_pendiente" || d.estado === "error" ? "font-medium text-ink" : "text-ink/60"}`}>{EST[d.estado] ?? d.estado}</span>
                </div>
                {["pendiente", "error"].includes(d.estado) && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input className={`${input} mt-0 w-20`} placeholder="Serie" value={em[d.id]?.serie ?? ""} onChange={(e) => setEm({ ...em, [d.id]: { serie: e.target.value, numero: em[d.id]?.numero ?? "" } })} />
                    <input className={`${input} mt-0 w-36`} placeholder="Número" value={em[d.id]?.numero ?? ""} onChange={(e) => setEm({ ...em, [d.id]: { serie: em[d.id]?.serie ?? "", numero: e.target.value } })} />
                    <button className="press-spring rounded-full bg-ink px-3 py-1.5 text-xs font-medium text-cream disabled:opacity-50" disabled={isPending || !(em[d.id]?.numero ?? "").trim()} onClick={() => correr(() => marcarEmitida(d.id, em[d.id]?.serie ?? "", em[d.id]?.numero ?? "", ""), "Factura registrada como emitida.")}>Ya la emití</button>
                  </div>
                )}
                {puedeAnular && ["anulacion_pendiente", "emitido"].includes(d.estado) && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input className={`${input} mt-0 w-64`} placeholder="Motivo de la anulación" value={an[d.id] ?? ""} onChange={(e) => setAn({ ...an, [d.id]: e.target.value })} />
                    <button className="rounded-full border border-white/20 px-3 py-1.5 text-xs text-ink disabled:opacity-50" disabled={isPending || (an[d.id] ?? "").trim().length < 3} onClick={() => correr(() => anularFactura(d.id, an[d.id] ?? ""), "Factura marcada como anulada.")}>Ya la anulé</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          {pend.length > 0 && <p className="mt-3 text-xs text-ink/60">{pend.length} factura(s) requieren tu atención.</p>}
        </section>
      </div>
    </main>
  );
}
