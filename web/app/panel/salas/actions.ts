"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function guardarSala(i: { id: string | null; sedeId: string; nombre: string; capacidad: number; equipamiento: string; activa: boolean }) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("sala_guardar", { p_id: i.id, p_sede_id: i.sedeId, p_nombre: i.nombre, p_capacidad: i.capacidad, p_equipamiento: i.equipamiento || null, p_activa: i.activa });
  if (error) return { error: error.message };
  revalidatePath("/panel/salas");
  return { error: null };
}
