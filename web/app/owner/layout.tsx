import Link from "next/link";
import { getOwnerContext } from "@/lib/owner-context";

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const { operador } = await getOwnerContext();

  return (
    <div className="min-h-screen bg-void text-white">
      <header className="flex items-center justify-between border-b border-white/10 bg-void-card px-6 py-4 md:px-10">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-lime text-xs font-black text-void">
            R
          </span>
          <span className="text-sm font-semibold uppercase tracking-wide text-white">
            ReserveOS · Operador
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm text-white/50">
          <Link href="/owner" className="hover:text-white">
            Estudios
          </Link>
          <span>{operador.nombre ?? "Operador"}</span>
        </div>
      </header>
      {children}
    </div>
  );
}
