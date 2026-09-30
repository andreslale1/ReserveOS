import Reveal from "./reveal";

export default function FinalCta() {
  return (
    <section id="contacto" className="mx-auto max-w-6xl px-6 pb-24">
      <Reveal className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-ink to-[#2a2a2a] px-10 py-16 text-center text-cream shadow-[0_50px_100px_-30px_rgba(17,17,17,0.5)] md:py-20">
        <div
          className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full opacity-30 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(232,184,155,0.55), transparent 70%)",
          }}
        />
        <h2 className="relative mx-auto max-w-lg font-serif text-3xl leading-tight tracking-tight md:text-4xl">
          Tu estudio ya opera. Falta el sistema que lo alcance.
        </h2>
        <p className="relative mx-auto mt-4 max-w-md text-sm text-cream/70">
          Estamos abriendo cupo con un número limitado de estudios para la
          siguiente fase.
        </p>
        <a
          href="mailto:hola@reserveos.app"
          className="press-spring relative mt-8 inline-flex rounded-full bg-peach px-8 py-3.5 text-sm font-medium text-ink shadow-[0_16px_32px_-12px_rgba(0,0,0,0.4)] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:shadow-[0_20px_40px_-8px_rgba(0,0,0,0.5)]"
        >
          Escribinos →
        </a>
      </Reveal>
    </section>
  );
}
