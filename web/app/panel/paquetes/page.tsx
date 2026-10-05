import { redirect } from "next/navigation";
import { getPanelContext, puedeVer } from "@/lib/panel-context";
import PaquetesView from "./paquetes-view";

export default async function PaquetesPage() {
  const { supabase, membership, sedes } = await getPanelContext();

  if (!membership) {
    return null;
  }
  if (!puedeVer(membership.role, "/panel/paquetes")) {
    redirect("/panel/hoy");
  }

  const { data: paquetes } = await supabase
    .from("paquetes")
    .select(
      "id, nombre, descripcion, num_clases, precio, vigencia_dias, cobertura, activo, categoria, paquete_sedes(sede_id)",
    )
    .eq("tenant_id", membership.tenant_id)
    .order("activo", { ascending: false })
    .order("precio");

  const filas = (paquetes ?? []).map((p) => ({
    id: p.id,
    nombre: p.nombre,
    descripcion: p.descripcion,
    numClases: p.num_clases,
    precio: p.precio,
    vigenciaDias: p.vigencia_dias,
    cobertura: p.cobertura,
    activo: p.activo,
    categoria: p.categoria,
    sedeIds: (
      (p.paquete_sedes as unknown as { sede_id: string }[] | null) ?? []
    ).map((s) => s.sede_id),
  }));

  const puedeGestionar = ["duena", "gerente_general"].includes(
    membership.role,
  );

  return (
    <PaquetesView
      paquetes={filas}
      sedes={sedes}
      tenantId={membership.tenant_id}
      puedeGestionar={puedeGestionar}
    />
  );
}
