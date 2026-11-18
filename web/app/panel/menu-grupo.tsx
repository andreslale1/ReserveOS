"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

// Menú desplegable agrupado, como el admin de Forma: se abre al tocar y se cierra al tocar fuera o al elegir.
export default function MenuGrupo({ titulo, enlaces }: { titulo: string; enlaces: { href: string; label: string }[] }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setAbierto(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setAbierto(false); };
    document.addEventListener("mousedown", fuera); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", fuera); document.removeEventListener("keydown", esc); };
  }, [abierto]);
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-expanded={abierto} onClick={() => setAbierto(!abierto)} className="press-spring flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-void/90 hover:bg-void/10 hover:text-void">
        {titulo} <span aria-hidden className="text-[8px]">{abierto ? "▲" : "▼"}</span>
      </button>
      {abierto && (
        <div role="menu" className="menu-in absolute left-0 top-full z-50 mt-1 min-w-56 rounded-xl border border-line bg-void-card py-2 shadow-[0_18px_36px_-18px_rgba(27,37,48,0.35)]">
          {enlaces.map((l) => (
            <Link key={l.href} href={l.href} role="menuitem" onClick={() => setAbierto(false)} className="block px-4 py-2 text-sm text-ink/80 transition-colors duration-100 hover:bg-peach-tint hover:text-ink">{l.label}</Link>
          ))}
        </div>
      )}
    </div>
  );
}
