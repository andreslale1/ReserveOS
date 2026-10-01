import { redirect } from "next/navigation";
import { getPanelContext, puedeVer } from "@/lib/panel-context";
import DescuentosView from "./descuentos-view";

export default async function DescuentosPage() {
  const { supabase, membership } = await getPanelContext();

  if (!membership) {
    return null;
  }
  if (!puedeVer(membership.role, "/panel/descuentos")) {
    redirect("/panel/hoy");
  }

  const { data: codigos } = await supabase
    .from("codigos_descuento")
    .select(
      "id, codigo, descuento_pct, aplica_a, activo, usos_maximos, usos_actuales, vigente_hasta, auto_aplicar_canal, created_at",
    )
    .eq("tenant_id", membership.tenant_id)
    .order("created_at", { ascending: false });

  return <DescuentosView codigos={codigos ?? []} />;
}
