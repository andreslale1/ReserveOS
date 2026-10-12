"use client";

import { useState, useTransition } from "react";
import { configurarAutomatizacion, verificarSaludAhora } from "./actions";

type Automatizacion = {
  clave: string; nombre: string; descripcion: string; frecuencia: string; modulo: string | null; modulo_activo: boolean; toggleable: boolean;
  audiencia: "clienta" | "equipo" | "sistema"; activa: boolean; ultima_ejecucion: string | null; ultimo_estado: string | null; encolados_7d: number; ultimo_encolado: string | null;
};
type Ejecucion = { clave: string; nombre: string; ejecutado_at: string; estado: string; encolados: number };
type Salud = { fecha_local: string; ejecutado_at: string; problemas: number; resultados: Record<string, { n: number }> } | null;
export type Panel = { automatizaciones: Automatizacion[]; ejecuciones: Ejecucion[]; salud: Salud; cola: { pendientes: number; enviados: number } };

const ETIQUETA_SALUD: Record<string, string> = {
  reservas_duplicadas: "Reservas duplicadas",
  reservas_fecha_invalida: "Reservas con fecha inválida",
  membresias_excedidas: "Paquetes con más clases usadas que las que tienen",
  inventario_negativo: "Inventario negativo",
  pagos_sin_resolver: "Pagos en línea sin resolver (más de 24 h)",
  cupos_excedidos: "Clases con más reservas que cupo",
};
const AUDIENCIA = { clienta: "Para clientas", equipo: "Para el equipo", sistema: "Interna" } as const;

const fechaHora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("es-GT", { timeZone: "America/Guatemala", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "todavía no";

export default function AutomatizacionesView({ tenantId, panel }: { tenantId: string; panel: Panel }) {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [enCurso, setEnCurso] = useState<string | null>(null);

  function correr(clave: string, fn: () => Promise<{ error: string | null }>, ok: string) {
    setMsg(null);
    setEnCurso(clave);
    startTransition(async () => {
      const r = await fn();
      setMsg(r.error ? { ok: false, texto: r.error } : { ok: true, texto: ok });
      setEnCurso(null);
    });
  }

  const { automatizaciones, ejecuciones, salud, cola } = panel;
  const problemas = salud ? Object.entries(salud.resultados).filter(([, v]) => v.n > 0) : [];

  return (
    <main className="min-h-screen bg-cream">
      <header className="border-b border-white/10 bg-card px-6 py-6 md:px-10">
        <h1 className="text-2xl font-semibold text-ink md:text-3xl">Automatizaciones</h1>
        <p className="mt-1 text-sm text-ink-soft">Lo que el sistema hace solo, a la hora de cada sede. Puedes apagar las que no quieras.</p>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8 md:px-10">
        <p className="rounded-2xl border border-white/10 bg-card px-4 py-3 text-sm text-ink-soft" role="status">
          Los mensajes se preparan y quedan en una cola ({cola.pendientes} esperando, {cola.enviados} enviados). El envío real empieza cuando se conecte el correo, WhatsApp o las
          notificaciones de tu estudio.
        </p>

        {msg && (
          <p role="alert" className={`mt-4 rounded-xl px-4 py-3 text-sm ${msg.ok ? "bg-sage-tint text-sage" : "bg-peach-tint text-ink"}`}>{msg.texto}</p>
        )}

        <section className="mt-6 rounded-2xl border border-white/10 bg-card p-5" aria-labelledby="salud-titulo">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="salud-titulo" className="text-base font-semibold text-ink">Salud del sistema</h2>
              <p className="mt-1 text-xs text-ink-soft">
                {salud ? `Última revisión: ${fechaHora(salud.ejecutado_at)} · ${salud.problemas === 0 ? "todo en orden" : `${salud.problemas} cosa(s) por revisar`}` : "Todavía no se ha revisado. Se hace sola cada mañana a las 8."}
              </p>
            </div>
            <button
              className="press-spring rounded-full bg-ink px-4 py-2 text-sm font-medium text-cream disabled:opacity-50"
              disabled={isPending}
              onClick={() => correr("salud", () => verificarSaludAhora(tenantId), "Revisión terminada.")}
            >
              {isPending && enCurso === "salud" ? "Revisando…" : "Verificar ahora"}
            </button>
          </div>
          {problemas.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm text-ink">
              {problemas.map(([k, v]) => (
                <li key={k} className="rounded-lg bg-peach-tint px-3 py-2">{ETIQUETA_SALUD[k] ?? k}: <strong>{v.n}</strong></li>
              ))}
            </ul>
          )}
        </section>

        <h2 className="mt-8 text-sm font-medium uppercase tracking-wide text-ink-soft">Automatizaciones</h2>
        <ul className="mt-4 space-y-3">
          {automatizaciones.map((a) => {
            const disponible = a.modulo_activo;
            const estado = !disponible ? "Módulo no contratado" : a.activa ? "Activa" : "Apagada";
            return (
              <li key={a.clave} className="rounded-2xl border border-white/10 bg-card p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{a.nombre}</p>
                    <p className="mt-1 text-xs text-ink-soft">{a.descripcion}</p>
                    <p className="mt-2 text-xs text-ink-soft">
                      {AUDIENCIA[a.audiencia]} · {a.frecuencia} · última revisión: {fechaHora(a.ultima_ejecucion)}
                      {a.ultimo_estado === "error" && <span className="ml-1 font-medium text-ink"> · con error, avisa a soporte</span>}
                    </p>
                    <p className="mt-1 text-xs text-ink-soft">
                      Mensajes preparados (7 días): <strong className="text-ink">{a.encolados_7d}</strong>
                      {a.ultimo_encolado ? ` · último: ${fechaHora(a.ultimo_encolado)}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${estado === "Activa" ? "bg-sage-tint text-sage" : "bg-neutral-tint text-ink-soft"}`}>{estado}</span>
                    {a.toggleable && disponible ? (
                      <button
                        role="switch"
                        aria-checked={a.activa}
                        aria-label={`${a.activa ? "Apagar" : "Encender"} ${a.nombre}`}
                        disabled={isPending}
                        onClick={() => correr(a.clave, () => configurarAutomatizacion(tenantId, a.clave, !a.activa), a.activa ? "Automatización apagada." : "Automatización encendida.")}
                        className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-ink-soft hover:text-ink disabled:opacity-50"
                      >
                        {isPending && enCurso === a.clave ? "Guardando…" : a.activa ? "Apagar" : "Encender"}
                      </button>
                    ) : (
                      <span className="text-[11px] text-ink-soft">{!disponible ? "Se activa con el módulo" : "Siempre activa"}</span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <h2 className="mt-10 text-sm font-medium uppercase tracking-wide text-ink-soft">Últimas ejecuciones con mensajes</h2>
        {ejecuciones.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-white/15 bg-card/60 p-4 text-sm text-ink-soft">Todavía no hay ejecuciones que hayan preparado mensajes para tu estudio.</p>
        ) : (
          <ul className="mt-3 divide-y divide-white/10 rounded-2xl border border-white/10 bg-card">
            {ejecuciones.map((e, i) => (
              <li key={i} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="text-ink">{e.nombre}</span>
                <span className="text-xs text-ink-soft">{fechaHora(e.ejecutado_at)} · {e.encolados} mensaje(s){e.estado === "error" ? " · error" : ""}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
