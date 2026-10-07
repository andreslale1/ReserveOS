import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const COOKIE_PANEL = "rs_panel";

export const ROLE_LABEL: Record<string, string> = {
  duena: "Dueña",
  gerente_general: "Gerente general",
  gerente_regional: "Gerencia regional",
  admin_sede: "Administradora de sede",
  recepcion: "Recepción",
  instructora: "Instructora",
  contadora: "Contadora",
  marketing: "Marketing",
};

const TODAS_LAS_RUTAS = [
  "/panel/hoy",
  "/panel/calendario",
  "/panel/clientes",
  "/panel/pagos-pendientes",
  "/panel/paquetes",
  "/panel/finanzas",
  "/panel/caja",
  "/panel/tienda",
  "/panel/descuentos",
  "/panel/negocio",
  "/panel/personal",
  "/panel/automatizaciones",
  "/panel/reportes",
  "/panel/seguimiento",
  "/panel/auditoria",
  "/panel/sedes",
  "/panel/finanzas/registro",
  "/panel/configuracion",
  "/panel/agenda-personal",
  "/panel/suscripcion",
  "/panel/soporte",
  "/panel/cierres",
  "/panel/salas",
  "/panel/delegaciones",
  "/panel/pagos",
  "/panel/productos",
  "/panel/gift-cards",
  "/panel/campanas",
  "/panel/facturacion",
  "/panel/checkin",
];

// Visibilidad por rol -- mismo criterio que la matriz de permisos del
// backend (role_permissions). Se usa tanto para el menu (panel/layout.tsx)
// como para bloquear acceso directo por URL en cada page.tsx -- ocultar el
// link del menu no es control de acceso real.
export const NAV_POR_ROL: Record<string, string[]> = {
  duena: TODAS_LAS_RUTAS,
  gerente_general: TODAS_LAS_RUTAS,
  admin_sede: [
    "/panel/hoy",
    "/panel/calendario",
    "/panel/clientes",
    "/panel/pagos-pendientes",
    "/panel/finanzas",
    "/panel/caja",
    "/panel/tienda",
    "/panel/descuentos",
    "/panel/personal",
    "/panel/automatizaciones",
    "/panel/reportes",
    "/panel/finanzas/registro",
    "/panel/agenda-personal",
    "/panel/soporte",
    "/panel/cierres",
    "/panel/salas",
    "/panel/pagos",
    "/panel/productos",
    "/panel/gift-cards",
    "/panel/facturacion",
    "/panel/checkin",
  ],
  gerente_regional: [
    "/panel/hoy",
    "/panel/calendario",
    "/panel/clientes",
    "/panel/pagos-pendientes",
    "/panel/finanzas",
    "/panel/caja",
    "/panel/tienda",
    "/panel/personal",
    "/panel/automatizaciones",
    "/panel/reportes",
    "/panel/finanzas/registro",
    "/panel/agenda-personal",
    "/panel/soporte",
    "/panel/cierres",
    "/panel/salas",
  ],
  marketing: ["/panel/hoy", "/panel/seguimiento", "/panel/campanas"],
  recepcion: [
    "/panel/hoy",
    "/panel/calendario",
    "/panel/clientes",
    "/panel/pagos-pendientes",
    "/panel/caja",
    "/panel/tienda",
    "/panel/productos",
    "/panel/gift-cards",
    "/panel/checkin",
  ],
  instructora: ["/panel/hoy", "/panel/calendario", "/panel/checkin"],
  contadora: ["/panel/hoy", "/panel/finanzas", "/panel/finanzas/registro", "/panel/caja", "/panel/pagos", "/panel/facturacion"],
};

// Módulo contratado que habilita cada pantalla (las no listadas son del núcleo).
const RUTA_MODULO: Record<string, string> = {
  "/panel/tienda": "tienda_inventario",
  "/panel/descuentos": "descuentos_gift_cards",
  "/panel/caja": "cobros_caja_pos",
  "/panel/finanzas/registro": "finanzas_gastos",
  "/panel/seguimiento": "crm_segmentos",
  "/panel/pagos-pendientes": "cobros_transferencia",
  "/panel/pagos": "cobros_reembolsos",
  "/panel/productos": "tienda_inventario",
  "/panel/gift-cards": "descuentos_gift_cards",
  "/panel/campanas": "campanas_marketing",
  "/panel/facturacion": "finanzas_iva_fel",
  "/panel/checkin": "checkin_qr",
};

export function rutaHabilitada(modulos: string[], ruta: string) {
  const req = RUTA_MODULO[ruta];
  return !req || modulos.includes(req);
}

export function puedeVer(role: string, ruta: string) {
  return (NAV_POR_ROL[role] ?? TODAS_LAS_RUTAS).includes(ruta);
}

type Sede = { id: string; name: string; timezone: string };

export async function getPanelContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Una misma persona puede trabajar en más de un estudio: el estudio activo se elige de forma explícita (cookie validada
  // contra sus membresías reales). Si trabaja en varios y no ha elegido, se le pregunta; nunca se toma uno al azar.
  const { data: todas } = await supabase
    .from("tenant_memberships")
    .select("id, tenant_id, role, nombre, tenants(name)")
    .eq("user_id", user.id);
  const guardado = (await cookies()).get(COOKIE_PANEL)?.value;
  let membership = (todas ?? []).find((m) => m.tenant_id === guardado) ?? null;
  if (!membership && (todas ?? []).length === 1) membership = todas![0];
  if (!membership && (todas ?? []).length > 1) redirect("/elegir-panel");
  const variosEstudios = (todas ?? []).length > 1;

  if (!membership) {
    return {
      supabase,
      user,
      membership: null,
      sedes: [] as Sede[],
      tenantName: "",
      modulos: [] as string[],
      variosEstudios: false,
    };
  }

  const { data: modulosData } = await supabase.rpc("mis_modulos", {
    p_tenant_id: membership.tenant_id,
  });
  const modulos = (modulosData as string[] | null) ?? [];

  const esDuenaOGerente =
    membership.role === "duena" || membership.role === "gerente_general";

  const sedeQuery = esDuenaOGerente
    ? supabase
        .from("sedes")
        .select("id, name, timezone")
        .eq("tenant_id", membership.tenant_id)
    : supabase
        .from("staff_sedes")
        .select("sede_id, sedes(id, name, timezone)")
        .eq("tenant_membership_id", membership.id);

  const { data: sedeRows } = await sedeQuery;

  const sedes: Sede[] =
    (esDuenaOGerente
      ? (sedeRows as Sede[] | null)
      : (sedeRows as { sedes: Sede }[] | null)?.map((r) => r.sedes)) ?? [];

  return {
    supabase,
    user,
    membership,
    sedes,
    modulos,
    variosEstudios,
    tenantName:
      (membership.tenants as unknown as { name: string } | null)?.name ?? "",
  };
}

export function fechaYDowEnSede(timezone: string) {
  const dow = new Date(
    new Date().toLocaleString("en-US", { timeZone: timezone }),
  ).getDay();
  const fecha = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return { dow, fecha };
}
