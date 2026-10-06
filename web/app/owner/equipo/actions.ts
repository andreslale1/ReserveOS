"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function guardarMiembro(email: string, nombre: string, rol: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("equipo_guardar", { p_email: email, p_nombre: nombre, p_rol: rol });
  if (error) return { error: error.message };
  revalidatePath("/owner/equipo");
  return { error: null };
}
export async function quitarMiembro(userId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("equipo_quitar", { p_user_id: userId });
  if (error) return { error: error.message };
  revalidatePath("/owner/equipo");
  return { error: null };
}
