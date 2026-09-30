import Image from "next/image";
import Reveal from "./reveal";

export default function Hero() {
  return (
    <section id="producto" className="relative overflow-hidden bg-void">
      <div
        className="pointer-events-none absolute -top-40 right-[-10%] h-[560px] w-[560px] rounded-full opacity-40 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(198,255,58,0.35), transparent 70%)",
        }}
      />
      <div className="relative mx-auto grid max-w-6xl gap-12 px-6 pt-16 pb-20 md:grid-cols-[1.1fr_0.9fr] md:pt-24 md:pb-28">
        <Reveal className="flex flex-col justify-center">
          <span className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-lime/30 bg-lime/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-lime">
            <span className="h-1.5 w-1.5 rounded-full bg-lime" />
            Construido para estudios de pilates y fitness
          </span>

          <h1 className="text-5xl font-black uppercase leading-[0.95] tracking-tight text-white md:text-7xl">
            Cada clase.
            <br />
            <span className="text-lime">Cada sede.</span>
            <br />
            En orden.
          </h1>

          <p className="mt-6 max-w-lg text-lg leading-relaxed text-white/60">
            ReserveOS es el sistema operativo para estudios de pilates y
            fitness: reservas, membresías, pagos, clientas y varias sedes en
            un solo lugar. Nace del software que ya corre un estudio real,
            no de una plantilla.
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
              className="press-spring rounded-full border border-white/20 px-7 py-3.5 text-sm font-medium text-white transition-colors duration-200 hover:border-white/40"
            >
              Ver cómo funciona
            </a>
          </div>

          <dl className="mt-14 grid max-w-md grid-cols-3 gap-6 border-t border-white/10 pt-8">
            <div>
              <dt className="text-2xl font-bold text-white">26</dt>
              <dd className="mt-1 text-xs text-white/45">
                Módulos activables
              </dd>
            </div>
            <div>
              <dt className="text-2xl font-bold text-white">Multi</dt>
              <dd className="mt-1 text-xs text-white/45">Sedes por tenant</dd>
            </div>
            <div>
              <dt className="text-2xl font-bold text-white">100%</dt>
              <dd className="mt-1 text-xs text-white/45">
                Reservas y cobros en un lugar
              </dd>
            </div>
          </dl>
        </Reveal>

        <Reveal delay={150} className="relative">
          {/*
            Imagen generada con IA (Media.io, prompt original propio) como
            placeholder de alto nivel. Reemplazar por fotografía propia del
            estudio en cuanto haya uno autorizado.
          */}
          <div className="relative rounded-[2rem] border border-white/10 bg-void-card p-2 shadow-[0_30px_80px_-20px_rgba(198,255,58,0.15)]">
            <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[1.6rem] bg-void">
              <Image
                src="/generated/dauq0phg965g7gaunvh0.jpeg"
                alt="Clienta entrenando en reformer de pilates, iluminación dramática"
                fill
                sizes="(min-width: 768px) 40vw, 90vw"
                className="object-cover"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-void/70 via-transparent to-transparent" />
              <span className="absolute bottom-3 right-3 rounded-full bg-black/40 px-2 py-0.5 text-[10px] text-white/50 backdrop-blur-sm">
                Imagen generada con IA
              </span>
            </div>
          </div>

          <div className="absolute -bottom-6 left-6 right-6 rounded-2xl border border-white/10 bg-void-card/95 p-5 shadow-[0_20px_50px_-16px_rgba(0,0,0,0.6)] backdrop-blur-xl">
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
    </section>
  );
}
