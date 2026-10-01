"use client";

import { useState, useTransition } from "react";
import { crearCodigoDescuento, toggleCodigoDescuento } from "./actions";

type Codigo = {
  id: string;
  codigo: string;
  descuento_pct: number;
  aplica_a: string;
  activo: boolean;
  usos_maximos: number | null;
  usos_actuales: number;
  vigente_hasta: string | null;
  auto_aplicar_canal: string | null;
  created_at: string;
};

export default function DescuentosView({
  tenantId,
  codigos,
  puedeGestionar,
}: {
  tenantId: string;
  codigos: Codigo[];
  puedeGestionar: boolean;
}) {
  const [mostrarForm, setMostrarForm] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [pct, setPct] = useState("10");
  const [usosMaximos, setUsosMaximos] = useState("");
  const [vigenteHasta, setVigenteHasta] = useState("");
  const [isPending, startTransition] = useTransition();
  const [mensaje, setMensaje] = useState<string | null>(null);

  function crear() {
    setMensaje(null);
    startTransition(async () => {
      const res = await crearCodigoDescuento({
        tenantId,
        codigo,
        descuentoPct: Number(pct || 0),
        usosMaximos: usosMaximos ? Number(usosMaximos) : null,
        vigenteHasta: vigenteHasta || null,
      });
      if (res.error) {
        setMensaje(`Error: ${res.error}`);
      } else {
        setCodigo("");
        setPct("10");
        setUsosMaximos("");
        setVigenteHasta("");
        setMostrarForm(false);
      }
    });
  }

  function toggle(id: string, activoActual: boolean) {
    startTransition(() => {
      toggleCodigoDescuento(id, !activoActual);
    });
  }

  return (
    <main className="min-h-screen bg-cream">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 bg-card px-6 py-6 md:px-10">
        <div>
          <h1 className="text-2xl font-semibold text-ink md:text-3xl">
            Descuentos
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            {codigos.length} código{codigos.length === 1 ? "" : "s"} creado
            {codigos.length === 1 ? "" : "s"}.
          </p>
        </div>
        {puedeGestionar && (
          <button
            onClick={() => setMostrarForm((v) => !v)}
            className="press-spring rounded-full bg-lime px-5 py-2 text-sm font-bold uppercase tracking-wide text-void"
          >
            {mostrarForm ? "Cancelar" : "+ Nuevo código"}
          </button>
        )}
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8 md:px-10">
        {mostrarForm && (
          <div className="mb-6 grid gap-4 rounded-2xl border border-white/10 bg-card p-5 sm:grid-cols-4">
            <label className="text-sm text-ink-soft">
              Código
              <input
                type="text"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                placeholder="BIENVENIDA10"
                className="mt-1 w-full rounded-lg border border-white/15 bg-cream px-3 py-2 text-ink outline-none focus:border-lime/50"
              />
            </label>
            <label className="text-sm text-ink-soft">
              % descuento
              <input
                type="number"
                value={pct}
                onChange={(e) => setPct(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/15 bg-cream px-3 py-2 text-ink outline-none focus:border-lime/50"
              />
            </label>
            <label className="text-sm text-ink-soft">
              Usos máximos
              <input
                type="number"
                value={usosMaximos}
                onChange={(e) => setUsosMaximos(e.target.value)}
                placeholder="Sin límite"
                className="mt-1 w-full rounded-lg border border-white/15 bg-cream px-3 py-2 text-ink outline-none focus:border-lime/50"
              />
            </label>
            <label className="text-sm text-ink-soft">
              Vigente hasta
              <input
                type="date"
                value={vigenteHasta}
                onChange={(e) => setVigenteHasta(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/15 bg-cream px-3 py-2 text-ink outline-none focus:border-lime/50"
              />
            </label>
            <div className="sm:col-span-4">
              <button
                onClick={crear}
                disabled={isPending || !codigo}
                className="press-spring rounded-full bg-ink px-6 py-2.5 text-sm font-bold uppercase tracking-wide text-cream disabled:opacity-50"
              >
                {isPending ? "Creando…" : "Crear código"}
              </button>
              {mensaje && (
                <span className="ml-4 text-sm text-ink-soft">{mensaje}</span>
              )}
            </div>
          </div>
        )}

        {codigos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-card p-8 text-center text-sm text-ink-soft">
            No hay códigos de descuento creados.
          </div>
        ) : (
          <ul className="space-y-2">
            {codigos.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-card p-5"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-ink">
                      {c.codigo}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        c.activo
                          ? "bg-sage-tint text-sage"
                          : "bg-neutral-tint text-ink/50"
                      }`}
                    >
                      {c.activo ? "Activo" : "Inactivo"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-ink-soft">
                    {c.descuento_pct}% · aplica a {c.aplica_a}
                    {c.auto_aplicar_canal
                      ? ` · auto para canal "${c.auto_aplicar_canal}"`
                      : ""}
                    {c.vigente_hasta ? ` · vence ${c.vigente_hasta}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-sm tabular-nums text-ink-soft">
                    {c.usos_actuales}
                    {c.usos_maximos ? ` / ${c.usos_maximos}` : ""} usos
                  </span>
                  {puedeGestionar && (
                    <button
                      disabled={isPending}
                      onClick={() => toggle(c.id, c.activo)}
                      className="rounded-full border border-white/15 px-3 py-1 text-xs text-ink-soft hover:text-ink"
                    >
                      {c.activo ? "Desactivar" : "Activar"}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
