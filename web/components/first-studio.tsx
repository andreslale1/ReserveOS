const sedes = [
  { nombre: "Sede Norte", ocupacion: 92 },
  { nombre: "Sede Centro", ocupacion: 78 },
  { nombre: "Sede Sur", ocupacion: 85 },
];

import Reveal from "./reveal";

export default function FirstStudio() {
  return (
    <section id="multisede" className="mx-auto max-w-6xl bg-void px-6 py-20">
      <Reveal className="grid gap-12 rounded-[2rem] border border-white/10 bg-void-card p-10 shadow-[0_40px_80px_-40px_rgba(0,0,0,0.6)] md:grid-cols-2 md:p-14">
        <div>
          <span className="text-xs font-medium uppercase tracking-wide text-lime">
            Pensado para varias sedes
          </span>
          <h2 className="mt-3 text-3xl font-black uppercase leading-tight tracking-tight text-white md:text-4xl">
            Una sede o diez, el mismo panel.
          </h2>
          <p className="mt-5 text-white/55">
            Cada sede tiene su horario, su instructoras y su caja — pero el
            dueño ve el negocio completo desde un solo panel, con permisos
            claros entre quién administra una sede y quién ve todas.
          </p>
          <a
            href="#contacto"
            className="mt-8 inline-flex text-sm font-medium text-lime underline decoration-lime/30 underline-offset-4 transition-colors duration-200 hover:decoration-lime"
          >
            Quiero que ReserveOS opere mi estudio →
          </a>
        </div>

        <div className="space-y-4">
          {sedes.map((s, i) => (
            <div
              key={s.nombre}
              className="rounded-xl border border-white/10 bg-void p-5"
            >
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-white">{s.nombre}</span>
                <span className="text-xs text-white/40">
                  {s.ocupacion}% ocupación hoy
                </span>
              </div>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-lime transition-[width] duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)]"
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
