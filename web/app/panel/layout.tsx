import Link from "next/link";
import { getPanelContext, ROLE_LABEL, puedeVer, rutaHabilitada } from "@/lib/panel-context";

const ALL_LINKS = [
  { href: "/panel/hoy", label: "Hoy" },
  { href: "/panel/calendario", label: "Calendario" },
  { href: "/panel/clientes", label: "Clientas" },
  { href: "/panel/pagos-pendientes", label: "Pagos pendientes" },
  { href: "/panel/paquetes", label: "Paquetes" },
  { href: "/panel/caja", label: "Caja" },
  { href: "/panel/tienda", label: "Tienda" },
  { href: "/panel/finanzas", label: "Finanzas" },
  { href: "/panel/finanzas/registro", label: "Gastos y balance" },
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
  { href: "/panel/auditoria", label: "Auditoría" },
  { href: "/panel/automatizaciones", label: "Automatizaciones" },
];

export default async function PanelLayout({
  children,
}: LayoutProps<"/panel">) {
  const { supabase, membership, tenantName, modulos } = await getPanelContext();
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
      <aside className="hidden w-60 shrink-0 flex-col border-r border-white/10 bg-card px-4 py-6 md:flex">
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

        <nav className="mt-8 flex flex-col gap-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-2 text-sm text-ink-soft transition-colors duration-200 hover:bg-cream hover:text-ink"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto rounded-xl bg-cream px-3 py-3">
          <p className="text-xs font-medium text-ink">
            {membership?.nombre ?? "—"}
          </p>
          <p className="text-xs text-ink-soft">
            {membership ? ROLE_LABEL[membership.role] : ""} · {tenantName}
          </p>
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
