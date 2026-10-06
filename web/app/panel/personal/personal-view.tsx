"use client";

import { useState, useTransition } from "react";
import { asignarSede, crearInvitacionPersonal, quitarSede } from "./actions";

type Persona = {
  id: string;
  role: string;
  roleLabel: string;
  nombre: string;
  esYo: boolean;
  sedeIds: string[];
};
type Sede = { id: string; name: string };

const ROLES_INVITABLES: { value: string; label: string }[] = [
  { value: "gerente_general", label: "Gerente general" },
  { value: "gerente_regional", label: "Gerencia regional (varias sedes)" },
  { value: "admin_sede", label: "Administradora de sede" },
  { value: "recepcion", label: "Recepción" },
  { value: "instructora", label: "Instructora" },
  { value: "contadora", label: "Contadora" },
  { value: "marketing", label: "Marketing del estudio" },
];

export default function PersonalView({
  personal,
  sedes,
  puedeEditar,
  tenantId,
  miRole,
}: {
  personal: Persona[];
  sedes: Sede[];
  puedeEditar: boolean;
  tenantId: string;
  miRole: string;
  esDuenaOGerente: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [agregando, setAgregando] = useState<string | null>(null);

  const rolesDisponibles =
    miRole === "admin_sede"
      ? ROLES_INVITABLES.filter((r) =>
          ["recepcion", "instructora", "contadora"].includes(r.value),
        )
      : ROLES_INVITABLES;

  const [mostrarInvitar, setMostrarInvitar] = useState(false);
  const [invEmail, setInvEmail] = useState("");
  const [invNombre, setInvNombre] = useState("");
  const [invRole, setInvRole] = useState(rolesDisponibles[0]?.value ?? "");
  const [invSedes, setInvSedes] = useState<string[]>([]);
  const [invLink, setInvLink] = useState<string | null>(null);
  const [invError, setInvError] = useState<string | null>(null);

  function invitar() {
    setInvError(null);
    startTransition(async () => {
      const res = await crearInvitacionPersonal({
        tenantId,
        email: invEmail,
        role: invRole,
        nombre: invNombre,
        sedeIds: invSedes,
      });
      if (res.error) {
        setInvError(res.error);
      } else {
        setInvLink(`${window.location.origin}/invitar/personal/${res.token}`);
      }
    });
  }

  function resetInvitar() {
    setMostrarInvitar(false);
    setInvEmail("");
    setInvNombre("");
    setInvSedes([]);
    setInvLink(null);
    setInvError(null);
  }

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
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 bg-card px-6 py-6 md:px-10">
        <div>
          <h1 className="text-2xl font-semibold text-ink md:text-3xl">
            Personal
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            {personal.length} persona{personal.length === 1 ? "" : "s"} con
            acceso a este estudio.
          </p>
        </div>
        {puedeEditar && (
          <button
            onClick={() => (mostrarInvitar ? resetInvitar() : setMostrarInvitar(true))}
            className="press-spring rounded-full bg-ink px-5 py-2 text-sm font-medium text-cream"
          >
            {mostrarInvitar ? "Cancelar" : "+ Invitar personal"}
          </button>
        )}
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8 md:px-10">
        {mostrarInvitar && (
          <div className="mb-6 rounded-2xl border border-white/10 bg-card p-5">
            {invLink ? (
              <div>
                <p className="text-sm font-medium text-ink">
                  Invitación creada — mandale este link por WhatsApp o correo:
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    readOnly
                    value={invLink}
                    className="w-full rounded-lg border border-white/15 bg-cream px-3 py-2 text-xs text-ink"
                    onFocus={(e) => e.target.select()}
                  />
                  <button
                    onClick={() => navigator.clipboard.writeText(invLink)}
                    className="shrink-0 rounded-full border border-white/15 px-3 py-2 text-xs text-ink-soft hover:text-ink"
                  >
                    Copiar
                  </button>
                </div>
                <button
                  onClick={resetInvitar}
                  className="mt-4 text-xs text-ink-soft underline"
                >
                  Invitar a alguien más
                </button>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm text-ink-soft">
                  Nombre
                  <input
                    type="text"
                    value={invNombre}
                    onChange={(e) => setInvNombre(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/15 bg-cream px-3 py-2 text-ink outline-none"
                  />
                </label>
                <label className="text-sm text-ink-soft">
                  Correo
                  <input
                    type="email"
                    value={invEmail}
                    onChange={(e) => setInvEmail(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/15 bg-cream px-3 py-2 text-ink outline-none"
                  />
                </label>
                <label className="text-sm text-ink-soft">
                  Rol
                  <select
                    value={invRole}
                    onChange={(e) => setInvRole(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/15 bg-cream px-3 py-2 text-ink outline-none"
                  >
                    {rolesDisponibles.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </label>
                {sedes.length > 0 && invRole !== "gerente_general" && (
                  <div className="text-sm text-ink-soft">
                    Sedes
                    <div className="mt-1 flex flex-wrap gap-2">
                      {sedes.map((s) => (
                        <label
                          key={s.id}
                          className={`cursor-pointer rounded-full border px-3 py-1 text-xs ${
                            invSedes.includes(s.id)
                              ? "border-ink bg-ink text-cream"
                              : "border-white/15 text-ink-soft"
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="hidden"
                            checked={invSedes.includes(s.id)}
                            onChange={(e) =>
                              setInvSedes((prev) =>
                                e.target.checked
                                  ? [...prev, s.id]
                                  : prev.filter((id) => id !== s.id),
                              )
                            }
                          />
                          {s.name}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <div className="sm:col-span-2">
                  <button
                    onClick={invitar}
                    disabled={isPending || !invNombre || !invEmail}
                    className="press-spring rounded-full bg-ink px-6 py-2.5 text-sm font-medium text-cream disabled:opacity-50"
                  >
                    {isPending ? "Creando…" : "Crear invitación"}
                  </button>
                  {invError && (
                    <span className="ml-4 text-sm text-red-500">
                      {invError}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

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

        {puedeEditar && !mostrarInvitar && (
          <p className="mt-8 text-xs text-ink-soft">
            ¿Falta alguien? Usá &quot;+ Invitar personal&quot; arriba.
          </p>
        )}
      </div>
    </main>
  );
}
