"use client";

import { useEffect, useRef } from "react";

// Muestra el widget REAL de ReserveOS funcionando (el mismo que un gimnasio pega en su web), con un estudio de demostración.
export default function WidgetVivo({ estudio = "atlas-demo" }: { estudio?: string }) {
  const destino = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = destino.current;
    if (!el || el.dataset.listo) return;
    el.dataset.listo = "1";
    const s = document.createElement("script");
    s.src = "/widget.js";
    s.async = true;
    s.setAttribute("data-estudio", estudio);
    s.setAttribute("data-destino", "#widget-vivo-destino");
    document.body.appendChild(s);
    return () => { s.remove(); };
  }, [estudio]);
  return <div id="widget-vivo-destino" ref={destino} className="min-h-72" aria-label="Widget de reservas de ejemplo" />;
}
