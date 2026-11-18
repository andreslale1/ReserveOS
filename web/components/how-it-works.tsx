import Reveal from "./reveal";

const FORMAS = [
  {
    t: "Link de reserva",
    d: "Creamos tu cuenta, cargamos tus sedes, horarios y paquetes, y le damos acceso a tu equipo. Tú compartes un link por WhatsApp, Instagram o QR y tus clientes reservan.",
    visual: (
      <div className="flex items-center gap-2 rounded-lg border border-line bg-void px-3 py-2.5 text-sm">
        <span className="tabular truncate text-ink">reserveos.app/e/<span className="font-semibold">tu-gimnasio</span></span>
        <span className="ml-auto rounded-md bg-lime px-2.5 py-1 text-xs font-semibold text-white">Copiar</span>
      </div>
    ),
  },
  {
    t: "Widget en tu web",
    d: "Si ya tienes página, pegas un código y aparece el horario con botón de reservar dentro de tu sitio. Tus clientes se registran una sola vez y ya quedan en tu base de datos.",
    visual: (
      <pre className="overflow-x-auto rounded-lg bg-ink px-4 py-3 text-[12px] leading-relaxed text-void"><code>{`<script src="https://reserveos.app/widget.js"
  data-estudio="tu-gimnasio" async></script>`}</code></pre>
    ),
  },
  {
    t: "Tu web completa, con tu marca",
    d: "Si no tienes página, la construimos con tu manual de marca y las reservas ya integradas: horarios, paquetes, equipo y registro de clientes, en tu propio dominio.",
    visual: (
      <div className="flex items-center gap-3 rounded-lg border border-line bg-void px-3 py-2.5">
        <span className="flex gap-1.5" aria-hidden><i className="h-5 w-5 rounded-full bg-[#2f5d8c]" /><i className="h-5 w-5 rounded-full bg-[#b9cde4]" /><i className="h-5 w-5 rounded-full bg-[#b79f86]" /><i className="h-5 w-5 rounded-full bg-[#1b2530]" /></span>
        <span className="text-sm text-ink-soft">tu logo, tus colores, <span className="text-ink">tugimnasio.com</span></span>
      </div>
    ),
  },
];

export default function HowItWorks() {
  return (
    <section id="formas" className="border-y border-line bg-void-card">
      <div className="mx-auto grid max-w-6xl gap-14 px-6 py-24 md:grid-cols-[0.8fr_1.2fr]">
        <div className="md:sticky md:top-28 md:self-start">
          <h2 className="text-4xl font-semibold leading-tight text-ink md:text-5xl">Tres formas de empezar, según lo que ya tengas.</h2>
          <p className="mt-5 max-w-sm text-ink-soft">Todas usan el mismo sistema por dentro: una sola base de clientes, reservas y pagos.</p>
        </div>
        <ol className="divide-y divide-line">
          {FORMAS.map((f, i) => (
            <li key={f.t} className="py-9 first:pt-0 last:pb-0">
              <Reveal delay={i * 60}>
                <h3 className="text-2xl font-semibold text-ink">{f.t}</h3>
                <p className="mt-3 max-w-xl leading-relaxed text-ink-soft">{f.d}</p>
                <div className="mt-5 max-w-xl">{f.visual}</div>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
