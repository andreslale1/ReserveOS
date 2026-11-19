"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function crearCarriles(sedeId: string, cantidad: number, tipo: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("crear_recursos", { p_sede_id: sedeId, p_cantidad: cantidad, p_tipo: tipo });
  if (error) return { error: error.message };
  revalidatePath("/panel/carriles");
  return { error: null };
}
export async function fijarModo(horarioId: string, modo: "cupo" | "carril") {
  const supabase = await createClient();
  const { error } = await supabase.rpc("fijar_modo_reserva", { p_horario_id: horarioId, p_modo: modo });
  if (error) return { error: error.message };
  revalidatePath("/panel/carriles");
  return { error: null };
}
