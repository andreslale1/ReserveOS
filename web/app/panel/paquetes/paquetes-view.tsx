"use client";

import { useState, useTransition } from "react";
import { crearPaquete, toggleActivoPaquete } from "./actions";

type Paquete = {
  id: string;
  nombre: string;
  descripcion: string | null;
  numClases: number | null;
  precio: number;
  vigenciaDias: number;
  cobertura: string;
  activo: boolean;
  categoria: string;
  sedeIds: string[];
};
type Sede = { id: string; name: string };

const COBERTURA_LABEL: Record<string, string> = {
  sede: "Solo la sede donde se vende",
  sedes: "Sedes seleccionadas",
  todas: "Todas las sedes",
};

function fmt(n: number) {
  return `Q${Number(n).toLocaleString("es-GT", { maximumFractionDigits: 0 })}`;
}

export default function PaquetesView({
  paquetes,
  sedes,
  tenantId,
  puedeGestionar,
}: {
  paquetes: Paquete[];
  sedes: Sede[];
  tenantId: string;
  puedeGestionar: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [mostrarForm, setMostrarForm] = useState(false);
  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState("");
  const [numClases, setNumClases] = useState("");
  const [vigenciaDias, setVigenciaDias] = useState("30");
  const [cobertura, setCobertura] = useState("sede");
  const [sedeIds, setSedeIds] = useState<string[]>([]);
  const [descripcion, setDescripcion] = useState("");
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setNombre("");
    setPrecio("");
    setNumClases("");
    setVigenciaDias("30");
    setCobertura("sede");
    setSedeIds([]);
    setDescripcion("");
    setError(null);
    setMostrarForm(false);
  }

  function crear() {
    setError(null);
    startTransition(async () => {
      const res = await crearPaquete({
        tenantId,
        nombre,
        precio: Number(precio || 0),
        vigenciaDias: Number(vigenciaDias || 30),
        numClases: numClases ? Number(numClases) : null,
        cobertura,
        sedeIds,
        descripcion,
      });
      if (res.error) {
        setError(res.error);
      } else {
        resetForm();
      }
    });
  }

  function toggle(id: string, activo: boolean) {
    startTransition(() => {
      toggleActivoPaquete(id, !activo);
    });
  }

  return (
    <main className="min-h-screen bg-cream">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 bg-card px-6 py-6 md:px-10">
        <div>
          <h1 className="text-2xl font-semibold text-ink md:text-3xl">
            Paquetes
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            Lo que el estudio vende — créditos de clases y su cobertura.
          </p>
        </div>
        {puedeGestionar && (
          <button
            onClick={() => (mostrarForm ? resetForm() : setMostrarForm(true))}
            className="press-spring rounded-full bg-ink px-5 py-2 text-sm font-medium text-cream"
          >
            {mostrarForm ? "Cancelar" : "+ Nuevo paquete"}
          </button>
        )}
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8 md:px-10">
        {mostrarForm && (
          <div className="mb-6 grid gap-4 rounded-2xl border border-white/10 bg-card p-5 sm:grid-cols-2">
            <label className="text-sm text-ink-soft">
              Nombre
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Paquete 8 clases"
                className="mt-1 w-full rounded-lg border border-white/15 bg-cream px-3 py-2 text-ink outline-none"
              />
            </label>
            <label className="text-sm text-ink-soft">
              Precio (Q)
              <input
                type="number"
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/15 bg-cream px-3 py-2 text-ink outline-none"
              />
            </label>
            <label className="text-sm text-ink-soft">
              Número de clases (vacío = ilimitado)
              <input
                type="number"
                value={numClases}
                onChange={(e) => setNumClases(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/15 bg-cream px-3 py-2 text-ink outline-none"
              />
            </label>
            <label className="text-sm text-ink-soft">
              Vigencia (días)
              <input
                type="number"
                value={vigenciaDias}
                onChange={(e) => setVigenciaDias(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/15 bg-cream px-3 py-2 text-ink outline-none"
              />
            </label>
            <label className="text-sm text-ink-soft sm:col-span-2">
              Cobertura de sedes
              <select
                value={cobertura}
                onChange={(e) => setCobertura(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/15 bg-cream px-3 py-2 text-ink outline-none"
              >
                <option value="sede">Solo la sede donde se vende</option>
                <option value="sedes">Sedes seleccionadas</option>
                <option value="todas">Todas las sedes del estudio</option>
              </select>
            </label>
            {cobertura === "sedes" && sedes.length > 0 && (
              <div className="text-sm text-ink-soft sm:col-span-2">
                Sedes incluidas
                <div className="mt-1 flex flex-wrap gap-2">
                  {sedes.map((s) => (
                    <label
                      key={s.id}
                      className={`cursor-pointer rounded-full border px-3 py-1 text-xs ${
                        sedeIds.includes(s.id)
                          ? "border-ink bg-ink text-cream"
                          : "border-white/15 text-ink-soft"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={sedeIds.includes(s.id)}
                        onChange={(e) =>
                          setSedeIds((prev) =>
                            e.target.checked
                              ? [...prev, s.id]
                              : prev.filter((id) => id !== s.id),
                          )
                        }
                      />
                      {s.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <label className="text-sm text-ink-soft sm:col-span-2">
              Descripción (opcional)
              <input
                type="text"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/15 bg-cream px-3 py-2 text-ink outline-none"
              />
            </label>
            <div className="sm:col-span-2">
              <button
                onClick={crear}
                disabled={isPending || !nombre || !precio}
                className="press-spring rounded-full bg-ink px-6 py-2.5 text-sm font-medium text-cream disabled:opacity-50"
              >
                {isPending ? "Creando…" : "Crear paquete"}
              </button>
              {error && (
                <span className="ml-4 text-sm text-red-500">{error}</span>
              )}
            </div>
          </div>
        )}

        {paquetes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-card p-8 text-center text-sm text-ink-soft">
            Todavía no hay paquetes creados — este estudio no tiene nada que
            vender hasta que crees el primero.
          </div>
        ) : (
          <ul className="space-y-2">
            {paquetes.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-card p-5"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-ink">
                      {p.nombre}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        p.activo
                          ? "bg-sage-tint text-sage"
                          : "bg-neutral-tint text-ink/50"
                      }`}
                    >
                      {p.activo ? "Activo" : "Inactivo"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-ink-soft">
                    {fmt(p.precio)} · {p.numClases ?? "∞"} clases ·{" "}
                    {p.vigenciaDias} días · {COBERTURA_LABEL[p.cobertura]}
                  </p>
                </div>
                {puedeGestionar && (
                  <button
                    disabled={isPending}
                    onClick={() => toggle(p.id, p.activo)}
                    className="rounded-full border border-white/15 px-3 py-1 text-xs text-ink-soft hover:text-ink"
                  >
                    {p.activo ? "Desactivar" : "Activar"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
