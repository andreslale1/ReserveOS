import Link from "next/link";
import Reveal from "@/components/reveal";

type Clase = {
  id: string;
  nombre: string;
  horaInicio: string;
  horaFin: string;
  cupoMaximo: number;
  sede: string;
  instructora: string;
  ocupados: number;
  clientas: (string | undefined)[];
};

function estadoCupo(ocupados: number, max: number) {
  const libres = max - ocupados;
  if (libres <= 0) {
    return { label: "Lleno", className: "bg-sage-tint text-sage" };
  }
  if (libres <= 2) {
    return {
      label: `${libres} ${libres === 1 ? "cupo" : "cupos"}`,
      className: "bg-peach-tint text-ink",
    };
  }
  return {
    label: `${libres} cupos libres`,
    className: "bg-neutral-tint text-ink/55",
  };
}

type DiaSemana = { fecha: string; clases: { hora: string; nombre: string; sede: string }[] };
type CeldaMes = { fecha: string; n: number } | null;
const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const sumarDias = (iso: string, d: number) => { const x = new Date(iso + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + d); return x.toISOString().slice(0, 10); };
const sumarMes = (iso: string, m: number) => { const x = new Date(iso + "T00:00:00Z"); x.setUTCMonth(x.getUTCMonth() + m, 1); return x.toISOString().slice(0, 10); };

export default function TodayView({
  vista,
  hoy,
  semana,
  mes,
  nombre,
  rol,
  tenantName,
  fecha,
  clases,
}: {
  vista: "dia" | "semana" | "mes";
  hoy: string;
  semana: DiaSemana[];
  mes: CeldaMes[];
  nombre: string;
  rol: string;
  tenantName: string;
  fecha: string;
  clases: Clase[];
}) {
  const fechaLegible = new Date(fecha + "T00:00:00").toLocaleDateString(
    "es-GT",
    { weekday: "long", day: "numeric", month: "long" },
  );

  const totalReservas = clases.reduce((acc, c) => acc + c.ocupados, 0);
  const totalCupos = clases.reduce((acc, c) => acc + c.cupoMaximo, 0);
  const ocupacionPct = totalCupos
    ? Math.round((totalReservas / totalCupos) * 100)
    : 0;

  return (
    <main className="min-h-screen bg-cream">
      <header className="border-b border-white/10 bg-card px-6 py-6 md:px-10">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-ink/45">
              {tenantName} · {rol}
            </p>
            <h1 className="mt-1 font-serif text-2xl text-ink md:text-3xl">
              Buenas, {nombre.split(" ")[0]}.
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex overflow-hidden rounded-full border border-white/15 text-sm" role="tablist" aria-label="Vista">
              {([["dia", "Día"], ["semana", "Semana"], ["mes", "Mes"]] as const).map(([v, etiqueta]) => (
                <Link key={v} href={`/panel/hoy?vista=${v}&f=${fecha}`} role="tab" aria-selected={vista === v}
                  className={`px-4 py-1.5 ${vista === v ? "bg-ink text-cream" : "text-ink/60 hover:text-ink"}`}>{etiqueta}</Link>
              ))}
            </div>
            <Link href="/panel/calendario" className="press-spring rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-cream shadow-[0_8px_20px_-6px_rgba(17,17,17,0.35)] transition-colors duration-200 hover:bg-ink/90">
              + Nueva reserva
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8 md:px-10">
        <div className="mb-4 flex items-center gap-2 text-sm">
          <Link href={`/panel/hoy?vista=${vista}&f=${vista === "mes" ? sumarMes(fecha, -1) : sumarDias(fecha, vista === "semana" ? -7 : -1)}`} className="rounded-full border border-white/15 px-3 py-1 text-ink/70 hover:text-ink" aria-label="Anterior">←</Link>
          <Link href={`/panel/hoy?vista=${vista}&f=${hoy}`} className="rounded-full border border-white/15 px-3 py-1 text-ink/70 hover:text-ink">Hoy</Link>
          <Link href={`/panel/hoy?vista=${vista}&f=${vista === "mes" ? sumarMes(fecha, 1) : sumarDias(fecha, vista === "semana" ? 7 : 1)}`} className="rounded-full border border-white/15 px-3 py-1 text-ink/70 hover:text-ink" aria-label="Siguiente">→</Link>
        </div>

        {vista === "semana" && (
          <ul className="grid gap-3">
            {semana.map((d, i) => (
              <li key={d.fecha} className="rounded-2xl border border-white/10 bg-card p-4">
                <div className="flex items-center justify-between">
                  <Link href={`/panel/hoy?vista=dia&f=${d.fecha}`} className="text-sm font-medium capitalize text-ink hover:underline">{DIAS[i]} {Number(d.fecha.slice(8))}{d.fecha === hoy ? " · hoy" : ""}</Link>
                  <span className="text-xs text-ink/50">{d.clases.length} {d.clases.length === 1 ? "clase" : "clases"}</span>
                </div>
                {d.clases.length > 0 && <p className="mt-2 text-xs text-ink/60">{d.clases.map((c) => `${c.hora} ${c.nombre}${c.sede ? ` (${c.sede})` : ""}`).join(" · ")}</p>}
              </li>
            ))}
          </ul>
        )}

        {vista === "mes" && (
          <div>
            <h2 className="mb-3 font-serif text-xl capitalize text-ink">{new Date(fecha + "T00:00:00").toLocaleDateString("es-GT", { month: "long", year: "numeric" })}</h2>
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-ink/50">{DIAS.map((d) => <span key={d}>{d}</span>)}</div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {mes.map((c, i) => c ? (
                <Link key={c.fecha} href={`/panel/hoy?vista=dia&f=${c.fecha}`}
                  className={`flex min-h-16 flex-col rounded-xl border p-2 text-left text-sm hover:border-white/30 ${c.fecha === hoy ? "border-ink" : "border-white/10"} bg-card`}>
                  <span className="text-ink">{Number(c.fecha.slice(8))}</span>
                  {c.n > 0 && <span className="mt-auto text-[11px] text-ink/55">{c.n} {c.n === 1 ? "clase" : "clases"}</span>}
                </Link>
              ) : <span key={`v${i}`} />)}
            </div>
          </div>
        )}

        {vista === "dia" && (<>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-serif text-xl capitalize text-ink">
            {fechaLegible}
          </h2>
          <p className="text-sm text-ink/50">
            {clases.length} clases · {totalReservas} reservas ·{" "}
            {ocupacionPct}% ocupación
          </p>
        </div>

        {clases.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-ink/15 bg-card p-10 text-center">
            <p className="font-serif text-lg text-ink">
              No hay clases programadas para hoy.
            </p>
            <p className="mt-1 text-sm text-ink/55">
              Cuando se agende un horario para este día, va a aparecer aquí.
            </p>
          </div>
        ) : (
          <ul className="mt-6 space-y-3">
            {clases.map((c, i) => {
              const estado = estadoCupo(c.ocupados, c.cupoMaximo);
              return (
                <Reveal key={c.id} delay={i * 60}>
                  <li className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-card p-5 shadow-[0_2px_8px_-4px_rgba(17,17,17,0.08)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:shadow-[0_16px_28px_-12px_rgba(17,17,17,0.18)]">
                    <div className="flex items-center gap-5">
                      <div className="w-14 text-center">
                        <p className="font-serif text-lg text-blue">
                          {c.horaInicio}
                        </p>
                        <p className="text-xs text-ink/40">{c.horaFin}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-ink">
                          {c.nombre}
                        </p>
                        <p className="text-xs text-ink/55">
                          {c.instructora} · {c.sede}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <Link
                        href={`/panel/clase/${c.id}/${fecha}`}
                        className="rounded-full border border-white/15 px-3 py-1 text-xs text-ink/70 hover:text-ink"
                      >
                        Abrir clase
                      </Link>
                      <div className="flex -space-x-2">
                        {c.clientas.slice(0, 4).map((nombreClienta, j) => (
                          <span
                            key={j}
                            title={nombreClienta}
                            className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-blue-tint text-[10px] font-medium text-ink/60 shadow-[0_1px_2px_rgba(17,17,17,0.15)]"
                          >
                            {nombreClienta?.charAt(0) ?? "?"}
                          </span>
                        ))}
                        {c.clientas.length > 4 && (
                          <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-ink text-[10px] font-medium text-cream">
                            +{c.clientas.length - 4}
                          </span>
                        )}
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${estado.className}`}
                      >
                        {estado.label}
                      </span>
                      <span className="w-10 text-right text-xs tabular-nums text-ink/40">
                        {c.ocupados}/{c.cupoMaximo}
                      </span>
                    </div>
                  </li>
                </Reveal>
              );
            })}
          </ul>
        )}
        </>)}
      </div>
    </main>
  );
}
