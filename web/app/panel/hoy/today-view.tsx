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

export default function TodayView({
  nombre,
  rol,
  tenantName,
  fecha,
  clases,
}: {
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

  return (
    <main className="min-h-screen bg-cream">
      <header className="border-b border-black/[0.06] bg-card px-6 py-6 md:px-10">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-ink/45">
              {tenantName} · {rol}
            </p>
            <h1 className="mt-1 font-serif text-2xl text-ink md:text-3xl">
              Buenas, {nombre.split(" ")[0]}.
            </h1>
            <p className="mt-1 text-sm capitalize text-ink/60">
              {fechaLegible}
            </p>
          </div>

          <button className="press-spring rounded-full bg-peach px-5 py-2.5 text-sm font-medium text-ink shadow-[0_8px_20px_-6px_rgba(17,17,17,0.25)] transition-colors duration-200 hover:bg-peach/85">
            + Nueva reserva
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8 md:px-10">
        <h2 className="text-sm font-medium uppercase tracking-wide text-ink/50">
          Hoy
        </h2>

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
            {clases.map((c) => {
              const lleno = c.ocupados >= c.cupoMaximo;
              return (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-black/[0.06] bg-card p-5 shadow-[0_2px_8px_-4px_rgba(17,17,17,0.08)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:shadow-[0_16px_28px_-12px_rgba(17,17,17,0.18)]"
                >
                  <div className="flex items-center gap-5">
                    <div className="text-center">
                      <p className="font-serif text-lg text-ink">
                        {c.horaInicio}
                      </p>
                      <p className="text-xs text-ink/45">{c.horaFin}</p>
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
                    <div className="flex -space-x-2">
                      {c.clientas.slice(0, 4).map((nombreClienta, i) => (
                        <span
                          key={i}
                          title={nombreClienta}
                          className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-blue-tint text-[10px] font-medium text-ink/60"
                        >
                          {nombreClienta?.charAt(0) ?? "?"}
                        </span>
                      ))}
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        lleno
                          ? "bg-neutral-tint text-ink/60"
                          : "bg-sage-tint text-sage"
                      }`}
                    >
                      {lleno
                        ? "Lleno"
                        : `${c.cupoMaximo - c.ocupados} cupos libres`}
                    </span>
                    <span className="text-xs text-ink/40">
                      {c.ocupados}/{c.cupoMaximo}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
