"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { eliminarCuenta, recordarConsentimientoClienta, reenviarAcceso } from "./cuenta-actions";
import { formatoFecha } from "@/lib/fechas";

export type Detalle = {
  reservas_total: number; asistidas: number; no_vino: number; canceladas: number; proximas: number; pct_asistencia: number | null;
  primera_visita: string | null; ultima_visita: string | null; gasto_total: number; dia_mas_concurrido: string | null;
  tiene_acceso: boolean; consentimiento_completado: boolean; cliente_desde: string;
};

const boton = "rounded-full border border-white/15 px-4 py-1.5 text-sm text-ink hover:bg-white/5 disabled:opacity-50";

function Dato({ t, v }: { t: string; v: string }) {
  return <div><p className="text-xs uppercase tracking-wide text-ink/45">{t}</p><p className="mt-1 text-lg font-semibold text-ink">{v}</p></div>;
}

export default function CuentaPanel({ clienteId, nombre, detalle, esDuena, esG }: { clienteId: string; nombre: string; detalle: Detalle | null; esDuena: boolean; esG: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [enlace, setEnlace] = useState<string | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const [confirmar, setConfirmar] = useState("");

  if (!detalle) return null;
  const abs = (r: string) => (typeof window === "undefined" ? r : `${window.location.origin}${r}`);

  return (
    <section className="rounded-2xl border border-white/10 bg-card p-5" aria-label="Detalle y cuenta">
      <h2 className="text-base font-semibold text-ink">Detalle de la clienta</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-4">
        <Dato t="Asistencia" v={detalle.pct_asistencia === null ? "—" : `${detalle.pct_asistencia}%`} />
        <Dato t="Clases asistidas" v={`${detalle.asistidas} de ${detalle.asistidas + detalle.no_vino}`} />
        <Dato t="Ha gastado" v={`Q${Number(detalle.gasto_total).toLocaleString("es-GT")}`} />
        <Dato t="Día más concurrido" v={detalle.dia_mas_concurrido ?? "—"} />
      </div>
      <p className="mt-3 text-xs text-ink/55">
        Clienta desde {formatoFecha(detalle.cliente_desde)} · primera visita {detalle.primera_visita ? formatoFecha(detalle.primera_visita) : "—"} · última {detalle.ultima_visita ? formatoFecha(detalle.ultima_visita) : "—"} · {detalle.proximas} reserva(s) próximas · {detalle.canceladas} cancelada(s)
      </p>

      {esG && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
          {!detalle.tiene_acceso && (
            <button className={boton} disabled={isPending} onClick={() => { setMsg(null); startTransition(async () => { const r = await reenviarAcceso(clienteId); if (r.error) setMsg({ ok: false, texto: r.error }); else { setEnlace(abs(r.enlace!)); setMsg({ ok: true, texto: "Enlace de acceso nuevo. El anterior ya no sirve." }); } }); }}>
              Generar enlace de acceso
            </button>
          )}
          {!detalle.consentimiento_completado && (
            <button className={boton} disabled={isPending} onClick={() => { setMsg(null); startTransition(async () => { const r = await recordarConsentimientoClienta(clienteId); setMsg(r.error ? { ok: false, texto: r.error } : { ok: true, texto: "Recordatorio en cola: sale con los demás mensajes." }); }); }}>
              Recordar consentimiento
            </button>
          )}
          {esDuena && <button className={boton} onClick={() => { setEliminando(!eliminando); setMsg(null); }}>Eliminar cuenta…</button>}
        </div>
      )}
      {enlace && (
        <p className="mt-3 break-all rounded-xl bg-cream p-3 text-xs text-ink">
          <span className="font-medium">Compártelo por WhatsApp:</span> {enlace}
          <button className="ml-2 underline" onClick={() => navigator.clipboard?.writeText(enlace)}>Copiar</button>
        </p>
      )}
      {eliminando && esDuena && (
        <div className="mt-4 rounded-xl border border-peach p-4" role="alertdialog" aria-label="Confirmar eliminación">
          <p className="text-sm text-ink">Se borra la ficha de <strong>{nombre}</strong> y su historial. Queda registrado quién lo hizo. Si tiene pagos confirmados, anúlalos antes.</p>
          <label className="mt-3 block text-sm text-ink/70" htmlFor="confirmar-nombre">Escribe el nombre exacto para confirmar
            <input id="confirmar-nombre" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} className="mt-1 w-full rounded-lg border border-white/15 bg-cream px-3 py-2 text-ink" />
          </label>
          <div className="mt-3 flex gap-2">
            <button className="rounded-full bg-ink px-4 py-1.5 text-sm text-cream disabled:opacity-50" disabled={isPending || confirmar.trim().toLowerCase() !== nombre.trim().toLowerCase()}
              onClick={() => startTransition(async () => { const r = await eliminarCuenta(clienteId, confirmar); if (r.error) setMsg({ ok: false, texto: r.error }); else router.push("/panel/clientes"); })}>
              {isPending ? "Eliminando…" : "Eliminar definitivamente"}
            </button>
            <button className={boton} onClick={() => setEliminando(false)}>Cancelar</button>
          </div>
        </div>
      )}
      {msg && <p role="status" className={`mt-3 rounded-xl px-4 py-2 text-sm ${msg.ok ? "bg-sage-tint text-sage" : "bg-peach-tint text-ink"}`}>{msg.texto}</p>}
    </section>
  );
}
