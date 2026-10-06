import { redirect } from "next/navigation";
import { getPanelContext, puedeVer } from "@/lib/panel-context";
import DelegacionesView, { type Delegacion } from "./delegaciones-view";

export default async function DelegacionesPage() {
  const { supabase, membership, sedes } = await getPanelContext();
  if (!membership) return null;
  if (!puedeVer(membership.role, "/panel/delegaciones")) redirect("/panel/hoy");

  const [{ data: lista }, { data: acciones }, { data: personal }] = await Promise.all([
    supabase.rpc("delegaciones_listar", { p_tenant_id: membership.tenant_id }),
    supabase.rpc("acciones_delegables"),
    supabase.from("tenant_memberships").select("id, nombre, role").eq("tenant_id", membership.tenant_id).neq("role", "duena").order("nombre"),
  ]);
  return (
    <DelegacionesView
      tenantId={membership.tenant_id}
      puedeDelegar={membership.role === "duena"}
      delegaciones={(lista ?? []) as Delegacion[]}
      acciones={(acciones ?? []) as { role: string; action_id: string }[]}
      personal={(personal ?? []) as { id: string; nombre: string | null; role: string }[]}
      sedes={sedes.map((s) => ({ id: s.id, name: s.name }))}
    />
  );
}
