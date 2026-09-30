const before = [
  "Hoja de cálculo para membresías, WhatsApp para reservas, otra app para pagos.",
  "Cada sede lleva su propio control — nadie ve el negocio completo.",
  "Cancelaciones y no-shows se descuentan a mano, si acaso.",
  "El horario de una clase familiar o privada rompe la hoja de cálculo.",
];

const after = [
  "Reservas, membresías, pagos y clientas viven en un solo sistema.",
  "Panel del dueño con todas las sedes, en tiempo real, sin reconciliar nada.",
  "Créditos, lista de espera y asistencia se descuentan solos.",
  "Clases familiares, privadas y con congelación de membresía, nativas del sistema.",
];

import Reveal from "./reveal";

export default function ProblemSolution() {
  return (
    <section className="border-y border-black/[0.06] bg-card">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <Reveal className="max-w-xl">
          <h2 className="font-serif text-3xl leading-tight tracking-tight text-ink md:text-4xl">
            La operación de un estudio no cabe en una hoja de cálculo.
          </h2>
          <p className="mt-4 text-ink/70">
            ReserveOS reemplaza el collage de herramientas sueltas por un
            sistema que entiende cómo se opera un estudio de verdad —
            sedes, instructoras, membresías y todo lo que pasa entre clase
            y clase.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <Reveal delay={80} className="rounded-2xl border border-black/[0.06] bg-cream p-8 shadow-[0_20px_40px_-28px_rgba(17,17,17,0.18)]">
            <span className="text-xs font-medium uppercase tracking-wide text-ink/40">
              Antes
            </span>
            <ul className="mt-5 space-y-4">
              {before.map((item) => (
                <li key={item} className="flex gap-3 text-sm text-ink/70">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-ink/25" />
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={180} className="rounded-2xl border border-ink/20 bg-gradient-to-br from-ink to-[#2a2a2a] p-8 text-cream shadow-[0_30px_60px_-24px_rgba(17,17,17,0.45)]">
            <span className="text-xs font-medium uppercase tracking-wide text-cream/60">
              Con ReserveOS
            </span>
            <ul className="mt-5 space-y-4">
              {after.map((item) => (
                <li key={item} className="flex gap-3 text-sm text-cream/90">
                  <svg
                    className="mt-0.5 h-4 w-4 shrink-0"
                    viewBox="0 0 16 16"
                    fill="none"
                  >
                    <path
                      d="M3 8.5L6.5 12L13 4"
                      stroke="#A7B3A0"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
