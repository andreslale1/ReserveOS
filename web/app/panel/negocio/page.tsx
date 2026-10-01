import { redirect } from "next/navigation";
import { getPanelContext, puedeVer } from "@/lib/panel-context";
import NegocioView from "./negocio-view";

export default async function NegocioPage() {
  const { supabase, membership } = await getPanelContext();

  if (!membership) {
    return null;
  }
  if (!puedeVer(membership.role, "/panel/negocio")) {
    redirect("/panel/hoy");
  }

  const tenantId = membership.tenant_id;

  const [
    { data: resumenClientas },
    { data: ingresoMensual },
    { data: retencion },
    { data: ranking },
    { data: adquisicion },
    { data: actividad },
  ] = await Promise.all([
    supabase.rpc("kpi_resumen_clientas", { p_tenant_id: tenantId }),
    supabase.rpc("kpi_ingreso_bruto_mensual", { p_tenant_id: tenantId, p_meses: 6 }),
    supabase.rpc("kpi_retencion", { p_tenant_id: tenantId }),
    supabase.rpc("kpi_ranking_instructoras", { p_tenant_id: tenantId }),
    supabase.rpc("kpi_adquisicion", { p_tenant_id: tenantId, p_meses: 3 }),
    supabase.rpc("actividad_reciente_staff", { p_tenant_id: tenantId, p_dias: 14 }),
  ]);

  return (
    <NegocioView
      resumenClientas={resumenClientas}
      ingresoMensual={ingresoMensual ?? []}
      retencion={retencion}
      ranking={ranking ?? []}
      adquisicion={adquisicion ?? []}
      actividad={(actividad ?? []).slice(0, 20)}
    />
  );
}
