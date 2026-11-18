import Link from "next/link";
import { estiloMarca, marcaPorSlug } from "@/lib/marca";
import { getCuenta } from "@/lib/cuenta-context";
import RegistrarSw from "./registrar-sw";

const TABS = [
  { href: "/cuenta", label: "Inicio" },
  { href: "/cuenta/clases", label: "Reservar" },
  { href: "/cuenta/historial", label: "Mis clases" },
  { href: "/cuenta/paquetes", label: "Mi paquete" },
  { href: "/cuenta/perfil", label: "Mis datos" },
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
  const marca = ((mods as string[] | null) ?? []).includes("portal_marca") ? await marcaPorSlug(actual.slug) : null;
  const { data: resumen } = await supabase.rpc("mi_resumen", { p_tenant_id: actual.tenant_id });
  const pendiente = ((resumen as { paquetes?: { estado: string; paquete: string }[] } | null)?.paquetes ?? []).find((p) => p.estado === "pendiente_pago");
  const enlaces = [...TABS.slice(0, 4), ...(conTienda ? [{ href: "/cuenta/tienda", label: "Tienda" }] : []), TABS[4]];
  return (
    <div className="tema-estudio min-h-screen bg-cream" style={estiloMarca(marca?.color)}>
      <RegistrarSw />
      <header className="border-b border-ink/15 bg-cream">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-5 py-4">
          <Link href="/cuenta" className="flex items-center">
            {marca?.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={marca.logo} alt={`Logo de ${actual.estudio}`} className="h-9 w-auto max-w-[11rem] object-contain" />
            ) : (
              <span className="font-serif text-2xl text-ink">{actual.estudio}</span>
            )}
          </Link>
          <span className="flex items-center gap-4 text-xs text-ink/60">
            {contextos.length > 1 && !dominioEstudio && <Link href="/elegir-estudio" className="border-b border-ink/20 pb-0.5 hover:text-ink">Cambiar estudio</Link>}
            {todos.some((c) => c.tenant_id === actual.tenant_id && c.rol_staff) && <Link href="/panel" className="border-b border-ink/20 pb-0.5 hover:text-ink">Panel</Link>}
          </span>
        </div>
        <nav aria-label="Mi cuenta" className="mx-auto flex max-w-4xl gap-1 overflow-x-auto px-3">
          {enlaces.map((t) => (
            <Link key={t.href} href={t.href} className="shrink-0 border-b-2 border-transparent px-3 py-3 text-sm font-medium text-ink/65 transition-colors duration-150 hover:border-ink hover:text-ink">{t.label}</Link>
          ))}
        </nav>
      </header>
      {pendiente && (
        <div className="mx-auto max-w-4xl px-5 pt-5">
          <p className="border border-peach/40 bg-peach-tint px-4 py-3 text-sm text-ink">
            Tu pago de <strong>{pendiente.paquete}</strong> está pendiente de confirmación. Te avisamos cuando lo aprueben.
          </p>
        </div>
      )}
      <main className="mx-auto max-w-4xl px-5 py-8">{children}</main>
    </div>
  );
}
