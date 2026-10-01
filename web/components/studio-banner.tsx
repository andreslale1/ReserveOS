import Image from "next/image";
import Reveal from "./reveal";

export default function StudioBanner() {
  return (
    <section className="relative isolate h-[70vh] min-h-[480px] overflow-hidden bg-void">
      {/*
        Imagen generada con IA (Media.io, prompt original propio) de un
        estudio de pilates ficticio -- reemplazar por fotografia propia del
        estudio en cuanto haya uno autorizado. Nunca fotos ni copy de
        referencias de otras marcas.
      */}
      <Image
        src="/generated/daut55g7ve0o2anluj30.jpeg"
        alt="Estudio de pilates con reformers, iluminación nocturna"
        fill
        sizes="100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-void/55" />
      <div className="absolute inset-0 bg-gradient-to-t from-void via-void/10 to-void/40" />

      <Reveal className="relative flex h-full flex-col items-center justify-center gap-6 px-6 text-center">
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-5xl font-black uppercase leading-[0.95] tracking-tight text-white md:text-8xl">
          <span>Eleva</span>
          <span className="text-lime">tu</span>
          <span>estudio.</span>
        </div>
        <a
          href="#contacto"
          className="press-spring inline-flex items-center gap-2 rounded-full border border-white/30 bg-black/30 px-6 py-2.5 text-sm font-medium uppercase tracking-wide text-white backdrop-blur-sm transition-colors duration-200 hover:border-white/60"
        >
          Agendar una demo ↗
        </a>
      </Reveal>
    </section>
  );
}
