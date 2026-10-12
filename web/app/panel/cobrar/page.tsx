import { redirect } from "next/navigation";
import { getPanelContext, puedeVer } from "@/lib/panel-context";
import CobrarView, { type PaqueteCat } from "./cobrar-view";

export default async function CobrarPage() {
  const { supabase, membership, sedes } = await getPanelContext();
  if (!membership) return null;
  if (!puedeVer(membership.role, "/panel/cobrar")) redirect("/panel/hoy");

  const [{ data: clientas }, { data: paquetes }] = await Promise.all([
    supabase.from("clientes").select("id, nombre, telefono, email").eq("tenant_id", membership.tenant_id).order("nombre").limit(1000),
    supabase.rpc("catalogo_paquetes", { p_tenant_id: membership.tenant_id }),
  ]);
  return (
    <CobrarView
      clientas={(clientas ?? []) as { id: string; nombre: string; telefono: string | null; email: string | null }[]}
      paquetes={(paquetes ?? []) as PaqueteCat[]}
      sedes={sedes.map((s) => ({ id: s.id, name: s.name }))}
      puedeCortesia={["duena", "gerente_general"].includes(membership.role)}
    />
  );
}
