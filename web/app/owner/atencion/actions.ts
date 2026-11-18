"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function asignarEstudio(tenantId: string, userId: string, asignar: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("asignar_estudio", { p_tenant_id: tenantId, p_user_id: userId, p_asignar: asignar });
  if (error) return { error: error.message };
  revalidatePath("/owner/atencion");
  return { error: null };
}
