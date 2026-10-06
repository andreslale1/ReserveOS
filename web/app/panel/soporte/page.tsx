import { redirect } from "next/navigation";
import { getPanelContext, puedeVer } from "@/lib/panel-context";
import SoporteView from "./soporte-view";

export default async function SoportePanelPage() {
  const { supabase, membership } = await getPanelContext();
  if (!membership) return null;
  if (!puedeVer(membership.role, "/panel/soporte")) redirect("/panel/hoy");
  const { data } = await supabase.rpc("mis_tickets", { p_tenant_id: membership.tenant_id });
  return <SoporteView tenantId={membership.tenant_id} tickets={(data ?? []) as { id: string; asunto: string; prioridad: string; estado: string; created_at: string }[]} />;
}
