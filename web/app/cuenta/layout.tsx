import "@/styles/internal-editorial.css";
import Link from "next/link";
import { estiloMarca, marcaPorSlug } from "@/lib/marca";
import { getCuenta } from "@/lib/cuenta-context";
import RegistrarSw from "./registrar-sw";
import MenuGrupo from "../panel/menu-grupo";
import { vocab } from "@/lib/giros";
import { salir } from "@/components/owner/salir";

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
  const marcaGiro = await marcaPorSlug(actual.slug);
  const marca = ((mods as string[] | null) ?? []).includes("portal_marca") ? marcaGiro : null;
  const { data: resumen } = await supabase.rpc("mi_resumen", { p_tenant_id: actual.tenant_id });
  const pendiente = ((resumen as { paquetes?: { estado: string; paquete: string }[] } | null)?.paquetes ?? []).find((p) => p.estado === "pendiente_pago");
  const v = vocab(marcaGiro?.giro);
  const grupos = [
    { titulo: "Clases", enlaces: [{ href: "/cuenta/clases", label: "Reservar" }, { href: "/cuenta/historial", label: `Mis ${v.clases}` }, { href: "/cuenta/clases/privadas", label: "Sesiones privadas 1 a 1" }] },
    { titulo: "Comprar", enlaces: [{ href: "/cuenta/paquetes", label: `Mi ${v.paquete}` }, ...(conTienda ? [{ href: "/cuenta/tienda", label: "Tienda" }] : [])] },
    { titulo: "Mi cuenta", enlaces: [{ href: "/cuenta/perfil", label: "Mis datos" }, { href: "/cuenta/perfil#familia", label: "Mi familia" }, { href: "/cuenta/perfil#inv-t", label: "Invitar y ganar" }, { href: "/cuenta/perfil#avisos-t", label: "Avisos del estudio" }] },
  ];
  return (
    <div className="tema-estudio ro-workspace ro-workspace-account min-h-screen bg-cream" style={estiloMarca(marca?.color)}>
      <RegistrarSw />
      <header className="ro-account-head border-b border-ink/15 bg-cream">
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
            <form action={salir}><button className="press-spring border border-ink/25 px-3 py-1.5 font-medium text-ink hover:bg-ink/5">Cerrar sesión</button></form>
          </span>
        </div>
        <nav aria-label="Mi cuenta" className="ro-workspace-navigation mx-auto flex max-w-4xl flex-wrap items-center gap-1 px-3 pb-2">
          <Link href="/cuenta" className="press-spring rounded-md px-3 py-2 text-sm font-medium text-ink/75 hover:bg-ink/5 hover:text-ink">Inicio</Link>
          {grupos.map((g) => <MenuGrupo key={g.titulo} titulo={g.titulo} enlaces={g.enlaces} tono="claro" />)}
        </nav>
      </header>
      <section className="ro-account-intro mx-auto max-w-4xl px-5 pt-6" aria-label="Tu espacio">
        <div className="ro-account-intro-inner">
          <div>
            <span className="ro-workspace-eyebrow">RESERVEOS / PORTAL DE CLIENTES / {actual.estudio.toUpperCase()}</span>
            <h2 className="ro-workspace-title">TUS CLASES.<br/>A TU RITMO.</h2>
            <p className="ro-workspace-subtitle">Reservas, paquetes y tu historial, en un solo espacio.</p>
          </div>
          <div className="ro-workspace-quick">
            <Link href="/cuenta/clases">RESERVAR CLASE ↗</Link>
            <Link href="/cuenta/paquetes">MIS PAQUETES ↗</Link>
          </div>
        </div>
      </section>
      {pendiente && (
        <div className="mx-auto max-w-4xl px-5 pt-5">
          <p className="border border-peach/40 bg-peach-tint px-4 py-3 text-sm text-ink">
            Tu pago de <strong>{pendiente.paquete}</strong> está pendiente de confirmación. Te avisamos cuando lo aprueben.
          </p>
        </div>
      )}
      <main className="ro-account-main mx-auto max-w-4xl px-5 py-8 pb-24 md:pb-8">{children}</main>
      <nav aria-label="Navegación rápida" className="ro-account-bottom fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-ink/15 bg-cream pb-[env(safe-area-inset-bottom)] md:hidden">
        {[["/cuenta", "Inicio"], ["/cuenta/clases", "Reservar"], ["/cuenta/historial", `Mis ${v.clases}`], ["/cuenta/paquetes", "Paquete"], ["/cuenta/perfil", "Perfil"]].map(([href, label]) => (
          <Link key={href} href={href} className="press-spring truncate px-1 py-3.5 text-center text-xs font-medium text-ink/75 active:bg-ink/5">{label}</Link>
        ))}
      </nav>
    </div>
  );
}
