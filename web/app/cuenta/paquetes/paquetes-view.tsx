"use client";

import { useState, useTransition } from "react";
import { solicitarPaquete } from "./actions";

export type Paquete = { id: string; nombre: string; descripcion: string | null; num_clases: number | null; precio: number; vigencia_dias: number; cobertura: string; sedes: string | null };
export type Transferencia = { banco: string; tipo_cuenta: string; numero_cuenta: string; titular: string };
type Mio = { id: string; paquete: string; estado: string; totales: number | null; usadas: number; vence: string; congelada: boolean; sedes: string | null };
const q = (n: number) => `Q${Number(n).toLocaleString("es-GT")}`;
const input = "mt-1 w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-ink outline-none focus:border-ink/40";

export default function PaquetesView({ catalogo, transferencia, mios }: { catalogo: Paquete[]; transferencia: Transferencia | null; mios: Mio[] }) {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [elegido, setElegido] = useState<string | null>(null);
  const [ref, setRef] = useState("");
  const [codigo, setCodigo] = useState("");
  const fmt = (f: string) => new Date(f + "T00:00:00").toLocaleDateString("es-GT", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="grid gap-5">
      <h1 className="font-serif text-2xl text-ink">Paquetes</h1>
      {msg && <p className={`rounded-xl px-4 py-3 text-sm ${msg.ok ? "bg-sage-tint text-sage" : "bg-peach-tint text-ink"}`}>{msg.texto}</p>}

      {mios.length > 0 && (
        <section className="rounded-2xl border border-black/10 bg-white p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink/50">Mis paquetes</h2>
          <ul className="mt-2 divide-y divide-black/5">
            {mios.map((p) => (
              <li key={p.id} className="py-3 text-sm">
                <p className="font-medium text-ink">{p.paquete} <span className="text-xs font-normal text-ink/50">· {p.estado === "pendiente_pago" ? "pago pendiente de confirmar" : p.congelada ? "congelado" : "activo"}</span></p>
                <p className="text-ink/65">{p.totales === null ? "Clases ilimitadas" : `${p.totales - p.usadas} de ${p.totales} clases disponibles`} · vence {fmt(p.vence)}</p>
                {p.sedes && <p className="text-xs text-ink/45">Válido en: {p.sedes}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink/50">Comprar un paquete</h2>
        {catalogo.length === 0 && <p className="text-sm text-ink/60">El estudio aún no publica paquetes.</p>}
        {catalogo.map((p) => (
          <div key={p.id} className="rounded-2xl border border-black/10 bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-ink">{p.nombre}</p>
                <p className="text-sm text-ink/65">{p.num_clases === null ? "Clases ilimitadas" : `${p.num_clases} clases`} · {p.vigencia_dias} días</p>
                <p className="text-xs text-ink/50">Válido en: {p.sedes ?? "sede donde lo compras"}</p>
                {p.descripcion && <p className="mt-1 text-sm text-ink/70">{p.descripcion}</p>}
              </div>
              <div className="text-right">
                <p className="text-xl font-semibold text-ink">{q(p.precio)}</p>
                <button className="mt-2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-cream" onClick={() => { setElegido(elegido === p.id ? null : p.id); setMsg(null); }}>{elegido === p.id ? "Cerrar" : "Comprar"}</button>
              </div>
            </div>
            {elegido === p.id && (
              <div className="mt-4 border-t border-black/10 pt-4">
                {transferencia ? (
                  <div className="rounded-xl bg-cream p-4 text-sm text-ink">
                    <p className="font-medium">1. Haz una transferencia por {q(p.precio)}</p>
                    <p className="mt-1">{transferencia.banco} · {transferencia.tipo_cuenta}</p>
                    <p>Cuenta <strong>{transferencia.numero_cuenta}</strong> a nombre de {transferencia.titular}</p>
                  </div>
                ) : (
                  <p className="rounded-xl bg-peach-tint p-3 text-sm text-ink">Este estudio aún no publicó sus datos de transferencia. Pregunta en recepción cómo pagar.</p>
                )}
                <label className="mt-3 block text-sm text-ink/70">2. Número de referencia o boleta de la transferencia<input className={input} value={ref} onChange={(e) => setRef(e.target.value)} /></label>
                <label className="mt-3 block text-sm text-ink/70">Código de descuento (si tienes)<input className={input} value={codigo} onChange={(e) => setCodigo(e.target.value)} /></label>
                <button className="mt-4 w-full rounded-full bg-ink px-4 py-3 text-sm font-medium text-cream disabled:opacity-50" disabled={isPending || ref.trim().length < 3}
                  onClick={() => { setMsg(null); startTransition(async () => { const r = await solicitarPaquete(p.id, ref, codigo); if (r.error) setMsg({ ok: false, texto: r.error }); else { setMsg({ ok: true, texto: "¡Recibimos tu solicitud! El estudio confirmará tu pago y te avisaremos." }); setElegido(null); setRef(""); setCodigo(""); } }); }}>
                  Ya pagué, enviar solicitud
                </button>
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
