const sedes = [
  { nombre: "Sede Norte", ocupacion: 92 },
  { nombre: "Sede Centro", ocupacion: 78 },
  { nombre: "Sede Sur", ocupacion: 85 },
];

import Reveal from "./reveal";

export default function FirstStudio() {
  return (
    <section id="multisede" className="mx-auto max-w-6xl px-6 py-20">
      <Reveal className="grid gap-12 rounded-[2rem] border border-black/[0.06] bg-card p-10 shadow-[0_40px_80px_-40px_rgba(17,17,17,0.2)] md:grid-cols-2 md:p-14">
        <div>
          <span className="text-xs font-medium uppercase tracking-wide text-blue">
            Pensado para varias sedes
          </span>
          <h2 className="mt-3 font-serif text-3xl leading-tight tracking-tight text-ink md:text-4xl">
            Una sede o diez, el mismo panel.
          </h2>
          <p className="mt-5 text-ink/70">
            Cada sede tiene su horario, su instructoras y su caja — pero el
            dueño ve el negocio completo desde un solo panel, con permisos
            claros entre quién administra una sede y quién ve todas.
          </p>
          <a
            href="#contacto"
            className="mt-8 inline-flex text-sm font-medium text-ink underline decoration-ink/30 underline-offset-4 transition-colors duration-200 hover:decoration-ink"
          >
            Quiero que ReserveOS opere mi estudio →
          </a>
        </div>

        <div className="space-y-4">
          {sedes.map((s, i) => (
            <div
              key={s.nombre}
              className="rounded-xl border border-black/[0.06] bg-cream p-5 shadow-[0_12px_24px_-16px_rgba(17,17,17,0.15)]"
            >
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-ink">{s.nombre}</span>
                <span className="text-xs text-ink/50">
                  {s.ocupacion}% ocupación hoy
                </span>
              </div>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-neutral-tint">
                <div
                  className="h-full rounded-full bg-sage transition-[width] duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)]"
                  style={{
                    width: `${s.ocupacion}%`,
                    transitionDelay: `${i * 150}ms`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
