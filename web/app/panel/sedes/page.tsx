import { redirect } from "next/navigation";
import { getPanelContext, puedeVer } from "@/lib/panel-context";
import SedesView from "./sedes-view";

export default async function SedesPage() {
  const { supabase, membership } = await getPanelContext();
  if (!membership) return null;
  if (!puedeVer(membership.role, "/panel/sedes")) redirect("/panel/hoy");

  const { data } = await supabase
    .from("sedes")
    .select("id, name, address, timezone, status")
    .eq("tenant_id", membership.tenant_id)
    .order("created_at");

  return <SedesView tenantId={membership.tenant_id} sedes={data ?? []} />;
}
