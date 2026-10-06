import { redirect } from "next/navigation";
import { getPanelContext, puedeVer, rutaHabilitada } from "@/lib/panel-context";
import FacturacionView, { type Config, type Venta, type Doc } from "./facturacion-view";

export default async function FacturacionPage() {
  const { supabase, membership, modulos } = await getPanelContext();
  if (!membership) return null;
  if (!puedeVer(membership.role, "/panel/facturacion") || !rutaHabilitada(modulos, "/panel/facturacion")) redirect("/panel/hoy");
  const t = membership.tenant_id;
  const [cfg, ventas, docs] = await Promise.all([
    supabase.rpc("fiscal_config", { p_tenant_id: t }),
    supabase.rpc("ventas_sin_factura", { p_tenant_id: t }),
    supabase.rpc("documentos_fiscales_listar", { p_tenant_id: t, p_estado: null }),
  ]);
  return (
    <FacturacionView tenantId={t} config={(cfg.data ?? null) as Config | null} ventas={(ventas.data ?? []) as Venta[]} docs={(docs.data ?? []) as Doc[]}
      puedeConfigurar={["duena", "gerente_general", "contadora"].includes(membership.role)} puedeAnular={["duena", "gerente_general", "contadora"].includes(membership.role)} />
  );
}
