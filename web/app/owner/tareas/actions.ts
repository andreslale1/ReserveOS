"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function marcarTarea(id: string, hecha: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("tarea_completar", { p_id: id, p_hecha: hecha });
  if (error) return { error: error.message };
  revalidatePath("/owner/tareas");
  return { error: null };
}
export async function nuevaTarea(titulo: string, vence: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("tarea_guardar", { p_id: null, p_lead_id: null, p_tenant_id: null, p_titulo: titulo, p_vence: vence || null });
  if (error) return { error: error.message };
  revalidatePath("/owner/tareas");
  return { error: null };
}
