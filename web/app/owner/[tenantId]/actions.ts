"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function aplicarPlan(tenantId: string, plan: string, motivo: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("aplicar_plan_tenant", { p_tenant_id: tenantId, p_plan: plan, p_motivo: motivo });
  if (error) return { error: error.message };
  revalidatePath(`/owner/${tenantId}`);
  return { error: null };
}

export async function cambiarModulo(tenantId: string, key: string, activo: boolean, motivo: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_modulo_tenant", { p_tenant_id: tenantId, p_key: key, p_enabled: activo, p_reason: motivo });
  if (error) return { error: error.message };
  revalidatePath(`/owner/${tenantId}`);
  return { error: null };
}
