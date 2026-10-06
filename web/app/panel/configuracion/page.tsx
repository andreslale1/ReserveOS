import { redirect } from "next/navigation";
import { getPanelContext, puedeVer } from "@/lib/panel-context";
import ConfiguracionView from "./configuracion-view";

export default async function ConfiguracionPage() {
  const { supabase, membership, modulos } = await getPanelContext();
  if (!membership) return null;
  if (!puedeVer(membership.role, "/panel/configuracion")) redirect("/panel/hoy");

  const [{ data: t }, { data: dominios }, { data: reglas }] = await Promise.all([
    supabase.from("tenants").select("name, slug, branding").eq("id", membership.tenant_id).maybeSingle(),
    supabase.from("tenant_domains").select("id, domain, verified").eq("tenant_id", membership.tenant_id),
    supabase.from("configuracion_reservas").select("horas_minimas_cancelacion, horas_minimas_confirmacion, cancelacion_tardia_devuelve_credito, anticipacion_maxima_dias, max_reservas_dia_por_clienta").eq("tenant_id", membership.tenant_id).maybeSingle(),
  ]);
  const b = (t?.branding ?? {}) as { color_primario?: string; logo_url?: string };

  return (
    <ConfiguracionView
      tenantId={membership.tenant_id}
      nombre={t?.name ?? ""}
      slug={t?.slug ?? ""}
      baseUrl={process.env.NEXT_PUBLIC_SITE_URL ?? "https://reserveos.app"}
      color={b.color_primario ?? ""}
      logo={b.logo_url ?? ""}
      dominios={dominios ?? []}
      puedeIntegrar={membership.role === "duena" && modulos.includes("cobros_online")}
      reglas={{
        horasCancelacion: reglas?.horas_minimas_cancelacion ?? 2,
        horasConfirmacion: reglas?.horas_minimas_confirmacion ?? 1,
        devuelveCredito: reglas?.cancelacion_tardia_devuelve_credito ?? false,
        anticipacionDias: reglas?.anticipacion_maxima_dias ?? 14,
        maxPorDia: reglas?.max_reservas_dia_por_clienta ?? null,
      }}
    />
  );
}
