"use client";

import { useState } from "react";
import { GIROS, type Giro } from "@/lib/giros";

type Fila = { h: string; n: string; c: string; libres: number; total: number };
type Config = { estudio: string; sub: string; chips: string[]; filas: Fila[]; pie: [string, string] };

// Datos de ejemplo para mostrar cómo se adapta ReserveOS a cada giro. No son clientes reales.
const DATOS: Record<Exclude<Giro, "otro">, Config> = {
  pilates: {
    estudio: "Estudio Aura", sub: "Hoy, miércoles 18", chips: ["Centro", "Norte", "Sur"],
    filas: [
      { h: "06:30", n: "Pilates Reformer", c: "Sofía R.", libres: 2, total: 8 },
      { h: "08:00", n: "Pilates Mat", c: "Paula A.", libres: 5, total: 10 },
      { h: "12:15", n: "Reformer Express", c: "Renata S.", libres: 0, total: 8 },
      { h: "18:00", n: "Pilates Reformer", c: "Sofía R.", libres: 3, total: 8 },
    ],
    pie: ["Tu paquete: 8 clases · 7 disponibles", "Válido en las 3 sedes"],
  },
  crossfit: {
    estudio: "Box Norte", sub: "Hoy, miércoles 18", chips: ["Hoy", "Jueves", "Viernes"],
    filas: [
      { h: "06:00", n: "WOD · Metcon", c: "Coach Diego", libres: 4, total: 14 },
      { h: "07:00", n: "WOD · Fuerza + Metcon", c: "Coach Ana", libres: 9, total: 14 },
      { h: "12:00", n: "Open Gym", c: "Coach Luis", libres: 0, total: 10 },
      { h: "18:30", n: "WOD · Metcon", c: "Coach Diego", libres: 6, total: 14 },
    ],
    pie: ["Tu membresía: mensual · vence el 30", "Marcas personales guardadas"],
  },
  hyrox: {
    estudio: "Zona HYROX", sub: "Hoy, miércoles 18", chips: ["Hoy", "Jueves", "Sábado"],
    filas: [
      { h: "06:00", n: "Bloque A · Simulación", c: "Coach Mario", libres: 3, total: 8 },
      { h: "07:30", n: "Bloque B · Carrera y sled", c: "Coach Mario", libres: 5, total: 8 },
      { h: "18:00", n: "Bloque C · Estaciones", c: "Coach Elena", libres: 1, total: 8 },
    ],
    pie: ["Tu pase: 10 sesiones · 6 disponibles", "Eliges tu carril al reservar"],
  },
};

const MARCAS = [
  { n: "Pizarra", c: "#2f5d8c" },
  { n: "Bosque", c: "#2f6b57" },
  { n: "Terracota", c: "#a2503a" },
  { n: "Grafito", c: "#39424e" },
];

function Carriles({ total, libres, elegido, onElegir }: { total: number; libres: number; elegido: number | null; onElegir: (n: number | null) => void }) {
  // Los carriles ocupados se reparten de forma fija para que el ejemplo sea estable.
  const ocupados = new Set(Array.from({ length: total - libres }, (_, i) => ((i * 3 + 1) % total) + 1));
  return (
    <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Carriles">
      {Array.from({ length: total }, (_, i) => i + 1).map((n) => {
        const ocupado = ocupados.has(n);
        const sel = elegido === n;
        return (
          <button key={n} type="button" disabled={ocupado} aria-pressed={sel} aria-label={`Carril ${n}${ocupado ? ", ocupado" : ""}`}
            onClick={() => onElegir(sel ? null : n)}
            className={`tabular press-spring h-7 w-7 rounded-md text-xs font-semibold ${ocupado ? "cursor-not-allowed bg-ink/8 text-ink/30" : sel ? "bg-[var(--a)] text-white" : "border border-line text-ink hover:border-[var(--a)]"}`}>
            {n}
          </button>
        );
      })}
    </div>
  );
}

export default function TableroDemo() {
  const [giro, setGiro] = useState<Exclude<Giro, "otro">>("pilates");
  const [marca, setMarca] = useState(MARCAS[0].c);
  const [chip, setChip] = useState(0);
  const [carril, setCarril] = useState<Record<number, number | null>>({});
  const d = DATOS[giro];
  const v = GIROS[giro];

  const cambiarGiro = (g: Exclude<Giro, "otro">) => { setGiro(g); setChip(0); setCarril({}); };

  return (
    <div style={{ ["--a" as string]: marca }} className="w-full">
      <div role="tablist" aria-label="Giro del negocio" className="mb-3 flex flex-wrap items-center gap-2">
        {(["pilates", "crossfit", "hyrox"] as const).map((k) => (
          <button key={k} role="tab" aria-selected={giro === k} onClick={() => cambiarGiro(k)}
            className={`press-spring rounded-lg px-4 py-2 text-sm font-semibold ${giro === k ? "bg-ink text-void" : "border border-line bg-void-card text-ink hover:border-ink/30"}`}>
            {GIROS[k].nombre}
          </button>
        ))}
        <span className="ml-auto flex items-center gap-1.5" role="group" aria-label="Color de la marca del estudio">
          {MARCAS.map((m) => (
            <button key={m.c} type="button" aria-label={`Marca ${m.n}`} aria-pressed={marca === m.c} onClick={() => setMarca(m.c)}
              className={`press-spring h-6 w-6 rounded-full ring-offset-2 ring-offset-void ${marca === m.c ? "ring-2 ring-ink" : "ring-1 ring-line"}`} style={{ background: m.c }} />
          ))}
        </span>
      </div>

      <div className="rounded-2xl border border-line bg-void-card shadow-[0_28px_56px_-28px_rgba(27,37,48,0.3)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <p className="font-serif text-lg font-semibold text-ink">{d.estudio}</p>
            <p className="text-xs text-ink-soft">{d.sub}</p>
          </div>
          <div className="flex gap-1 rounded-lg bg-void p-1 text-xs font-medium" role="tablist" aria-label={giro === "pilates" ? "Sedes" : "Días"}>
            {d.chips.map((s, i) => (
              <button key={s} role="tab" aria-selected={chip === i} onClick={() => setChip(i)}
                className={`press-spring rounded-md px-3 py-1.5 ${chip === i ? "bg-void-card text-ink shadow-sm" : "text-ink-soft"}`}>{s}</button>
            ))}
          </div>
        </div>
        <ul key={giro + chip} className="divide-y divide-line">
          {d.filas.map((f, i) => (
            <li key={f.h} className="fila-in px-5 py-3.5" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="flex items-center gap-4">
                <span className="tabular w-12 font-serif text-lg font-semibold text-ink">{f.h}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{f.n}</span>
                  <span className="block text-xs text-ink-soft">{f.c} · {f.libres === 0 ? "Sin cupo" : `${f.libres} ${v.reserva === "carril" ? "carriles" : "lugares"}`}</span>
                </span>
                {f.libres === 0 ? (
                  <span className="w-28 rounded-lg border border-line px-3 py-1.5 text-center text-xs font-medium text-ink-soft">Lista de espera</span>
                ) : (
                  <span className="press-spring w-28 rounded-lg bg-[var(--a)] px-3 py-1.5 text-center text-xs font-semibold text-white">
                    {v.reserva === "carril" && carril[i] ? `Carril ${carril[i]}` : `Reservar`}
                  </span>
                )}
              </div>
              {v.reserva === "carril" && f.libres > 0 && (
                <div className="pl-16"><Carriles total={f.total} libres={f.libres} elegido={carril[i] ?? null} onElegir={(n) => setCarril((c) => ({ ...c, [i]: n }))} /></div>
              )}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-b-2xl px-5 py-3 text-xs text-ink" style={{ background: `color-mix(in srgb, var(--a) 11%, white)` }}>
          <span>{d.pie[0]}</span>
          <span className="text-ink-soft">{d.pie[1]}</span>
        </div>
      </div>
      <p className="mt-3 text-xs text-ink-soft">Ejemplo interactivo: cambia el giro y el color y mira cómo se adapta. Tus clientes ven el nombre y la marca de tu gimnasio, no la nuestra.</p>
    </div>
  );
}
