"use client";

import { useEffect, useRef, type ReactNode } from "react";

// Modal accesible (dialog nativo: atrapa el foco, Esc cierra, devuelve el foco al abrirse desde un botón).
export function Confirmar({ abierto, titulo, children, confirmar = "Confirmar", cancelar = "Cancelar", peligro, cargando, onConfirmar, onCancelar }: {
  abierto: boolean; titulo: string; children?: ReactNode; confirmar?: string; cancelar?: string; peligro?: boolean; cargando?: boolean;
  onConfirmar: () => void; onCancelar: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierto && !d.open) d.showModal();
    if (!abierto && d.open) d.close();
  }, [abierto]);
  return (
    <dialog ref={ref} onCancel={(e) => { e.preventDefault(); if (!cargando) onCancelar(); }} aria-labelledby="confirmar-titulo"
      className="m-auto w-[min(92vw,28rem)] rounded-2xl border border-white/20 bg-void-card p-6 text-white backdrop:bg-black/70">
      <h2 id="confirmar-titulo" className="text-lg font-semibold">{titulo}</h2>
      <div className="mt-2 text-sm text-white/75">{children}</div>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className="rounded-full border border-white/25 px-4 py-2 text-sm text-white/80 hover:text-white disabled:opacity-50" disabled={cargando} onClick={onCancelar}>{cancelar}</button>
        <button type="button" disabled={cargando} onClick={onConfirmar}
          className={`rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50 ${peligro ? "bg-red-400 text-void" : "bg-lime text-void"}`}>{cargando ? "Procesando…" : confirmar}</button>
      </div>
    </dialog>
  );
}
