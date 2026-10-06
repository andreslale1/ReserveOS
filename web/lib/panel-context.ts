import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const ROLE_LABEL: Record<string, string> = {
  duena: "Dueña",
  gerente_general: "Gerente general",
  admin_sede: "Administradora de sede",
  recepcion: "Recepción",
  instructora: "Instructora",
  contadora: "Contadora",
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
  ],
  recepcion: [
    "/panel/hoy",
    "/panel/calendario",
    "/panel/clientes",
    "/panel/pagos-pendientes",
    "/panel/caja",
    "/panel/tienda",
  ],
  instructora: ["/panel/hoy", "/panel/calendario"],
  contadora: ["/panel/hoy", "/panel/finanzas", "/panel/finanzas/registro", "/panel/caja"],
};

// Módulo contratado que habilita cada pantalla (las no listadas son del núcleo).
const RUTA_MODULO: Record<string, string> = {
  "/panel/tienda": "tienda_inventario",
  "/panel/descuentos": "descuentos_gift_cards",
  "/panel/caja": "cobros_caja_pos",
  "/panel/finanzas/registro": "finanzas_gastos",
  "/panel/seguimiento": "crm_segmentos",
  "/panel/pagos-pendientes": "cobros_transferencia",
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

  const { data: membership } = await supabase
    .from("tenant_memberships")
    .select("id, tenant_id, role, nombre, tenants(name)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return {
      supabase,
      user,
      membership: null,
      sedes: [] as Sede[],
      tenantName: "",
      modulos: [] as string[],
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
