import { redirect } from "next/navigation";
import { getPanelContext, puedeVer, ROLE_LABEL } from "@/lib/panel-context";
import PersonalView from "./personal-view";

export default async function PersonalPage() {
  const { supabase, membership, user } = await getPanelContext();

  if (!membership) {
    return null;
  }
  if (!puedeVer(membership.role, "/panel/personal")) {
    redirect("/panel/hoy");
  }

  const [{ data: personal }, { data: sedes }] = await Promise.all([
    supabase
      .from("tenant_memberships")
      .select("id, role, nombre, user_id")
      .eq("tenant_id", membership.tenant_id)
      .order("role"),
    supabase
      .from("sedes")
      .select("id, name")
      .eq("tenant_id", membership.tenant_id)
      .order("name"),
  ]);

  // staff_sedes no tiene columna tenant_id propia -- se filtra via los ids
  // de personal de este tenant, ya leidos arriba.
  const membershipIds = (personal ?? []).map((p) => p.id);
  const { data: asignacionesReales } = membershipIds.length
    ? await supabase
        .from("staff_sedes")
        .select("tenant_membership_id, sede_id")
        .in("tenant_membership_id", membershipIds)
    : { data: [] };

  const puedeEditar = ["duena", "gerente_general", "admin_sede"].includes(
    membership.role,
  );

  const personalConSedes = (personal ?? []).map((p) => ({
    id: p.id,
    role: p.role,
    roleLabel: ROLE_LABEL[p.role] ?? p.role,
    nombre: p.nombre ?? "—",
    esYo: p.user_id === user.id,
    sedeIds: (asignacionesReales ?? [])
      .filter((a) => a.tenant_membership_id === p.id)
      .map((a) => a.sede_id),
  }));

  return (
    <PersonalView
      personal={personalConSedes}
      sedes={sedes ?? []}
      puedeEditar={puedeEditar}
      tenantId={membership.tenant_id}
      miRole={membership.role}
      esDuenaOGerente={["duena", "gerente_general"].includes(membership.role)}
    />
  );
}
