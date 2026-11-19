import PanelShell, { type AreaNav } from "./panel-shell";
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
  { href: "/panel/carriles", label: "Carriles" },
  { href: "/panel/cierres", label: "Feriados y cierres" },
  { href: "/panel/reportes", label: "Reportes" },
  { href: "/panel/seguimiento", label: "Seguimiento" },
  { href: "/panel/campanas", label: "Campañas" },
  { href: "/panel/auditoria", label: "Auditoría" },
  { href: "/panel/automatizaciones", label: "Automatizaciones" },
];

// Áreas del panel (propuesta de diseño): pocos destinos estables; cada una agrupa sus pantallas.
const AREAS: { id: string; titulo: string; rutas: string[] }[] = [
  { id: "resumen", titulo: "Resumen", rutas: ["/panel/hoy"] },
  { id: "agenda", titulo: "Agenda", rutas: ["/panel/calendario", "/panel/checkin", "/panel/historial", "/panel/instructoras", "/panel/privadas", "/panel/agenda-personal", "/panel/salas", "/panel/carriles", "/panel/cierres"] },
  { id: "clientes", titulo: "Clientes", rutas: ["/panel/clientes", "/panel/seguimiento"] },
  { id: "pagos", titulo: "Pagos", rutas: ["/panel/cobrar", "/panel/pagos-pendientes", "/panel/pagos", "/panel/caja", "/panel/paquetes", "/panel/tienda", "/panel/productos", "/panel/gift-cards", "/panel/descuentos"] },
  { id: "finanzas", titulo: "Finanzas", rutas: ["/panel/finanzas", "/panel/finanzas/registro", "/panel/facturacion", "/panel/negocio", "/panel/reportes"] },
  { id: "campanas", titulo: "Campañas", rutas: ["/panel/campanas"] },
  { id: "equipo", titulo: "Equipo y permisos", rutas: ["/panel/personal", "/panel/cuentas", "/panel/delegaciones", "/panel/auditoria"] },
  { id: "config", titulo: "Configuración", rutas: ["/panel/configuracion", "/panel/sedes", "/panel/automatizaciones", "/panel/suscripcion", "/panel/soporte"] },
];

export default async function PanelLayout({
  children,
}: LayoutProps<"/panel">) {
  const { supabase, membership, tenantName, modulos, variosEstudios, sedes } = await getPanelContext();
  const { data: incidentes } = membership
    ? await supabase.rpc("incidentes_activos", { p_tenant_id: membership.tenant_id })
    : { data: [] };
  const avisos = ((incidentes ?? []) as { titulo: string; severidad: string; estado: string }[]).map((a) => `Aviso de ReserveOS: ${a.titulo} · ${a.estado}`);

  const { data: slugRow } = membership ? await supabase.from("tenants").select("slug").eq("id", membership.tenant_id).maybeSingle() : { data: null };
  const conMarca = modulos.includes("portal_marca");
  const marca = conMarca ? await marcaPorSlug(slugRow?.slug) : null;

  const visibles = new Set(
    membership ? ALL_LINKS.filter((l) => puedeVer(membership.role, l.href) && rutaHabilitada(modulos, l.href)).map((l) => l.href) : [],
  );
  const etiqueta = new Map(ALL_LINKS.map((l) => [l.href, l.label]));

  // Pagos por revisar: se muestra como insignia en «Pagos» solo si el rol ve esa pantalla.
  let pendientes = 0;
  if (membership && visibles.has("/panel/pagos-pendientes")) {
    const { count } = await supabase.from("membresias").select("id", { count: "exact", head: true }).eq("tenant_id", membership.tenant_id).eq("pagada", false).eq("estado", "activa");
    pendientes = count ?? 0;
  }

  const areas: AreaNav[] = AREAS.map((a) => ({
    id: a.id, titulo: a.titulo,
    items: a.rutas.filter((r) => visibles.has(r)).map((r) => ({ href: r, label: etiqueta.get(r) ?? r })),
    badge: a.id === "pagos" ? pendientes : undefined,
  })).filter((a) => a.items.length > 0);

  const alcance = !membership ? "" : ["duena", "gerente_general", "contadora"].includes(membership.role) || sedes.length === 0
    ? "Todas las sedes" : sedes.length === 1 ? `Sede ${sedes[0].name}` : `${sedes.length} sedes`;

  return (
    <div className="tema-estudio min-h-screen bg-cream" style={estiloMarca(marca?.color)}>
      {membership && areas.length === 0 ? (
        <main className="mx-auto max-w-2xl px-6 py-16 text-center" role="alert">
          <h1 className="text-2xl text-ink">Tu acceso está pendiente.</h1>
          <p className="mt-2 text-sm text-ink-soft">Tu cuenta todavía no tiene pantallas asignadas en este estudio. Pide a la dueña o a quien administra el estudio que revise tu rol.</p>
        </main>
      ) : (
        <PanelShell areas={areas} marca={marca ? { logo: marca.logo } : null} estudio={tenantName || "ReserveOS"} alcance={alcance}
          usuario={{ nombre: membership?.nombre ?? "—", rol: membership ? ROLE_LABEL[membership.role] : "" }}
          variosEstudios={variosEstudios} salir={salir} avisos={avisos}>
          {children}
          {marca && <p className="px-5 py-8 text-[10px] uppercase tracking-[0.2em] text-ink/35 md:px-10">Con tecnología ReserveOS</p>}
        </PanelShell>
      )}
    </div>
  );
}
