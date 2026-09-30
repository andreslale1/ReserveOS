import { Fragment } from "react";
import Reveal from "@/components/reveal";

type Celda = {
  hora: string;
  recurso: string | null;
  nombre: string;
  clientas: string[];
  cupoMaximo: number;
};

const COLORES = [
  { bg: "bg-sage-tint", text: "text-sage", border: "border-sage/20" },
  { bg: "bg-blue-tint", text: "text-blue", border: "border-blue/20" },
  { bg: "bg-peach-tint", text: "text-ink", border: "border-peach/30" },
];

export default function CalendarioView({
  fecha,
  recursos,
  horas,
  celdas,
}: {
  fecha: string;
  recursos: [string | null, string][];
  horas: string[];
  celdas: Celda[];
}) {
  const fechaLegible = new Date(fecha + "T00:00:00").toLocaleDateString(
    "es-GT",
    { weekday: "long", day: "numeric", month: "long" },
  );

  return (
    <main className="min-h-screen bg-cream">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-black/[0.06] bg-card px-6 py-6 md:px-10">
        <div>
          <h1 className="font-serif text-2xl text-ink md:text-3xl">
            Calendario
          </h1>
          <p className="mt-1 text-sm capitalize text-ink/60">
            {fechaLegible}
          </p>
        </div>
        <div className="flex overflow-hidden rounded-full border border-black/10 text-sm">
          {["Día", "Semana", "Mes"].map((v, i) => (
            <span
              key={v}
              className={`px-4 py-1.5 ${i === 0 ? "bg-ink text-cream" : "text-ink/50"}`}
            >
              {v}
            </span>
          ))}
        </div>
      </header>

      <div className="overflow-x-auto px-6 py-8 md:px-10">
        <Reveal>
          <div
            className="grid min-w-[720px] gap-px overflow-hidden rounded-2xl border border-black/[0.06] bg-black/[0.06]"
            style={{
              gridTemplateColumns: `88px repeat(${recursos.length || 1}, 1fr)`,
            }}
          >
            <div className="bg-card" />
            {recursos.map(([id, nombre]) => (
              <div
                key={id}
                className="bg-card px-4 py-3 text-sm font-medium text-ink"
              >
                {nombre}
              </div>
            ))}
            {recursos.length === 0 && (
              <div className="bg-card px-4 py-3 text-sm text-ink/40">
                Sin instructoras asignadas
              </div>
            )}

            {horas.map((hora) => (
              <Fragment key={hora}>
                <div className="bg-cream px-3 py-4 text-xs text-ink/45">
                  {hora}
                </div>
                {(recursos.length ? recursos : [[null, ""]]).map(
                  ([recursoId], ci) => {
                    const celda = celdas.find(
                      (c) => c.hora === hora && c.recurso === recursoId,
                    );
                    const color = COLORES[ci % COLORES.length];
                    return (
                      <div
                        key={`${hora}-${recursoId}`}
                        className="min-h-[64px] bg-card p-1.5"
                      >
                        {celda ? (
                          <div
                            className={`h-full rounded-lg border p-2 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 ${color.bg} ${color.border}`}
                          >
                            <p className={`text-xs font-medium ${color.text}`}>
                              {celda.nombre}
                            </p>
                            <p className="mt-0.5 text-[11px] text-ink/50">
                              {celda.clientas.length}/{celda.cupoMaximo}
                              {celda.clientas[0]
                                ? ` · ${celda.clientas[0]}${celda.clientas.length > 1 ? " +" + (celda.clientas.length - 1) : ""}`
                                : ""}
                            </p>
                          </div>
                        ) : (
                          <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-ink/10 text-ink/20">
                            +
                          </div>
                        )}
                      </div>
                    );
                  },
                )}
              </Fragment>
            ))}
          </div>
        </Reveal>
      </div>
    </main>
  );
}
