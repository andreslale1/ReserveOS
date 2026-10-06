import Link from "next/link";
import { getCuenta } from "@/lib/cuenta-context";
import RegistrarSw from "./registrar-sw";

const TABS = [
  { href: "/cuenta", label: "Inicio" },
  { href: "/cuenta/clases", label: "Clases" },
  { href: "/cuenta/paquetes", label: "Paquetes" },
  { href: "/cuenta/historial", label: "Historial" },
  { href: "/cuenta/perfil", label: "Perfil" },
];

export default async function CuentaLayout({ children }: { children: React.ReactNode }) {
  const { supabase, actual, contextos, todos, dominioEstudio } = await getCuenta();
  const { data: mods } = actual ? await supabase.rpc("mis_modulos", { p_tenant_id: actual.tenant_id }) : { data: [] };
  const conTienda = ((mods as string[] | null) ?? []).includes("tienda_inventario");
  if (!actual) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-cream px-6 text-center">
        <div>
          <p className="text-xl font-semibold text-ink">{dominioEstudio ? "Tu cuenta no es clienta de este estudio." : "Esta cuenta aún no es clienta de ningún estudio."}</p>
          <p className="mt-2 text-sm text-ink/60">Pide al estudio que te registre o que te envíe tu invitación.</p>
          {todos.some((c) => c.rol_staff) && <Link href="/panel" className="mt-4 inline-block text-sm text-ink underline">Ir al panel del estudio</Link>}
        </div>
      </main>
    );
  }
  return (
    <div className="min-h-screen bg-cream pb-20">
      <RegistrarSw />
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-black/10 bg-cream/95 px-5 py-3 backdrop-blur">
        <span className="font-serif text-lg text-ink">{actual.estudio}</span>
        <span className="flex items-center gap-4 text-xs text-ink/55">
          {contextos.length > 1 && !dominioEstudio && <Link href="/elegir-estudio" className="underline">Cambiar estudio</Link>}
          {todos.some((c) => c.tenant_id === actual.tenant_id && c.rol_staff) && <Link href="/panel" className="underline">Panel</Link>}
        </span>
      </header>
      <div className="mx-auto max-w-2xl px-5 py-6">{children}</div>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-black/10 bg-white/95 backdrop-blur">
        <ul className="mx-auto flex max-w-2xl justify-around">
          {[...TABS.slice(0, 3), ...(conTienda ? [{ href: "/cuenta/tienda", label: "Tienda" }] : []), ...TABS.slice(3)].map((t) => (
            <li key={t.href}><Link href={t.href} className="block px-3 py-3.5 text-xs font-medium text-ink/70 hover:text-ink">{t.label}</Link></li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
