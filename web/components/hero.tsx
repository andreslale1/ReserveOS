import Image from "next/image";
import Reveal from "./reveal";

export default function Hero() {
  return (
    <section id="producto" className="relative overflow-hidden bg-void">
      <div className="relative grid min-h-[92vh] md:grid-cols-[1.05fr_0.95fr]">
        <Reveal className="z-10 flex flex-col justify-center px-6 py-28 md:px-14 md:py-20">
          <span className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-lime/30 bg-lime/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-lime">
            <span className="h-1.5 w-1.5 rounded-full bg-lime" />
            Construido para estudios de pilates y fitness
          </span>

          <h1 className="text-6xl font-black uppercase leading-[0.92] tracking-tight text-white md:text-8xl">
            Cada
            <br />
            <span className="text-lime">clase.</span>
            <br />
            En orden.
          </h1>

          <p className="mt-7 max-w-md text-lg leading-relaxed text-white/60">
            ReserveOS es el sistema operativo para estudios de pilates y
            fitness: reservas, membresías, pagos, clientas y varias sedes en
            un solo lugar.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-4">
            <a
              href="#contacto"
              className="press-spring group inline-flex items-center gap-3 rounded-full bg-lime py-2 pl-7 pr-2 text-sm font-bold uppercase tracking-wide text-void shadow-[0_0_40px_-8px_rgba(198,255,58,0.8)] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:shadow-[0_0_50px_-4px_rgba(198,255,58,0.9)]"
            >
              Agendar una demo
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-void/15 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-0.5">
                →
              </span>
            </a>
            <a
              href="#modulos"
              className="press-spring text-sm font-medium text-white/70 underline decoration-white/30 underline-offset-4 transition-colors duration-200 hover:text-white hover:decoration-white"
            >
              Ver cómo funciona
            </a>
          </div>

          <dl className="mt-14 grid max-w-sm grid-cols-3 gap-6 border-t border-white/10 pt-8">
            <div>
              <dt className="text-2xl font-bold text-white">26</dt>
              <dd className="mt-1 text-xs text-white/45">Módulos</dd>
            </div>
            <div>
              <dt className="text-2xl font-bold text-white">Multi</dt>
              <dd className="mt-1 text-xs text-white/45">Sedes</dd>
            </div>
            <div>
              <dt className="text-2xl font-bold text-white">100%</dt>
              <dd className="mt-1 text-xs text-white/45">En un lugar</dd>
            </div>
          </dl>
        </Reveal>

        {/*
          Imagen generada con IA (Media.io, prompt original propio), a
          pantalla completa -- reemplazar por fotografia propia del estudio
          en cuanto haya uno autorizado. Nunca fotos ni copy de referencias
          de otras marcas.
        */}
        <Reveal delay={150} className="relative min-h-[50vh] md:min-h-full">
          <Image
            src="/generated/dauq0phg965g7gaunvh0.jpeg"
            alt="Clienta entrenando en reformer de pilates, iluminación dramática"
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-r from-void via-void/10 to-transparent md:bg-gradient-to-r md:from-void/80 md:via-transparent md:to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-void/80 via-transparent to-transparent" />

          <span className="absolute right-4 top-4 rounded-full bg-black/40 px-2 py-0.5 text-[10px] text-white/50 backdrop-blur-sm">
            Imagen generada con IA
          </span>

          <div className="absolute bottom-6 left-6 right-6 rounded-2xl border border-white/10 bg-void-card/90 p-5 shadow-[0_20px_50px_-16px_rgba(0,0,0,0.6)] backdrop-blur-xl md:left-6 md:right-auto md:w-80">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/50">Reformer · Sede Norte</span>
              <span className="rounded-full bg-lime/15 px-2.5 py-1 text-xs font-medium text-lime">
                8/8 cupos
              </span>
            </div>
            <div className="mt-3 flex -space-x-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <span
                  key={i}
                  className="h-7 w-7 rounded-full border-2 border-void-card bg-white/10"
                />
              ))}
              <span className="ml-3 flex items-center text-xs text-white/40">
                lista de espera activa
              </span>
            </div>
          </div>
        </Reveal>
      </div>

      <div className="relative overflow-hidden border-t border-white/10 py-3">
        <div className="animate-marquee flex w-max gap-10 whitespace-nowrap text-sm font-medium uppercase tracking-widest text-white/25">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex gap-10">
              {Array.from({ length: 8 }).map((_, j) => (
                <span key={j}>ReserveOS</span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
