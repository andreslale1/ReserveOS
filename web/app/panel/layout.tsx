import Link from "next/link";
import MenuGrupo from "./menu-grupo";
import { salir } from "@/components/owner/salir";
import { estiloMarca, marcaPorSlug } from "@/lib/marca";
import { getPanelContext, ROLE_LABEL, puedeVer, rutaHabilitada } from "@/lib/panel-context";

const ALL_LINKS = [
  { href: "/panel/hoy", label: "Hoy" },
  { href: "/panel/calendario", label: "Calendario" },
  { href: "/panel/checkin", label: "Check-in" },
  { href: "/panel/historial", label: "Historial de reservas" },
  { href: "/panel/instructoras", label: "Clases por instructora" },
  { href: "/panel/privadas", label: "Clases privadas" },
  { href: "/panel/clientes", label: "Clientas" },
  { href: "/panel/cobrar", label: "Cobrar" },
  { href: "/panel/pagos-pendientes", label: "Pagos pendientes" },
  { href: "/panel/paquetes", label: "Paquetes" },
  { href: "/panel/pagos", label: "Pagos y reembolsos" },
  { href: "/panel/caja", label: "Caja" },
  { href: "/panel/tienda", label: "Tienda" },
  { href: "/panel/productos", label: "Productos e inventario" },
  { href: "/panel/gift-cards", label: "Gift cards" },
  { href: "/panel/finanzas", label: "Finanzas" },
  { href: "/panel/finanzas/registro", label: "Gastos y balance" },
  { href: "/panel/facturacion", label: "Facturación" },
  { href: "/panel/descuentos", label: "Descuentos" },
  { href: "/panel/negocio", label: "Negocio" },
  { href: "/panel/configuracion", label: "Configuración" },
  { href: "/panel/delegaciones", label: "Delegaciones" },
  { href: "/panel/suscripcion", label: "Mi suscripción" },
  { href: "/panel/soporte", label: "Soporte" },
  { href: "/panel/personal", label: "Personal" },
  { href: "/panel/cuentas", label: "Cuentas del equipo" },
  { href: "/panel/agenda-personal", label: "Agenda del personal" },
  { href: "/panel/sedes", label: "Sedes" },
  { href: "/panel/salas", label: "Salas" },
  { href: "/panel/cierres", label: "Feriados y cierres" },
  { href: "/panel/reportes", label: "Reportes" },
  { href: "/panel/seguimiento", label: "Seguimiento" },
  { href: "/panel/campanas", label: "Campañas" },
  { href: "/panel/auditoria", label: "Auditoría" },
  { href: "/panel/automatizaciones", label: "Automatizaciones" },
];

// Grupos del menú: el panel tenía una lista plana de más de veinte enlaces; así cada persona encuentra por tarea.
const GRUPO: Record<string, string> = {
  "/panel/hoy": "Día a día", "/panel/calendario": "Día a día", "/panel/checkin": "Día a día", "/panel/cobrar": "Día a día", "/panel/clientes": "Día a día", "/panel/pagos-pendientes": "Día a día", "/panel/privadas": "Día a día",
  "/panel/historial": "Clases", "/panel/instructoras": "Clases", "/panel/agenda-personal": "Clases", "/panel/salas": "Clases", "/panel/cierres": "Clases",
  "/panel/paquetes": "Ventas", "/panel/tienda": "Ventas", "/panel/productos": "Ventas", "/panel/gift-cards": "Ventas", "/panel/descuentos": "Ventas",
  "/panel/caja": "Dinero", "/panel/pagos": "Dinero", "/panel/finanzas": "Dinero", "/panel/finanzas/registro": "Dinero", "/panel/facturacion": "Dinero",
  "/panel/negocio": "Negocio", "/panel/reportes": "Negocio", "/panel/seguimiento": "Negocio", "/panel/campanas": "Negocio",
};
const ORDEN_GRUPOS = ["Día a día", "Clases", "Ventas", "Dinero", "Negocio", "Configuración"];

export default async function PanelLayout({
  children,
}: LayoutProps<"/panel">) {
  const { supabase, membership, tenantName, modulos, variosEstudios } = await getPanelContext();
  const { data: incidentes } = membership
    ? await supabase.rpc("incidentes_activos", { p_tenant_id: membership.tenant_id })
    : { data: [] };
  const avisos = (incidentes ?? []) as { titulo: string; severidad: string; estado: string }[];

  const { data: slugRow } = membership ? await supabase.from("tenants").select("slug").eq("id", membership.tenant_id).maybeSingle() : { data: null };
  const conMarca = modulos.includes("portal_marca");
  const marca = conMarca ? await marcaPorSlug(slugRow?.slug) : null;

  const links = membership
    ? ALL_LINKS.filter(
        (l) => puedeVer(membership.role, l.href) && rutaHabilitada(modulos, l.href),
      )
    : [];

  const grupos = ORDEN_GRUPOS.map((g) => ({ titulo: g, enlaces: links.filter((l) => (GRUPO[l.href] ?? "Configuración") === g) })).filter((g) => g.enlaces.length > 0);
  const plano = links.length <= 8;

  return (
    <div className="tema-estudio min-h-screen bg-cream" style={estiloMarca(marca?.color)}>
      <header className="bg-ink text-void">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-8 gap-y-1 px-5 py-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
            <Link href="/panel/hoy" className="flex items-center py-1">
              {marca?.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={marca.logo} alt={`Logo de ${tenantName}`} className="h-8 w-auto max-w-[10rem] object-contain" />
              ) : (
                <span className="font-serif text-2xl leading-none text-void">{marca ? tenantName : "ReserveOS"}</span>
              )}
            </Link>
            <nav aria-label="Panel del estudio" className="flex flex-wrap items-center">
              {plano
                ? links.map((l) => <Link key={l.href} href={l.href} className="rounded-md px-3 py-2 text-sm font-medium text-void/90 hover:bg-void/10 hover:text-void">{l.label}</Link>)
                : grupos.map((g) => <MenuGrupo key={g.titulo} titulo={g.titulo} enlaces={g.enlaces} />)}
            </nav>
          </div>
          <div className="flex items-center gap-4 text-xs text-void/80">
            <span>{membership?.nombre ?? "—"} · {membership ? ROLE_LABEL[membership.role] : ""}</span>
            {variosEstudios && <Link href="/elegir-panel" className="underline hover:text-void">Cambiar estudio</Link>}
            <form action={salir}><button className="underline hover:text-void">Cerrar sesión</button></form>
          </div>
        </div>
      </header>

      {avisos.length > 0 && (
        <div className="border-b border-ink/15 bg-peach-tint px-6 py-3 text-sm text-ink md:px-10">
          {avisos.map((a, i) => (
            <p key={i}><strong>Aviso de ReserveOS:</strong> {a.titulo} · {a.estado}</p>
          ))}
        </div>
      )}
      <div className="mx-auto max-w-6xl">{children}</div>
      {marca && <p className="pb-8 text-center text-[10px] uppercase tracking-[0.2em] text-ink/35">Con tecnología ReserveOS</p>}
    </div>
  );
}
