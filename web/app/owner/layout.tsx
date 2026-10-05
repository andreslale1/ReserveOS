import Link from "next/link";
import { getOwnerContext } from "@/lib/owner-context";

const LINKS = [
  { href: "/owner", label: "Estudios", roles: ["operador", "soporte"] },
  { href: "/owner/pipeline", label: "Pipeline", roles: ["operador", "ventas"] },
  { href: "/owner/cobros", label: "Cobros", roles: ["operador", "finanzas", "soporte"] },
];

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const { operador } = await getOwnerContext();
  const rol = (operador as { rol?: string }).rol ?? "operador";

  return (
    <div className="min-h-screen bg-void text-white">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-void-card px-6 py-4 md:px-10">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-lime text-xs font-black text-void">
            R
          </span>
          <span className="text-sm font-semibold uppercase tracking-wide text-white">
            ReserveOS · Operador
          </span>
        </div>
        <div className="flex items-center gap-5 text-sm text-white/50">
          {LINKS.filter((l) => l.roles.includes(rol)).map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-white">
              {l.label}
            </Link>
          ))}
          <span>
            {operador.nombre ?? "Operador"} · {rol}
          </span>
        </div>
      </header>
      {children}
    </div>
  );
}
