"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Res = { error: string | null };

export async function guardarMeta(tenantId: string, mes: string, tipo: string, meta: number): Promise<Res> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("definir_meta", { p_tenant_id: tenantId, p_mes: mes, p_tipo: tipo, p_meta: meta });
  if (error) return { error: error.message };
  revalidatePath("/panel/negocio");
  return { error: null };
}

export async function guardarGastoMarketing(tenantId: string, mes: string, canal: string, monto: number): Promise<Res> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("registrar_gasto_marketing", { p_tenant_id: tenantId, p_mes: mes, p_canal: canal, p_monto: monto });
  if (error) return { error: error.message };
  revalidatePath("/panel/negocio");
  return { error: null };
}

export async function recordarConsentimiento(clienteId: string): Promise<Res> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("recordar_consentimiento", { p_cliente_id: clienteId });
  if (error) return { error: error.message };
  revalidatePath("/panel/negocio");
  return { error: null };
}
