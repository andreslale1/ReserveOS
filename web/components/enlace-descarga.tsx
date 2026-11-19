import type { ReactNode } from "react";

// Descarga de un archivo generado en el servidor (CSV, etc.): es una ruta de servidor, no una página, así que no usa <Link>.
export function EnlaceDescarga({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  // eslint-disable-next-line @next/next/no-html-link-for-pages -- descarga de archivo
  return <a href={href} className={className} download>{children}</a>;
}
