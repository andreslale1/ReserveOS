const steps = [
  {
    n: "01",
    title: "La clienta reserva",
    body: "Desde el portal con tu marca, la app o el sitio del estudio. Ve cupos reales, lista de espera y sus créditos disponibles.",
  },
  {
    n: "02",
    title: "El sistema controla el cupo",
    body: "Créditos, cancelaciones, clases familiares y privadas se descuentan solos. La lista de espera promueve al siguiente cupo sin que nadie llame por teléfono.",
  },
  {
    n: "03",
    title: "El pago se concilia",
    body: "En línea, por transferencia con comprobante, o en caja de sede. Todo llega al mismo cierre de caja, por sede y por turno.",
  },
  {
    n: "04",
    title: "El dueño ve el negocio completo",
    body: "Ingresos, ocupación y metas de todas las sedes en un panel, no en cinco hojas de cálculo distintas.",
  },
];

import Reveal from "./reveal";

export default function HowItWorks() {
  return (
    <section className="mx-auto max-w-6xl bg-void px-6 py-20">
      <Reveal>
        <h2 className="max-w-lg text-3xl font-black uppercase leading-tight tracking-tight text-white md:text-4xl">
          De la reserva al cierre de caja, sin salir del sistema.
        </h2>
      </Reveal>

      <div className="mt-14 grid gap-x-8 gap-y-12 md:grid-cols-2">
        {steps.map((step, i) => (
          <Reveal key={step.n} delay={i * 90} className="flex gap-5">
            <span className="text-2xl font-bold text-lime/40">{step.n}</span>
            <div>
              <h3 className="text-xl font-bold text-white">{step.title}</h3>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/55">
                {step.body}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
