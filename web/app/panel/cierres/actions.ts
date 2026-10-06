"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function cerrarFechas(tenantId: string, sedeId: string | null, desde: string, hasta: string, motivo: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cerrar_fechas", { p_tenant_id: tenantId, p_sede_id: sedeId, p_desde: desde, p_hasta: hasta, p_motivo: motivo });
  if (error) return { error: error.message, canceladas: 0 };
  revalidatePath("/panel/cierres");
  return { error: null, canceladas: (data as { reservas_canceladas: number }).reservas_canceladas };
}
export async function quitarCierre(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("quitar_cierre", { p_id: id });
  if (error) return { error: error.message };
  revalidatePath("/panel/cierres");
  return { error: null };
}
