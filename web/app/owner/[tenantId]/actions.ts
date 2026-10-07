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

export async function otorgarAcceso(tenantId: string, ticketId: string, motivo: string, alcance: string[], horas: number) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("acceso_excepcional_otorgar", {
    p_tenant_id: tenantId, p_ticket_id: ticketId, p_motivo: motivo, p_alcance: alcance, p_horas: horas,
  });
  if (error) return { error: error.message };
  revalidatePath(`/owner/${tenantId}`);
  return { error: null };
}

export async function revocarAcceso(tenantId: string, id: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("acceso_excepcional_revocar", { p_id: id });
  if (error) return { error: error.message };
  revalidatePath(`/owner/${tenantId}`);
  return { error: null };
}

export async function leerDatosSensibles(tenantId: string, alcance: "clientas" | "finanzas", offset = 0) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("owner_tenant_datos_sensibles", {
    p_tenant_id: tenantId, p_alcance: alcance, p_limite: 50, p_offset: offset,
  });
  if (error) return { error: error.message, data: null };
  return { error: null, data };
}
