"use client";

import { useState, useTransition } from "react";
import { asignarSede, quitarSede } from "./actions";

type Persona = {
  id: string;
  role: string;
  roleLabel: string;
  nombre: string;
  esYo: boolean;
  sedeIds: string[];
};
type Sede = { id: string; name: string };

export default function PersonalView({
  personal,
  sedes,
  puedeEditar,
}: {
  personal: Persona[];
  sedes: Sede[];
  puedeEditar: boolean;
  esDuenaOGerente: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [agregando, setAgregando] = useState<string | null>(null);

  function agregar(membershipId: string, sedeId: string) {
    startTransition(() => {
      asignarSede(membershipId, sedeId);
    });
    setAgregando(null);
  }

  function quitar(membershipId: string, sedeId: string) {
    startTransition(() => {
      quitarSede(membershipId, sedeId);
    });
  }

  return (
    <main className="min-h-screen bg-cream">
      <header className="border-b border-white/10 bg-card px-6 py-6 md:px-10">
        <h1 className="text-2xl font-semibold text-ink md:text-3xl">
          Personal
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          {personal.length} persona{personal.length === 1 ? "" : "s"} con
          acceso a este estudio.
        </p>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8 md:px-10">
        {sedes.length === 0 && (
          <p className="mb-4 text-xs text-ink-soft">
            Todavía no hay sedes creadas en este estudio.
          </p>
        )}

        <ul className="space-y-2">
          {personal.map((p) => {
            const sedesLibres = sedes.filter((s) => !p.sedeIds.includes(s.id));
            const esGlobal = p.role === "duena" || p.role === "gerente_general";
            return (
              <li
                key={p.id}
                className="rounded-2xl border border-white/10 bg-card p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-ink">
                      {p.nombre}
                      {p.esYo && (
                        <span className="ml-2 text-xs text-ink-soft">
                          (tú)
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-ink-soft">{p.roleLabel}</p>
                  </div>

                  {esGlobal ? (
                    <span className="rounded-full bg-sage-tint px-3 py-1 text-xs font-medium text-sage">
                      Todas las sedes
                    </span>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      {p.sedeIds.map((sid) => {
                        const sede = sedes.find((s) => s.id === sid);
                        return (
                          <span
                            key={sid}
                            className="flex items-center gap-1.5 rounded-full bg-neutral-tint px-3 py-1 text-xs text-ink-soft"
                          >
                            {sede?.name ?? sid}
                            {puedeEditar && (
                              <button
                                disabled={isPending}
                                onClick={() => quitar(p.id, sid)}
                                className="text-ink-soft/60 hover:text-ink"
                                aria-label="Quitar sede"
                              >
                                ×
                              </button>
                            )}
                          </span>
                        );
                      })}

                      {puedeEditar &&
                        sedesLibres.length > 0 &&
                        (agregando === p.id ? (
                          <select
                            autoFocus
                            defaultValue=""
                            onChange={(e) => {
                              if (e.target.value) agregar(p.id, e.target.value);
                            }}
                            onBlur={() => setAgregando(null)}
                            className="rounded-full border border-white/15 bg-cream px-2 py-1 text-xs text-ink"
                          >
                            <option value="" disabled>
                              Elegir sede…
                            </option>
                            {sedesLibres.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <button
                            onClick={() => setAgregando(p.id)}
                            className="rounded-full border border-dashed border-white/20 px-3 py-1 text-xs text-ink-soft hover:text-ink"
                          >
                            + sede
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <p className="mt-8 text-xs text-ink-soft">
          Para dar de alta a una persona nueva, pedile al equipo de ReserveOS
          que la invite — todavía no hay invitación de personal propia desde
          el panel.
        </p>
      </div>
    </main>
  );
}
