"use client";

import { useState, useTransition } from "react";
import { activarDominio, bajaDominio, comprobarDominio } from "./actions";

export type Dominio = {
  id: string; estudio: string; domain: string; verified: boolean; solicitado_at: string; verificado_at: string | null; slug: string; token_verificacion: string;
  dns_estado: string; dns_detalle: string | null; dns_comprobado_at: string | null; txt_estado: string; tls_estado: string; tls_detalle: string | null; tls_comprobado_at: string | null;
};

const fecha = (s: string | null) => (s ? new Date(s).toLocaleString("es-GT", { timeZone: "America/Guatemala", dateStyle: "short", timeStyle: "short" }) : "sin comprobar");
const COLOR: Record<string, string> = { ok: "text-lime", error: "text-red-300", pendiente: "text-yellow-300" };
const TXT: Record<string, string> = { ok: "Correcto", error: "Con error", pendiente: "Pendiente" };
const Paso = ({ nombre, estado, detalle }: { nombre: string; estado: string; detalle?: string | null }) => (
  <li className="flex flex-wrap items-baseline justify-between gap-2 py-1.5 text-xs">
    <span className="text-white/80">{nombre}</span>
    <span className={COLOR[estado] ?? ""}>{TXT[estado] ?? estado}{detalle ? <span className="ml-2 text-white/55">{detalle}</span> : null}</span>
  </li>
);

export default function DominiosView({ dominios }: { dominios: Dominio[] }) {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  function correr(fn: () => Promise<{ error: string | null }>, ok: string) {
    setMsg(null);
    startTransition(async () => { const r = await fn(); setMsg({ ok: !r.error, texto: r.error ?? ok }); });
  }
  async function copiar(t: string, k: string) {
    try { await navigator.clipboard.writeText(t); setCopiado(k); setTimeout(() => setCopiado(null), 2000); } catch { setMsg({ ok: false, texto: "No se pudo copiar; selecciónalo y cópialo a mano." }); }
  }
  const Copiar = ({ t, k }: { t: string; k: string }) => <button type="button" className="ml-2 rounded-full border border-white/20 px-2 py-0.5 text-[11px]" onClick={() => copiar(t, k)} aria-label={`Copiar ${t}`}>{copiado === k ? "Copiado" : "Copiar"}</button>;

  return (
    <main className="mx-auto max-w-4xl px-6 py-8 md:px-10">
      <h1 className="text-2xl font-semibold">Dominios de los estudios</h1>
      <p className="mt-1 text-sm text-white/60">Cada estudio puede usar su propio dominio (ej. reservas.suestudio.com). No se publica hasta que el DNS y el HTTPS estén comprobados.</p>
      <div role="status" aria-live="polite">{msg && <p className={`mt-4 rounded-xl px-4 py-3 text-sm ${msg.ok ? "bg-lime/15 text-lime" : "bg-red-500/15 text-red-200"}`}>{msg.texto}</p>}</div>
      <ul className="mt-6 grid gap-4">
        {dominios.length === 0 && <li className="text-sm text-white/60">Ningún estudio ha solicitado un dominio propio.</li>}
        {dominios.map((d) => {
          const listo = d.dns_estado === "ok" && d.tls_estado === "ok";
          const apex = d.domain.split(".").length <= 2;
          return (
            <li key={d.id} className="rounded-2xl border border-white/10 bg-void-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{d.domain}</p>
                  <p className="text-xs text-white/60">{d.estudio} · solicitado {new Date(d.solicitado_at).toLocaleDateString("es-GT")} · <span className={d.verified ? "text-lime" : "text-yellow-300"}>{d.verified ? `publicado ${fecha(d.verificado_at)}` : "sin publicar"}</span></p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="rounded-full border border-white/20 px-3 py-1.5 text-xs disabled:opacity-50" disabled={isPending} onClick={() => correr(async () => { const r = await comprobarDominio(d.id); return { error: r.error }; }, "Comprobación guardada.")}>{isPending ? "Comprobando…" : d.dns_comprobado_at ? "Comprobar de nuevo" : "Comprobar DNS y HTTPS"}</button>
                  {!d.verified ? (
                    <button className="rounded-full bg-lime px-3 py-1.5 text-xs font-semibold text-void disabled:opacity-40" disabled={isPending || !listo} title={listo ? "" : "Comprueba primero el DNS y el HTTPS"} onClick={() => correr(() => activarDominio(d.id, true), "Dominio publicado.")}>Publicar</button>
                  ) : (
                    <button className="rounded-full border border-white/20 px-3 py-1.5 text-xs" disabled={isPending} onClick={() => correr(() => activarDominio(d.id, false), "Dominio despublicado.")}>Despublicar</button>
                  )}
                  <button className="text-xs text-white/55 underline hover:text-white" disabled={isPending} onClick={() => { if (window.confirm(`¿Dar de baja ${d.domain}? El estudio perderá este dominio.`)) correr(() => bajaDominio(d.id), "Dominio dado de baja."); }}>Dar de baja</button>
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-white/50">1 · El estudio crea estos registros DNS</p>
                  <ul className="mt-2 space-y-2 text-xs">
                    <li className="rounded-lg bg-void px-3 py-2"><span className="text-white/55">{apex ? "A" : "CNAME"} · </span><code>{d.domain}</code><br />→ <code className="text-lime">{apex ? "76.76.21.21" : "cname.vercel-dns.com"}</code><Copiar t={apex ? "76.76.21.21" : "cname.vercel-dns.com"} k={`${d.id}-c`} /></li>
                    <li className="rounded-lg bg-void px-3 py-2"><span className="text-white/55">TXT (propiedad, recomendado) · </span><code>_reserveos.{d.domain}</code><br />→ <code className="break-all text-lime">reserveos-verify={d.token_verificacion}</code><Copiar t={`reserveos-verify=${d.token_verificacion}`} k={`${d.id}-t`} /></li>
                  </ul>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-white/50">2 · ReserveOS lo agrega al proyecto en Vercel</p>
                  <p className="mt-1 text-xs text-white/65">Desde la carpeta <code>web</code>: <code className="text-lime">vercel domains add {d.domain}</code><Copiar t={`vercel domains add ${d.domain}`} k={`${d.id}-v`} /></p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-white/50">3 · Estado verificado</p>
                  <ul className="mt-2 divide-y divide-white/10">
                    <Paso nombre="DNS apunta a ReserveOS" estado={d.dns_estado} detalle={d.dns_detalle} />
                    <Paso nombre="TXT de propiedad" estado={d.txt_estado} />
                    <Paso nombre="HTTPS válido y página del estudio" estado={d.tls_estado} detalle={d.tls_detalle} />
                  </ul>
                  <p className="mt-2 text-xs text-white/50">Última comprobación: {fecha(d.tls_comprobado_at ?? d.dns_comprobado_at)}. Los cambios de DNS pueden tardar en propagarse; reintenta en unos minutos.</p>
                  {d.verified && <p className="mt-2 text-xs"><a className="text-lime underline" href={`https://${d.domain}/e/${d.slug}`} target="_blank" rel="noreferrer">Abrir la página publicada ↗</a></p>}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
