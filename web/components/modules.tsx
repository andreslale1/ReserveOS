"use client";

import { useState } from "react";
import { GIROS, type Giro } from "@/lib/giros";

const ORDEN: Giro[] = ["pilates", "crossfit", "hyrox"];

export default function Modules() {
  const [g, setG] = useState<Giro>("pilates");
  const v = GIROS[g];
  const filas: [string, string][] = [
    ["Quien reserva", v.persona],
    ["Lo que se reserva", v.clase],
    ["Quien lo dirige", v.guia],
    ["Cómo se reserva", v.reserva === "carril" ? `Por bloque y por ${v.recurso} numerado` : `Por cupo en cada ${v.clase}`],
    ["Lo que se vende", v.paquete],
  ];
  return (
    <section id="giros" className="mx-auto max-w-6xl px-6 py-24">
      <div className="max-w-2xl">
        <h2 className="text-4xl font-semibold leading-tight text-ink md:text-5xl">Cada gimnasio habla su propio idioma.</h2>
        <p className="mt-5 text-ink-soft">Elegimos el giro al crear tu cuenta y todo el sistema —pantallas, correos y reportes— usa tus palabras.</p>
      </div>
      <div className="mt-10 grid gap-10 md:grid-cols-[auto_1fr]">
        <div role="tablist" aria-label="Giro del negocio" className="flex gap-2 md:flex-col">
          {ORDEN.map((k) => (
            <button key={k} role="tab" aria-selected={g === k} onClick={() => setG(k)}
              className={`press-spring rounded-lg px-5 py-3 text-left text-sm font-semibold transition-colors ${g === k ? "bg-lime text-white" : "border border-line bg-void-card text-ink hover:border-ink/30"}`}>
              {GIROS[k].nombre}
            </button>
          ))}
        </div>
        <div role="tabpanel" className="rounded-2xl border border-line bg-void-card p-8">
          <p className="max-w-xl text-lg leading-relaxed text-ink">{v.detalle}</p>
          <dl className="mt-7 divide-y divide-line border-t border-line">
            {filas.map(([k, val]) => (
              <div key={k} className="grid grid-cols-[10rem_1fr] gap-4 py-3.5 text-sm">
                <dt className="text-ink-soft">{k}</dt>
                <dd className="font-medium text-ink first-letter:uppercase">{val}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
