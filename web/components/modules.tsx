import Reveal from "./reveal";

const PASOS = [
  { hora: "7:40", titulo: "La clienta reserva desde el celular", texto: "Elige sede, día y clase; ve cuántas clases le quedan en su paquete y confirma con un toque.",
    visual: (
      <div className="rounded-xl border border-line bg-void px-4 py-3 text-sm">
        <p className="font-semibold text-ink">¡Reservada!</p>
        <p className="text-ink-soft">Pilates Reformer · 18:00 · Sede Centro</p>
        <p className="mt-1 text-xs text-ink-soft">Te quedan 7 de 8 clases.</p>
      </div>
    ) },
  { hora: "8:55", titulo: "Recepción cobra en segundos", texto: "Busca a la clienta, elige el paquete y registra el pago. Queda en la caja de esa sede y nadie lo cuenta dos veces.",
    visual: (
      <div className="rounded-xl border border-line bg-void px-4 py-3 text-sm">
        <div className="flex items-center justify-between"><span className="text-ink">8 clases · efectivo</span><span className="tabular font-semibold text-ink">Q700</span></div>
        <p className="mt-1 text-xs text-ink-soft">Caja de la sede Centro</p>
      </div>
    ) },
  { hora: "20:00", titulo: "La dueña ve todas las sedes", texto: "Ingresos por sede, ocupación y quién tiene acceso a qué, sin pedirle reportes a nadie.",
    visual: (
      <div className="space-y-2 rounded-xl border border-line bg-void px-4 py-3 text-sm">
        {[["Centro", 78], ["Norte", 64], ["Sur", 52]].map(([s, p]) => (
          <div key={s as string} className="flex items-center gap-3"><span className="w-14 text-ink">{s}</span><span aria-hidden className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/10"><span className="block h-full rounded-full bg-lime" style={{ width: `${p}%` }} /></span><span className="tabular w-9 text-right text-xs text-ink-soft">{p}%</span></div>
        ))}
        <p className="text-xs text-ink-soft">Ocupación de hoy (ejemplo)</p>
      </div>
    ) },
];

export default function Modules() {
  return (
    <section id="dia" className="mx-auto max-w-6xl px-6 py-24">
      <div className="max-w-2xl">
        <h2 className="text-4xl font-semibold leading-tight text-ink md:text-5xl">Un día cualquiera en tu gimnasio.</h2>
        <p className="mt-5 text-ink-soft">Así se reparte el trabajo cuando todo está en el mismo sistema.</p>
      </div>
      <ol className="mt-14 divide-y divide-line border-y border-line">
        {PASOS.map((p, i) => (
          <li key={p.hora}>
            <Reveal delay={i * 50} className="grid gap-6 py-10 md:grid-cols-[7rem_1fr_20rem] md:items-center md:gap-10">
              <span className="tabular font-serif text-5xl font-semibold text-lime">{p.hora}</span>
              <div>
                <h3 className="text-2xl font-semibold text-ink">{p.titulo}</h3>
                <p className="mt-2 max-w-lg text-ink-soft">{p.texto}</p>
              </div>
              {p.visual}
            </Reveal>
          </li>
        ))}
      </ol>
    </section>
  );
}
