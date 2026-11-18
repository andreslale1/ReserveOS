import Link from "next/link";

const SEDES = ["Centro", "Norte", "Sur"];
const CLASES = [
  { h: "06:30", n: "Pilates Reformer", c: "Sofía R.", l: 2, t: 8 },
  { h: "08:00", n: "Pilates Mat", c: "Paula A.", l: 5, t: 10 },
  { h: "12:15", n: "Reformer Express", c: "Renata S.", l: 0, t: 8 },
  { h: "18:00", n: "Pilates Reformer", c: "Sofía R.", l: 3, t: 8 },
  { h: "19:00", n: "Pilates Flow", c: "Paula A.", l: 6, t: 10 },
];

// Vista de ejemplo del producto: así ve el horario una clienta. No son datos de un cliente real.
function Horario() {
  return (
    <div className="rounded-2xl border border-line bg-void-card shadow-[0_24px_48px_-24px_rgba(27,37,48,0.28)]" role="img" aria-label="Vista de ejemplo del horario de reservas de un estudio con tres sedes">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <div>
          <p className="font-serif text-base font-semibold text-ink">Reservar clase</p>
          <p className="text-xs text-ink-soft">Hoy, miércoles 18</p>
        </div>
        <div className="flex gap-1 rounded-lg bg-void p-1 text-xs font-medium">
          {SEDES.map((s, i) => (
            <span key={s} className={`rounded-md px-3 py-1.5 ${i === 0 ? "bg-void-card text-ink shadow-sm" : "text-ink-soft"}`}>{s}</span>
          ))}
        </div>
      </div>
      <ul className="divide-y divide-line">
        {CLASES.map((c, i) => (
          <li key={c.h} className="fila-in flex items-center gap-4 px-5 py-3.5" style={{ animationDelay: `${120 + i * 70}ms` }}>
            <span className="tabular w-12 font-serif text-lg font-semibold text-ink">{c.h}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-ink">{c.n}</span>
              <span className="block text-xs text-ink-soft">{c.c} · {c.l === 0 ? "Sin cupo" : `${c.l} lugares`}</span>
            </span>
            <span aria-hidden className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-ink/10 sm:block">
              <span className="block h-full rounded-full bg-lime" style={{ width: `${((c.t - c.l) / c.t) * 100}%` }} />
            </span>
            {c.l === 0 ? (
              <span className="w-24 rounded-lg border border-line px-3 py-1.5 text-center text-xs font-medium text-ink-soft">Lista de espera</span>
            ) : (
              <span className="w-24 rounded-lg bg-lime px-3 py-1.5 text-center text-xs font-semibold text-white">Reservar</span>
            )}
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between rounded-b-2xl bg-peach-tint px-5 py-3 text-xs text-ink">
        <span>Tu paquete: <strong>8 clases</strong> · 7 disponibles</span>
        <span className="text-ink-soft">Válido en las 3 sedes</span>
      </div>
    </div>
  );
}

export default function Hero() {
  return (
    <section id="producto" className="mx-auto grid max-w-6xl items-center gap-14 px-6 pb-24 pt-16 md:grid-cols-[1fr_1.05fr] md:pt-24">
      <div>
        <h1 className="text-5xl font-semibold leading-[1.02] text-ink md:text-[4.25rem]">
          Reservas, pagos y equipo de tu gimnasio, <span className="text-lime">en un solo lugar.</span>
        </h1>
        <p className="mt-6 max-w-lg text-lg leading-relaxed text-ink-soft">
          Para estudios de pilates, CrossFit y HYROX con una o varias sedes. Tus clientes reservan desde el celular, tu recepción cobra en segundos y tú ves todo el negocio.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-3">
          <Link href="/contacto" className="press-spring rounded-lg bg-lime px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-lime-dim">Pedir una demo</Link>
          <a href="#formas" className="press-spring rounded-lg border border-line bg-void-card px-6 py-3 text-sm font-semibold text-ink transition-colors hover:border-ink/30">Ver cómo empezar</a>
        </div>
        <p className="mt-6 max-w-md text-sm text-ink-soft">Nació en Forma Pilates, un estudio real en Guatemala, y hoy se adapta a cada gimnasio.</p>
      </div>
      <Horario />
    </section>
  );
}
