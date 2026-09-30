import Image from "next/image";
import Reveal from "./reveal";

export default function Hero() {
  return (
    <section
      id="producto"
      className="relative overflow-hidden"
      style={{
        backgroundImage:
          "radial-gradient(circle at 1px 1px, rgba(17,17,17,0.07) 1px, transparent 0)",
        backgroundSize: "28px 28px",
        backgroundPosition: "-14px -14px",
      }}
    >
      <div
        className="pointer-events-none absolute -top-40 right-[-10%] h-[520px] w-[520px] rounded-full opacity-50 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(47,111,237,0.35), rgba(31,157,85,0.2) 60%, transparent 75%)",
        }}
      />
      <div className="relative mx-auto grid max-w-6xl gap-12 px-6 pt-16 pb-20 md:grid-cols-[1.1fr_0.9fr] md:pt-24 md:pb-28">
        <Reveal className="flex flex-col justify-center">
          <span className="mb-6 inline-flex w-fit items-center gap-2 rounded-full bg-sage-tint px-3 py-1 text-xs font-medium text-sage">
            <span className="h-1.5 w-1.5 rounded-full bg-sage" />
            Construido para estudios de pilates y fitness
          </span>

          <h1 className="font-serif text-4xl leading-[1.05] tracking-tight text-ink md:text-6xl">
            Cada clase, cada sede,
            <br />
            <em className="text-ink">en orden.</em>
          </h1>

          <p className="mt-6 max-w-lg text-lg leading-relaxed text-ink/70">
            ReserveOS es el sistema operativo para estudios de pilates y
            fitness: reservas, membresías, pagos, clientas y varias sedes en
            un solo lugar. Nace del software que ya corre un estudio real,
            no de una plantilla.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-4">
            <a
              href="#contacto"
              className="press-spring group inline-flex items-center gap-3 rounded-full bg-peach py-2 pl-7 pr-2 text-sm font-medium text-white shadow-[0_16px_32px_-12px_rgba(47,111,237,0.6)] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:shadow-[0_20px_40px_-10px_rgba(47,111,237,0.7)]"
            >
              Agendar una demo
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-0.5">
                →
              </span>
            </a>
            <a
              href="#modulos"
              className="press-spring rounded-full border border-ink/15 bg-white/40 px-7 py-3.5 text-sm font-medium text-ink backdrop-blur-sm transition-colors duration-200 hover:border-ink/30"
            >
              Ver cómo funciona
            </a>
          </div>

          <dl className="mt-14 grid max-w-md grid-cols-3 gap-6 border-t border-black/[0.06] pt-8">
            <div>
              <dt className="font-serif text-2xl text-ink">26</dt>
              <dd className="mt-1 text-xs text-ink/60">
                Módulos activables
              </dd>
            </div>
            <div>
              <dt className="font-serif text-2xl text-ink">Multi</dt>
              <dd className="mt-1 text-xs text-ink/60">Sedes por tenant</dd>
            </div>
            <div>
              <dt className="font-serif text-2xl text-ink">100%</dt>
              <dd className="mt-1 text-xs text-ink/60">
                Reservas y cobros en un lugar
              </dd>
            </div>
          </dl>
        </Reveal>

        <Reveal delay={150} className="relative">
          {/*
            Foto de stock con licencia Unsplash (uso comercial libre),
            no de VIM ni de ningún estudio cliente. Reemplazar por
            fotografía propia en cuanto haya un estudio autorizado.
            Crédito: Roxana Popovici (@roxanarxx) / Unsplash.
          */}
          <div className="relative rounded-[2rem] border border-white/50 bg-white/30 p-2 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_30px_60px_-20px_rgba(17,17,17,0.25)] backdrop-blur-xl">
            <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[1.6rem] bg-ink">
              <Image
                src="https://images.unsplash.com/photo-1747238415033-b74eec07eb59?fm=jpg&q=80&w=900&auto=format&fit=crop"
                alt="Clienta haciendo pilates reformer en un estudio real"
                fill
                sizes="(min-width: 768px) 40vw, 90vw"
                className="object-cover"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/50 via-transparent to-transparent" />
              <span className="absolute bottom-3 right-3 rounded-full bg-black/25 px-2 py-0.5 text-[10px] text-cream/70 backdrop-blur-sm">
                Foto: Roxana Popovici / Unsplash
              </span>
            </div>
          </div>

          <div className="absolute -bottom-6 left-6 right-6 rounded-2xl border border-white/50 bg-card/90 p-5 shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_20px_40px_-16px_rgba(17,17,17,0.3)] backdrop-blur-xl">
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink/60">Reformer · Sede Norte</span>
              <span className="rounded-full bg-sage-tint px-2.5 py-1 text-xs font-medium text-sage">
                8/8 cupos
              </span>
            </div>
            <div className="mt-3 flex -space-x-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <span
                  key={i}
                  className="h-7 w-7 rounded-full border-2 border-card bg-blue-tint"
                />
              ))}
              <span className="ml-3 flex items-center text-xs text-ink/50">
                lista de espera activa
              </span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
