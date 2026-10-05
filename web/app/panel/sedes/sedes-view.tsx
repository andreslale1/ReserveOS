"use client";

import { useState, useTransition } from "react";
import { cerrarSede, crearSede, reabrirSede } from "./actions";

type Sede = { id: string; name: string; address: string | null; timezone: string; status: string };

const input =
  "mt-1 w-full rounded-lg border border-white/15 bg-cream px-3 py-2 text-ink outline-none focus:border-ink/30";

export default function SedesView({ tenantId, sedes }: { tenantId: string; sedes: Sede[] }) {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [nombre, setNombre] = useState("");
  const [direccion, setDireccion] = useState("");
  const [tz, setTz] = useState("America/Guatemala");
  const [cerrando, setCerrando] = useState<string | null>(null);

  function correr(fn: () => Promise<{ error: string | null }>, ok: string, despues?: () => void) {
    setMsg(null);
    startTransition(async () => {
      const r = await fn();
      if (r.error) setMsg({ ok: false, texto: r.error });
      else {
        setMsg({ ok: true, texto: ok });
        despues?.();
      }
    });
  }

  return (
    <main className="min-h-screen bg-cream">
      <header className="border-b border-white/10 bg-card px-6 py-6 md:px-10">
        <h1 className="font-serif text-2xl text-ink md:text-3xl">Sedes</h1>
        <p className="mt-1 text-sm text-ink/60">Abre una sede nueva o cierra una que ya no opera</p>
      </header>
      <div className="mx-auto grid max-w-3xl gap-6 px-6 py-8 md:px-10">
        {msg && (
          <p className={`rounded-xl px-4 py-3 text-sm ${msg.ok ? "bg-sage-tint text-sage" : "bg-peach-tint text-ink"}`}>
            {msg.texto}
          </p>
        )}
        <section className="rounded-2xl border border-white/10 bg-card p-5">
          <ul className="divide-y divide-white/10">
            {sedes.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium text-ink">
                    {s.name}{" "}
                    <span className={`text-xs ${s.status === "activa" ? "text-sage" : "text-ink/50"}`}>
                      · {s.status === "activa" ? "Activa" : "Cerrada"}
                    </span>
                  </p>
                  <p className="text-xs text-ink/55">
                    {s.address ?? "Sin dirección"} · {s.timezone}
                  </p>
                </div>
                {s.status === "activa" ? (
                  cerrando === s.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-ink">Se desactivan sus horarios. ¿Cerrar?</span>
                      <button
                        className="press-spring rounded-full bg-ink px-3 py-1.5 text-xs font-medium text-cream"
                        disabled={isPending}
                        onClick={() => correr(() => cerrarSede(s.id), "Sede cerrada.", () => setCerrando(null))}
                      >
                        Sí
                      </button>
                      <button className="text-xs text-ink/60" onClick={() => setCerrando(null)}>
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-ink/70 hover:text-ink"
                      onClick={() => setCerrando(s.id)}
                    >
                      Cerrar sede
                    </button>
                  )
                ) : (
                  <button
                    className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-ink/70 hover:text-ink"
                    disabled={isPending}
                    onClick={() => correr(() => reabrirSede(s.id), "Sede reabierta (vuelve a activar sus horarios).")}
                  >
                    Reabrir
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-white/10 bg-card p-5">
          <h2 className="text-base font-semibold text-ink">Nueva sede</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-ink/60">
              Nombre
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={input} />
            </label>
            <label className="text-sm text-ink/60">
              Zona horaria
              <input value={tz} onChange={(e) => setTz(e.target.value)} className={input} />
            </label>
            <label className="text-sm text-ink/60 sm:col-span-2">
              Dirección
              <input value={direccion} onChange={(e) => setDireccion(e.target.value)} className={input} />
            </label>
          </div>
          <button
            className="press-spring mt-4 rounded-full bg-ink px-4 py-2 text-sm font-medium text-cream disabled:opacity-50"
            disabled={isPending || !nombre.trim()}
            onClick={() =>
              correr(() => crearSede(tenantId, nombre, direccion, tz), "Sede creada.", () => {
                setNombre("");
                setDireccion("");
              })
            }
          >
            Crear sede
          </button>
        </section>
      </div>
    </main>
  );
}
