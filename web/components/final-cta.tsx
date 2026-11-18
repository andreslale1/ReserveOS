import Link from "next/link";
import Reveal from "./reveal";

export default function FinalCta() {
  return (
    <section id="contacto" className="mx-auto max-w-6xl px-6 py-24">
      <Reveal className="rounded-2xl bg-lime px-8 py-14 text-white md:px-16">
        <h2 className="max-w-2xl text-4xl font-semibold leading-tight md:text-5xl">Cuéntanos de tu gimnasio y te lo dejamos montado.</h2>
        <p className="mt-4 max-w-xl text-white/80">Sedes, horarios, paquetes y equipo cargados. Tú solo compartes el link con tus clientes.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/contacto" className="press-spring rounded-lg bg-white px-6 py-3 text-sm font-semibold text-lime transition-colors hover:bg-void">Pedir una demo</Link>
          <Link href="/registro" className="press-spring rounded-lg border border-white/40 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10">Abrir mi estudio</Link>
        </div>
      </Reveal>
    </section>
  );
}
