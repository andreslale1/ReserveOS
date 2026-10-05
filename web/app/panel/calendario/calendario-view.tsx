"use client";

import { Fragment, useState, useTransition } from "react";
import Reveal from "@/components/reveal";
import { crearHorario } from "./actions";

type Celda = {
  hora: string;
  recurso: string | null;
  nombre: string;
  clientas: string[];
  cupoMaximo: number;
};
type Sede = { id: string; name: string };
type Instructora = { id: string; nombre: string | null };

const COLORES = [
  { bg: "bg-sage-tint", text: "text-sage", border: "border-sage/20" },
  { bg: "bg-blue-tint", text: "text-blue", border: "border-blue/20" },
  { bg: "bg-peach-tint", text: "text-ink", border: "border-peach/30" },
];

const DIAS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

export default function CalendarioView({
  fecha,
  recursos,
  horas,
  celdas,
  tenantId,
  sedes,
  instructoras,
  puedeCrear,
}: {
  fecha: string;
  recursos: [string | null, string][];
  horas: string[];
  celdas: Celda[];
  tenantId: string;
  sedes: Sede[];
  instructoras: Instructora[];
  puedeCrear: boolean;
}) {
  const fechaLegible = new Date(fecha + "T00:00:00").toLocaleDateString(
    "es-GT",
    { weekday: "long", day: "numeric", month: "long" },
  );

  const [mostrarForm, setMostrarForm] = useState(false);
  const [sedeId, setSedeId] = useState(sedes[0]?.id ?? "");
  const [diaSemana, setDiaSemana] = useState(String(new Date().getDay()));
  const [horaInicio, setHoraInicio] = useState("08:00");
  const [horaFin, setHoraFin] = useState("08:50");
  const [nombreClase, setNombreClase] = useState("");
  const [cupoMaximo, setCupoMaximo] = useState("6");
  const [instructorId, setInstructorId] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setNombreClase("");
    setHoraInicio("08:00");
    setHoraFin("08:50");
    setCupoMaximo("6");
    setInstructorId("");
    setError(null);
    setMostrarForm(false);
  }

  function crear() {
    setError(null);
    startTransition(async () => {
      const res = await crearHorario({
        tenantId,
        sedeId,
        diaSemana: Number(diaSemana),
        horaInicio,
        horaFin,
        nombreClase,
        cupoMaximo: Number(cupoMaximo || 6),
        instructorMembershipId: instructorId || null,
      });
      if (res.error) {
        setError(res.error);
      } else {
        resetForm();
      }
    });
  }

  return (
    <main className="min-h-screen bg-cream">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 bg-card px-6 py-6 md:px-10">
        <div>
          <h1 className="font-serif text-2xl text-ink md:text-3xl">
            Calendario
          </h1>
          <p className="mt-1 text-sm capitalize text-ink/60">
            {fechaLegible}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex overflow-hidden rounded-full border border-white/15 text-sm">
            {["Día", "Semana", "Mes"].map((v, i) => (
              <span
                key={v}
                className={`px-4 py-1.5 ${i === 0 ? "bg-ink text-cream" : "text-ink/50"}`}
              >
                {v}
              </span>
            ))}
          </div>
          {puedeCrear && (
            <button
              onClick={() => (mostrarForm ? resetForm() : setMostrarForm(true))}
              className="press-spring rounded-full bg-ink px-4 py-2 text-sm font-medium text-cream"
            >
              {mostrarForm ? "Cancelar" : "+ Nueva clase"}
            </button>
          )}
        </div>
      </header>

      <div className="px-6 pt-8 md:px-10">
        {mostrarForm && (
          <div className="mb-6 grid gap-4 rounded-2xl border border-white/10 bg-card p-5 sm:grid-cols-3">
            {sedes.length > 1 && (
              <label className="text-sm text-ink/60">
                Sede
                <select
                  value={sedeId}
                  onChange={(e) => setSedeId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-cream px-3 py-2 text-ink outline-none"
                >
                  {sedes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="text-sm text-ink/60">
              Día de la semana
              <select
                value={diaSemana}
                onChange={(e) => setDiaSemana(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/15 bg-cream px-3 py-2 text-ink outline-none"
              >
                {DIAS.map((d, i) => (
                  <option key={i} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-ink/60">
              Nombre de la clase
              <input
                type="text"
                value={nombreClase}
                onChange={(e) => setNombreClase(e.target.value)}
                placeholder="Reformer Flow"
                className="mt-1 w-full rounded-lg border border-white/15 bg-cream px-3 py-2 text-ink outline-none"
              />
            </label>
            <label className="text-sm text-ink/60">
              Hora inicio
              <input
                type="time"
                value={horaInicio}
                onChange={(e) => setHoraInicio(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/15 bg-cream px-3 py-2 text-ink outline-none"
              />
            </label>
            <label className="text-sm text-ink/60">
              Hora fin
              <input
                type="time"
                value={horaFin}
                onChange={(e) => setHoraFin(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/15 bg-cream px-3 py-2 text-ink outline-none"
              />
            </label>
            <label className="text-sm text-ink/60">
              Cupo máximo
              <input
                type="number"
                value={cupoMaximo}
                onChange={(e) => setCupoMaximo(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/15 bg-cream px-3 py-2 text-ink outline-none"
              />
            </label>
            {instructoras.length > 0 && (
              <label className="text-sm text-ink/60">
                Instructora (opcional)
                <select
                  value={instructorId}
                  onChange={(e) => setInstructorId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-cream px-3 py-2 text-ink outline-none"
                >
                  <option value="">Sin asignar</option>
                  {instructoras.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.nombre}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="sm:col-span-3">
              <button
                onClick={crear}
                disabled={isPending || !nombreClase || !sedeId}
                className="press-spring rounded-full bg-ink px-6 py-2.5 text-sm font-medium text-cream disabled:opacity-50"
              >
                {isPending ? "Creando…" : "Crear clase"}
              </button>
              {error && (
                <span className="ml-4 text-sm text-red-500">{error}</span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="overflow-x-auto px-6 pb-8 md:px-10">
        <Reveal>
          <div
            className="grid min-w-[720px] gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10"
            style={{
              gridTemplateColumns: `88px repeat(${recursos.length || 1}, 1fr)`,
            }}
          >
            <div className="bg-card" />
            {recursos.map(([id, nombre]) => (
              <div
                key={id}
                className="bg-card px-4 py-3 text-sm font-medium text-ink"
              >
                {nombre}
              </div>
            ))}
            {recursos.length === 0 && (
              <div className="bg-card px-4 py-3 text-sm text-ink/40">
                Sin instructoras asignadas
              </div>
            )}

            {horas.map((hora) => (
              <Fragment key={hora}>
                <div className="bg-cream px-3 py-4 text-xs text-ink/45">
                  {hora}
                </div>
                {(recursos.length ? recursos : [[null, ""]]).map(
                  ([recursoId], ci) => {
                    const celda = celdas.find(
                      (c) => c.hora === hora && c.recurso === recursoId,
                    );
                    const color = COLORES[ci % COLORES.length];
                    return (
                      <div
                        key={`${hora}-${recursoId}`}
                        className="min-h-[64px] bg-card p-1.5"
                      >
                        {celda ? (
                          <div
                            className={`h-full rounded-lg border p-2 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 ${color.bg} ${color.border}`}
                          >
                            <p className={`text-xs font-medium ${color.text}`}>
                              {celda.nombre}
                            </p>
                            <p className="mt-0.5 text-[11px] text-ink/50">
                              {celda.clientas.length}/{celda.cupoMaximo}
                              {celda.clientas[0]
                                ? ` · ${celda.clientas[0]}${celda.clientas.length > 1 ? " +" + (celda.clientas.length - 1) : ""}`
                                : ""}
                            </p>
                          </div>
                        ) : (
                          <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-ink/10 text-ink/20">
                            +
                          </div>
                        )}
                      </div>
                    );
                  },
                )}
              </Fragment>
            ))}
          </div>
        </Reveal>
      </div>
    </main>
  );
}
