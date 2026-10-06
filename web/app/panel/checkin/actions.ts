"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function registrarCheckin(tenantId: string, codigo: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("checkin_por_codigo", { p_tenant_id: tenantId, p_codigo: codigo });
  if (error) return { error: error.message, resultado: null };
  revalidatePath("/panel/hoy");
  return { error: null, resultado: data as { ya_registrada: boolean; cliente: string; clase: string; hora: string } };
}
