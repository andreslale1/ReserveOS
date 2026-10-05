"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function llamar(fn: string, args: Record<string, unknown>) {
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, args);
  if (error) return { error: error.message };
  revalidatePath("/owner/activaciones");
  revalidatePath("/owner");
  return { error: null };
}
export async function marcarEtapa(id: string, key: string, hecha: boolean) {
  return llamar("proyecto_etapa", { p_id: id, p_key: key, p_hecha: hecha });
}
export async function vincularEstudio(id: string, tenantId: string) {
  return llamar("proyecto_vincular_estudio", { p_id: id, p_tenant_id: tenantId });
}
export async function publicarProyecto(id: string) {
  return llamar("proyecto_publicar", { p_id: id });
}
