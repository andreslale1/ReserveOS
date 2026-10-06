import Link from "next/link";
import { getOwnerContext } from "@/lib/owner-context";

const TODOS = ["operador", "ventas", "finanzas", "soporte", "implementacion", "ingenieria", "marketing", "auditor"];
const LINKS = [
  { href: "/owner/direccion", label: "Dirección", roles: ["operador", "ventas", "finanzas", "soporte", "implementacion", "ingenieria", "marketing"] },
  { href: "/owner/pipeline", label: "Pipeline", roles: ["operador", "ventas"] },
  { href: "/owner/marketing", label: "Marketing", roles: ["operador", "marketing", "ventas"] },
  { href: "/owner/contratos", label: "Contratos", roles: ["operador", "ventas", "finanzas"] },
  { href: "/owner/tareas", label: "Tareas", roles: ["operador", "ventas", "finanzas", "soporte"] },
  { href: "/owner/activaciones", label: "Activaciones", roles: ["operador", "ventas", "soporte", "implementacion", "ingenieria"] },
  { href: "/owner", label: "Estudios", roles: ["operador", "soporte", "implementacion", "ingenieria"] },
  { href: "/owner/planes", label: "Planes", roles: ["operador", "finanzas", "ventas", "soporte"] },
  { href: "/owner/cobros", label: "Cobros", roles: ["operador", "finanzas"] },
  { href: "/owner/rentabilidad", label: "Rentabilidad", roles: ["operador", "finanzas"] },
  { href: "/owner/soporte", label: "Soporte", roles: ["operador", "soporte", "implementacion", "ingenieria"] },
  { href: "/owner/dominios", label: "Dominios", roles: ["operador", "soporte", "implementacion", "ingenieria"] },
  { href: "/owner/salud", label: "Salud", roles: ["operador", "soporte", "implementacion", "ingenieria"] },
  { href: "/owner/equipo", label: "Equipo", roles: ["operador", "auditor"] },
  { href: "/owner/auditoria", label: "Auditoría", roles: ["operador", "auditor"] },
];

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const { operador } = await getOwnerContext();
  const rol = (operador as { rol?: string }).rol ?? "operador";
  void TODOS;

  return (
    <div className="min-h-screen bg-void text-white">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-void-card px-6 py-4 md:px-10">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-lime text-xs font-black text-void">R</span>
          <span className="text-sm font-semibold uppercase tracking-wide text-white">ReserveOS · Operador</span>
        </div>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-white/50">
          {LINKS.filter((l) => l.roles.includes(rol)).map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-white">{l.label}</Link>
          ))}
          <span className="text-white/35">{operador.nombre ?? "Operador"} · {rol}</span>
        </nav>
      </header>
      {children}
    </div>
  );
}
