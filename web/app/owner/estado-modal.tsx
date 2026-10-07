"use client";

import { useState, useTransition } from "react";
import { cambiarEstadoEstudio } from "./actions";

// Flujo ÚNICO para cambiar el estado de un estudio (Estudios, ficha y Cobros lo reutilizan).
export const ESTADOS = ["borrador", "en_implantacion", "activo", "pausado", "suspendido", "cancelado"] as const;

export const ESTADO_LABEL: Record<string, { label: string; className: string }> = {
  borrador: { label: "Borrador", className: "bg-white/10 text-white/60" },
  en_implantacion: { label: "En implantación", className: "bg-sky-500/15 text-sky-300" },
  activo: { label: "Activo", className: "bg-lime/15 text-lime" },
  pausado: { label: "Pausado", className: "bg-yellow-500/15 text-yellow-300" },
  suspendido: { label: "Suspendido", className: "bg-orange-500/15 text-orange-300" },
  cancelado: { label: "Cancelado", className: "bg-white/10 text-white/50" },
};

const CONSECUENCIAS: Record<string, string[]> = {
  pausado: [
    "Se bloquean nuevas reservas, ventas de paquetes y altas de clientas.",
    "La configuración sigue editable; la dueña y su equipo conservan lectura y exportación.",
  ],
  suspendido: [
    "Se bloquean nuevas reservas, ventas, altas de clientas y cambios de configuración (horarios, paquetes, sedes).",
    "La dueña y su equipo conservan lectura y exportación de sus datos; los pagos ya iniciados se siguen confirmando.",
    "La página pública del estudio deja de mostrarse.",
  ],
  cancelado: [
    "Mismo bloqueo que suspender, como cierre del servicio.",
    "Los datos se conservan; se puede reactivar con motivo registrado.",
  ],
  activo: ["El estudio vuelve a operar con normalidad y su página pública se muestra."],
  borrador: ["El estudio queda en preparación; no es público."],
  en_implantacion: ["El estudio queda en preparación; su equipo puede configurarlo, pero no es público."],
};

export function EstadoModal({
  tenant,
  destino,
  onClose,
  onDone,
}: {
  tenant: { id: string; name: string };
  destino: string;
  onClose: () => void;
  onDone?: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const grave = destino === "suspendido" || destino === "cancelado";
  const exigeMotivo = grave || destino === "pausado";
  const etiqueta = ESTADO_LABEL[destino]?.label ?? destino;
  const listo = (!exigeMotivo || motivo.trim().length >= 5) && (!grave || nombre.trim() === tenant.name);

  function confirmar() {
    setError(null);
    startTransition(async () => {
      const r = await cambiarEstadoEstudio(tenant.id, destino, motivo.trim());
      if (r.error) {
        setError(r.error);
        return;
      }
      onDone?.();
      onClose();
    });
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="estado-titulo" className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/15 bg-void-card p-6">
        <h2 id="estado-titulo" className="text-lg font-bold text-white">
          Cambiar {tenant.name} a «{etiqueta}»
        </h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-white/70">
          {(CONSECUENCIAS[destino] ?? []).map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <label className="mt-4 block text-sm text-white/70">
          Motivo {exigeMotivo ? "(obligatorio)" : "(opcional)"}
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-lg border border-white/15 bg-void px-3 py-2 text-white outline-none focus:border-lime/50"
          />
        </label>
        {grave && (
          <label className="mt-3 block text-sm text-white/70">
            Para confirmar, escribe el nombre del estudio: <span className="font-semibold text-white">{tenant.name}</span>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/15 bg-void px-3 py-2 text-white outline-none focus:border-lime/50"
            />
          </label>
        )}
        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} disabled={isPending} className="rounded-full border border-white/15 px-4 py-2 text-sm text-white/70 hover:text-white disabled:opacity-50">
            Cancelar
          </button>
          <button onClick={confirmar} disabled={isPending || !listo} className="press-spring rounded-full bg-white px-5 py-2 text-sm font-bold text-void disabled:opacity-50">
            {isPending ? "Aplicando…" : `Confirmar ${etiqueta.toLowerCase()}`}
          </button>
        </div>
      </div>
    </div>
  );
}
