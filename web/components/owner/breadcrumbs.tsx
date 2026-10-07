"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NOMBRES_RUTA } from "./nav-config";

export function Breadcrumbs() {
  const ruta = usePathname();
  const partes = ruta.split("/").filter(Boolean).slice(1); // sin "owner"
  if (partes.length === 0 || (partes.length === 1 && partes[0] === "direccion")) return null;
  const migas = [{ href: "/owner/direccion", texto: "Inicio" }];
  if (NOMBRES_RUTA[partes[0]]) {
    migas.push({ href: partes[0] === "estudios" ? "/owner" : `/owner/${partes[0]}`, texto: NOMBRES_RUTA[partes[0]] });
    if (partes.length > 1) migas.push({ href: ruta, texto: "Detalle" });
  } else {
    migas.push({ href: "/owner", texto: "Estudios" }, { href: ruta, texto: "Ficha del estudio" });
  }
  return (
    <nav aria-label="Ruta de navegación" className="px-6 pt-4 text-xs text-white/65 md:px-10">
      <ol className="flex flex-wrap items-center gap-1.5">
        {migas.map((m, i) => (
          <li key={m.href} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden>/</span>}
            {i === migas.length - 1 ? <span aria-current="page" className="text-white">{m.texto}</span> : <Link href={m.href} className="hover:text-white underline-offset-2 hover:underline">{m.texto}</Link>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
