"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function guardarCampana(i: { id: string | null; nombre: string; canal: string; fuente: string; presupuesto: number; inicio: string; fin: string; estado: string; notas: string }) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("campana_guardar", {
    p_id: i.id, p_nombre: i.nombre, p_canal: i.canal, p_fuente: i.fuente, p_presupuesto: i.presupuesto,
    p_inicio: i.inicio || null, p_fin: i.fin || null, p_estado: i.estado, p_notas: i.notas || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/owner/marketing");
  return { error: null };
}
export async function excluirCorreo(email: string, motivo: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("exclusion_guardar", { p_email: email, p_motivo: motivo || null });
  if (error) return { error: error.message };
  revalidatePath("/owner/marketing");
  return { error: null };
}
