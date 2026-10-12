import { redirect } from "next/navigation";
import { getPanelContext, puedeVer } from "@/lib/panel-context";
import NegocioView, { type Tab } from "./negocio-view";

const TABS: Tab[] = ["mando", "clientas", "operacion", "finanzas", "metas", "retencion", "adquisicion"];

export default async function NegocioPage({ searchParams }: { searchParams: Promise<{ tab?: string; sede?: string }> }) {
  const { tab: tabParam, sede } = await searchParams;
  const { supabase, membership, sedes } = await getPanelContext();
  if (!membership) return null;
  if (!puedeVer(membership.role, "/panel/negocio")) redirect("/panel/hoy");

  const tenantId = membership.tenant_id;
  const rol = membership.role;
  const sedeId = sede && sedes.some((s) => s.id === sede) ? sede : null;
  const tab: Tab = TABS.includes(tabParam as Tab) ? (tabParam as Tab) : rol === "contadora" ? "finanzas" : "mando";

  const { data: cm, error } = await supabase.rpc("centro_mando", { p_tenant_id: tenantId, p_sede_id: sedeId });
  if (error || !cm) {
    return <main className="mx-auto max-w-3xl px-6 py-16 text-center text-ink-soft" role="alert">{error?.message ?? "No se pudo cargar el centro de mando."}</main>;
  }

  const esG = rol === "duena" || rol === "gerente_general";
  const [clientas, serie, riesgo, ranking, actividad, resumenFin] = await Promise.all([
    tab === "clientas" && esG ? supabase.rpc("kpi_resumen_clientas", { p_tenant_id: tenantId }) : Promise.resolve({ data: null }),
    tab === "finanzas" ? supabase.rpc("finanzas_serie_confirmada", { p_tenant_id: tenantId, p_meses: 6, p_sede_id: sedeId }) : Promise.resolve({ data: null }),
    tab === "retencion" && rol !== "contadora" ? supabase.rpc("clientas_riesgo_fuga_lista", { p_tenant_id: tenantId, p_dias: 14, p_sede_id: sedeId }) : Promise.resolve({ data: null }),
    tab === "operacion" && esG ? supabase.rpc("kpi_ranking_instructoras", { p_tenant_id: tenantId }) : Promise.resolve({ data: null }),
    tab === "mando" && esG ? supabase.rpc("actividad_reciente_staff", { p_tenant_id: tenantId, p_dias: 14 }) : Promise.resolve({ data: null }),
    tab === "finanzas" && (esG || rol === "contadora") && !sedeId ? supabase.rpc("kpi_finanzas_resumen", { p_tenant_id: tenantId, p_desde: (cm as { mes: string }).mes, p_hasta: (cm as { hoy: string }).hoy }) : Promise.resolve({ data: null }),
  ]);

  return (
    <NegocioView
      tab={tab}
      rol={rol}
      tenantId={tenantId}
      sedeId={sedeId}
      sedes={sedes.map((s) => ({ id: s.id, name: s.name }))}
      cm={cm as never}
      clientas={clientas.data as never}
      serie={(serie.data ?? []) as never}
      riesgo={(riesgo.data ?? []) as never}
      ranking={(ranking.data ?? []) as never}
      actividad={((actividad.data ?? []) as never[]).slice(0, 15)}
      resumenFin={resumenFin.data as never}
    />
  );
}
