import Link from "next/link";
import TableroDemo from "./tablero-demo";

export default function Hero() {
  return (
    <section id="producto" className="mx-auto grid max-w-6xl items-start gap-14 px-6 pb-24 pt-14 md:grid-cols-[0.9fr_1.1fr] md:pt-20">
      <div className="md:pt-8">
        <h1 className="text-5xl font-semibold leading-[1.02] text-ink md:text-[4rem]">
          El sistema de reservas que se adapta a <span className="text-lime">tu gimnasio.</span>
        </h1>
        <p className="mt-6 max-w-lg text-lg leading-relaxed text-ink-soft">
          Pilates, CrossFit o HYROX. Una sede o varias. Con tu marca y tus palabras. Tus clientes reservan desde el celular, tu recepción cobra en segundos y tú ves todo el negocio.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-3">
          <Link href="/contacto" className="press-spring rounded-lg bg-lime px-6 py-3 text-sm font-semibold text-white hover:bg-lime-dim">Pedir una demo</Link>
          <a href="#formas" className="press-spring rounded-lg border border-line bg-void-card px-6 py-3 text-sm font-semibold text-ink hover:border-ink/30">Ver cómo empezar</a>
        </div>
        <p className="mt-6 max-w-md text-sm text-ink-soft">Nació en Forma Pilates, un estudio real en Guatemala, y hoy se adapta a cada gimnasio.</p>
      </div>
      <TableroDemo />
    </section>
  );
}
