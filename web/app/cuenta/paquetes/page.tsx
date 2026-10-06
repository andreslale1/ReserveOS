import { getCuenta } from "@/lib/cuenta-context";
import PaquetesView, { type Paquete, type Transferencia } from "./paquetes-view";

export default async function PaquetesPage() {
  const { supabase, actual } = await getCuenta();
  const t = actual!.tenant_id;
  const [{ data: cat }, { data: tr }, { data: res }] = await Promise.all([
    supabase.rpc("catalogo_paquetes", { p_tenant_id: t }),
    supabase.rpc("datos_transferencia", { p_tenant_id: t }),
    supabase.rpc("mi_resumen", { p_tenant_id: t }),
  ]);
  const mios = ((res as { paquetes: { id: string; paquete: string; estado: string; totales: number | null; usadas: number; vence: string; congelada: boolean; sedes: string | null }[] } | null)?.paquetes) ?? [];
  return <PaquetesView tenantId={t} catalogo={(cat ?? []) as Paquete[]} transferencia={(tr ?? null) as Transferencia | null} mios={mios} />;
}
