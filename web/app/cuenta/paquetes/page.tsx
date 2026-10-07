import { getCuenta } from "@/lib/cuenta-context";
import PaquetesView, { type Paquete, type Transferencia } from "./paquetes-view";

export default async function PaquetesPage() {
  const { supabase, actual } = await getCuenta();
  const t = actual!.tenant_id;
  const [{ data: cat }, { data: tr }, { data: res }, { data: sedes }] = await Promise.all([
    supabase.rpc("catalogo_paquetes", { p_tenant_id: t }),
    supabase.rpc("datos_transferencia", { p_tenant_id: t }),
    supabase.rpc("mi_resumen", { p_tenant_id: t }),
    supabase.from("sedes").select("id, name").eq("tenant_id", t).eq("status", "activa").order("name"),
  ]);
  const mios = ((res as { paquetes: { id: string; paquete: string; estado: string; totales: number | null; usadas: number; vence: string; congelada: boolean; sedes: string | null }[] } | null)?.paquetes) ?? [];
  return <PaquetesView sedes={(sedes ?? []) as { id: string; name: string }[]} tenantId={t} catalogo={(cat ?? []) as Paquete[]} transferencia={(tr ?? null) as Transferencia | null} mios={mios} />;
}
