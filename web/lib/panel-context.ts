import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const ROLE_LABEL: Record<string, string> = {
  duena: "Dueña",
  gerente_general: "Gerente general",
  admin_sede: "Administradora de sede",
  recepcion: "Recepción",
  instructora: "Instructora",
  contadora: "Contadora",
};

type Sede = { id: string; name: string; timezone: string };

export async function getPanelContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: membership } = await supabase
    .from("tenant_memberships")
    .select("id, tenant_id, role, nombre, tenants(name)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return {
      supabase,
      user,
      membership: null,
      sedes: [] as Sede[],
      tenantName: "",
    };
  }

  const esDuenaOGerente =
    membership.role === "duena" || membership.role === "gerente_general";

  const sedeQuery = esDuenaOGerente
    ? supabase
        .from("sedes")
        .select("id, name, timezone")
        .eq("tenant_id", membership.tenant_id)
    : supabase
        .from("staff_sedes")
        .select("sede_id, sedes(id, name, timezone)")
        .eq("tenant_membership_id", membership.id);

  const { data: sedeRows } = await sedeQuery;

  const sedes: Sede[] =
    (esDuenaOGerente
      ? (sedeRows as Sede[] | null)
      : (sedeRows as { sedes: Sede }[] | null)?.map((r) => r.sedes)) ?? [];

  return {
    supabase,
    user,
    membership,
    sedes,
    tenantName:
      (membership.tenants as unknown as { name: string } | null)?.name ?? "",
  };
}

export function fechaYDowEnSede(timezone: string) {
  const dow = new Date(
    new Date().toLocaleString("en-US", { timeZone: timezone }),
  ).getDay();
  const fecha = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return { dow, fecha };
}
