"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function reservarPorPersonal(clienteId: string, horarioId: string, fecha: string, recursoId: string | null) {
  const supabase = await createClient();
  const { data, error } = recursoId
    ? await supabase.rpc("admin_agendar_clase_carril", { p_cliente_id: clienteId, p_horario_id: horarioId, p_fecha: fecha, p_recurso_id: recursoId })
    : await supabase.rpc("admin_agregar_reserva", { p_cliente_id: clienteId, p_horario_id: horarioId, p_fecha: fecha, p_tipo: "regular" });
  if (error) return { error: error.message, carril: null as string | null };
  revalidatePath("/panel/hoy"); revalidatePath(`/panel/clase/${horarioId}/${fecha}`);
  return { error: null, carril: (data as { carril?: string } | null)?.carril ?? null };
}
