import { redirect } from "next/navigation";
import { getPanelContext, puedeVer, rutaHabilitada } from "@/lib/panel-context";
import PagosView, { type Reembolso, type Transaccion } from "./pagos-view";

export default async function PagosPage() {
  const { supabase, membership, modulos } = await getPanelContext();
  if (!membership) return null;
  if (!puedeVer(membership.role, "/panel/pagos") || !rutaHabilitada(modulos, "/panel/pagos")) redirect("/panel/hoy");
  const t = membership.tenant_id;
  const [{ data: rb }, { data: tx }] = await Promise.all([
    supabase.rpc("reembolsos_listar", { p_tenant_id: t }),
    supabase.rpc("transacciones_listar", { p_tenant_id: t }),
  ]);
  return <PagosView reembolsos={(rb ?? []) as Reembolso[]} transacciones={(tx ?? []) as Transaccion[]} puedeResolver={["duena", "gerente_general", "admin_sede", "gerente_regional"].includes(membership.role)} />;
}
