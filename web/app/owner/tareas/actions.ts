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
export async function nuevaTarea(i: { titulo: string; vence: string; prioridad: string; responsableId: string; leadId: string; tenantId: string }) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("tarea_guardar", {
    p_id: null, p_lead_id: i.leadId || null, p_tenant_id: i.tenantId || null, p_titulo: i.titulo, p_vence: i.vence || null,
    p_prioridad: i.prioridad, p_responsable_id: i.responsableId || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/owner/tareas");
  return { error: null };
}
export async function posponerTarea(id: string, dias: number) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("tarea_posponer", { p_id: id, p_dias: dias });
  if (error) return { error: error.message };
  revalidatePath("/owner/tareas");
  return { error: null };
}
