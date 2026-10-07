"use client";

import { useId, type ReactNode } from "react";

export const inputOwner =
  "w-full rounded-lg border border-white/25 bg-void px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-lime focus-visible:ring-2 focus-visible:ring-lime/60 aria-[invalid=true]:border-red-400";

type Props = {
  label: string;
  requerido?: boolean;
  ayuda?: string;
  error?: string | null;
  className?: string;
  children: (p: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean; "aria-required"?: boolean; required?: boolean }) => ReactNode;
};

// Etiqueta visible asociada al control, marca de requerido/opcional, ayuda y error anunciado a lector de pantalla.
export function Campo({ label, requerido, ayuda, error, className = "", children }: Props) {
  const id = useId();
  const desc = [ayuda ? `${id}-ayuda` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={id} className="text-xs font-medium text-white/80">
        {label} <span className={requerido ? "text-lime" : "text-white/55"}>{requerido ? "(obligatorio)" : "(opcional)"}</span>
      </label>
      {children({ id, "aria-describedby": desc, "aria-invalid": error ? true : undefined, "aria-required": requerido || undefined })}
      {ayuda && <p id={`${id}-ayuda`} className="text-xs text-white/60">{ayuda}</p>}
      {error && <p id={`${id}-error`} role="alert" className="text-xs text-red-300">{error}</p>}
    </div>
  );
}

// Enfoca el primer control inválido de un formulario (llamar tras fallar la validación).
export function enfocarPrimerError(form: HTMLElement | null) {
  form?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
}
