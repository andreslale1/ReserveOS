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
// Crea la invitación y devuelve el token; el enlace se comparte a mano (no se envía correo desde aquí).
export async function invitarMiembro(email: string, nombre: string, rol: string): Promise<{ error: string | null; token?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("equipo_invitar", { p_email: email, p_nombre: nombre, p_rol: rol });
  if (error) return { error: error.message };
  revalidatePath("/owner/equipo");
  return { error: null, token: (data as { token: string }).token };
}
export async function revocarInvitacion(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("equipo_invitacion_revocar", { p_id: id });
  if (error) return { error: error.message };
  revalidatePath("/owner/equipo");
  return { error: null };
}
