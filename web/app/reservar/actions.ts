"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function reservarClase(horarioId: string, fecha: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("agendar_clase", {
    p_horario_id: horarioId,
    p_fecha: fecha,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/reservar");
  return { ok: true, data };
}
