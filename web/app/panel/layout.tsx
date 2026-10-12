import Link from "next/link";
import { salir } from "@/components/owner/salir";
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

  const links = membership
    ? ALL_LINKS.filter(
        (l) => puedeVer(membership.role, l.href) && rutaHabilitada(modulos, l.href),
      )
    : [];

  return (
    <div className="flex min-h-screen flex-col bg-cream md:flex-row">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-white/10 bg-card px-4 py-6 md:flex">
        <div className="flex items-center gap-2 px-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-peach">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M2 8.5L6 12.5L14 3.5"
                stroke="#0a0b08"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="text-base font-semibold text-ink">ReserveOS</span>
        </div>

        <nav aria-label="Panel del estudio" className="mt-6 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
          {ORDEN_GRUPOS.map((g) => {
            const enlaces = links.filter((l) => (GRUPO[l.href] ?? "Configuración") === g);
            if (enlaces.length === 0) return null;
            return (
              <div key={g}>
                {links.length > 8 && <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-ink/45">{g}</p>}
                <div className="mt-1 flex flex-col gap-0.5">
                  {enlaces.map((l) => (
                    <Link key={l.href} href={l.href} className="rounded-lg px-3 py-1.5 text-sm text-ink-soft transition-colors duration-200 hover:bg-cream hover:text-ink">
                      {l.label}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="mt-4 shrink-0 rounded-xl bg-cream px-3 py-3">
          <p className="text-xs font-medium text-ink">
            {membership?.nombre ?? "—"}
          </p>
          <p className="text-xs text-ink-soft">
            {membership ? ROLE_LABEL[membership.role] : ""} · {tenantName}
          </p>
          {variosEstudios && (
            <Link href="/elegir-panel" className="mt-1 block text-xs text-ink/50 underline">Cambiar de estudio</Link>
          )}
          <form action={salir}><button className="mt-2 text-xs text-ink/60 underline hover:text-ink">Cerrar sesión</button></form>
        </div>
      </aside>

      <nav className="flex items-center gap-1 overflow-x-auto border-b border-white/10 bg-card px-4 py-3 md:hidden">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="shrink-0 rounded-full px-3 py-1.5 text-sm text-ink-soft transition-colors duration-200 hover:bg-cream hover:text-ink"
          >
            {l.label}
          </Link>
        ))}
        <form action={salir} className="shrink-0"><button className="rounded-full px-3 py-1.5 text-sm text-ink/60">Cerrar sesión</button></form>
      </nav>

      <div className="flex-1">
        {avisos.length > 0 && (
          <div className="border-b border-white/10 bg-peach-tint px-6 py-3 text-sm text-ink md:px-10">
            {avisos.map((a, i) => (
              <p key={i}><strong>Aviso de ReserveOS:</strong> {a.titulo} · {a.estado}</p>
            ))}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
