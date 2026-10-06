import { redirect } from "next/navigation";
import { getPanelContext, puedeVer } from "@/lib/panel-context";
import CierresView from "./cierres-view";

export default async function CierresPage() {
  const { supabase, membership, sedes } = await getPanelContext();
  if (!membership) return null;
  if (!puedeVer(membership.role, "/panel/cierres")) redirect("/panel/hoy");
  const hoy = new Date().toISOString().slice(0, 10);
  const { data } = await supabase.from("sede_cierres").select("id, sede_id, desde, hasta, motivo").eq("tenant_id", membership.tenant_id).gte("hasta", hoy).order("desde");
  return (
    <CierresView
      tenantId={membership.tenant_id}
      sedes={sedes.map((s) => ({ id: s.id, name: s.name }))}
      cierres={(data ?? []) as { id: string; sede_id: string | null; desde: string; hasta: string; motivo: string }[]}
      puedeTodas={["duena", "gerente_general"].includes(membership.role)}
    />
  );
}
