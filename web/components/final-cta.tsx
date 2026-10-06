import Reveal from "./reveal";

export default function FinalCta() {
  return (
    <section id="contacto" className="mx-auto max-w-6xl bg-void px-6 pb-24">
      <Reveal className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-void-card px-10 py-16 text-center shadow-[0_50px_100px_-30px_rgba(0,0,0,0.6)] md:py-20">
        <div
          className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full opacity-40 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(198,255,58,0.5), transparent 70%)",
          }}
        />
        <h2 className="relative mx-auto max-w-lg text-3xl font-black uppercase leading-tight tracking-tight text-white md:text-4xl">
          Tu estudio ya opera. Falta el sistema que lo alcance.
        </h2>
        <p className="relative mx-auto mt-4 max-w-md text-sm text-white/55">
          Estamos abriendo cupo con un número limitado de estudios para la
          siguiente fase.
        </p>
        <a
          href="/contacto"
          className="press-spring relative mt-8 inline-flex rounded-full bg-lime px-8 py-3.5 text-sm font-bold uppercase tracking-wide text-void shadow-[0_0_40px_-8px_rgba(198,255,58,0.7)] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:shadow-[0_0_50px_-4px_rgba(198,255,58,0.85)]"
        >
          Escribinos →
        </a>
      </Reveal>
    </section>
  );
}
