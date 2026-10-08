"use client";

import { useEffect, useState } from "react";
import { formatoFecha, parseFecha } from "./fechas";

// Campo de fecha en formato dd/mm/aaaa (el <input type="date"> del navegador muestra mm/dd/aaaa según el idioma del sistema).
// `value` y `onChange` usan "aaaa-mm-dd" (o "" si está vacío / incompleto).
export default function CampoFecha({ value, onChange, className, id, requerido, ariaLabel }: {
  value: string; onChange: (iso: string) => void; className?: string; id?: string; requerido?: boolean; ariaLabel?: string;
}) {
  const [texto, setTexto] = useState(value ? formatoFecha(value) : "");
  useEffect(() => { setTexto(value ? formatoFecha(value) : ""); }, [value]);
  const invalido = texto.trim() !== "" && parseFecha(texto) === "";
  return (
    <input
      id={id} inputMode="numeric" placeholder="dd/mm/aaaa" maxLength={10} autoComplete="off" required={requerido} aria-label={ariaLabel}
      aria-invalid={invalido || undefined} className={`${className ?? ""} ${invalido ? "border-red-400/70" : ""}`} value={texto}
      onChange={(e) => {
        // Mientras se escribe solo con números, se ponen las barras solas: 0810 → 08/10/…
        let v = e.target.value;
        if (/^\d+$/.test(v) && v.length > 2) v = v.length <= 4 ? `${v.slice(0, 2)}/${v.slice(2)}` : `${v.slice(0, 2)}/${v.slice(2, 4)}/${v.slice(4, 8)}`;
        setTexto(v); onChange(parseFecha(v));
      }}
    />
  );
}
