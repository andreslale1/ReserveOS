import Link from "next/link";

export function EstadoVacio({ titulo, texto, href, accion }: { titulo: string; texto?: string; href?: string; accion?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-white/20 px-4 py-6 text-center">
      <p className="text-sm font-medium text-white/85">{titulo}</p>
      {texto && <p className="mt-1 text-xs text-white/60">{texto}</p>}
      {href && accion && <Link href={href} className="mt-3 inline-block rounded-full bg-lime px-4 py-1.5 text-xs font-semibold text-void">{accion}</Link>}
    </div>
  );
}
