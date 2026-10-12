"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Res = { error: string | null };

// El permiso real lo valida la base (solo dueña y gerencia general del estudio); aquí solo se traduce el error.
export async function configurarAutomatizacion(tenantId: string, clave: string, activa: boolean): Promise<Res> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("automatizacion_configurar", { p_tenant_id: tenantId, p_clave: clave, p_activa: activa });
  if (error) return { error: error.message };
  revalidatePath("/panel/automatizaciones");
  return { error: null };
}

export async function verificarSaludAhora(tenantId: string): Promise<Res> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("salud_ejecutar_ahora", { p_tenant_id: tenantId });
  if (error) return { error: error.message };
  revalidatePath("/panel/automatizaciones");
  return { error: null };
}
