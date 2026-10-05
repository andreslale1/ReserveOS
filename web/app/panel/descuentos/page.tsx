import { redirect } from "next/navigation";
import { getPanelContext, puedeVer, rutaHabilitada } from "@/lib/panel-context";
import DescuentosView from "./descuentos-view";

export default async function DescuentosPage() {
  const { supabase, membership, modulos } = await getPanelContext();

  if (!membership) {
    return null;
  }
  if (!puedeVer(membership.role, "/panel/descuentos") || !rutaHabilitada(modulos, "/panel/descuentos")) {
    redirect("/panel/hoy");
  }

  const { data: codigos } = await supabase
    .from("codigos_descuento")
    .select(
      "id, codigo, descuento_pct, aplica_a, activo, usos_maximos, usos_actuales, vigente_hasta, auto_aplicar_canal, created_at",
    )
    .eq("tenant_id", membership.tenant_id)
    .order("created_at", { ascending: false });

  const puedeGestionar = ["duena", "gerente_general", "admin_sede"].includes(
    membership.role,
  );

  return (
    <DescuentosView
      tenantId={membership.tenant_id}
      codigos={codigos ?? []}
      puedeGestionar={puedeGestionar}
    />
  );
}
