"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function corregirInstructora(tenantId: string, clases: { horario_id: string; fecha: string }[], instructoraId: string, motivo: string, sustitucion: boolean) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("corregir_instructora_clases", { p_tenant_id: tenantId, p_clases: clases, p_instructora: instructoraId, p_motivo: motivo, p_sustitucion: sustitucion });
  if (error) return { error: error.message, n: 0 };
  revalidatePath("/panel/instructoras");
  revalidatePath("/panel/historial");
  return { error: null, n: Number(data) };
}

export async function guardarReto(tenantId: string, meta: number) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("guardar_reto_mensual", { p_tenant_id: tenantId, p_meta: meta });
  if (error) return { error: error.message };
  revalidatePath("/panel/instructoras");
  return { error: null };
}
