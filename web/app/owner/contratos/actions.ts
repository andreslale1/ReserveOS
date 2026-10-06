"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function actualizarContrato(id: string, estado: string, tenantId: string, renovacionAuto: boolean, documento: string, notas: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("contrato_actualizar", { p_id: id, p_estado: estado, p_tenant_id: tenantId || null, p_renovacion_auto: renovacionAuto, p_documento_url: documento || null, p_notas: notas || null });
  if (error) return { error: error.message };
  revalidatePath("/owner/contratos");
  return { error: null };
}
export async function aplicarSuscripcion(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("contrato_aplicar_suscripcion", { p_id: id });
  if (error) return { error: error.message };
  revalidatePath("/owner/contratos");
  revalidatePath("/owner/cobros");
  return { error: null };
}
