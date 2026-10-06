"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function llamar(fn: string, args: Record<string, unknown>) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { error: error.message, data: null };
  revalidatePath("/cuenta", "layout");
  return { error: null, data };
}
export async function reservar(horarioId: string, fecha: string, clienteId: string) {
  return llamar("agendar_clase", { p_horario_id: horarioId, p_fecha: fecha, p_cliente_id: clienteId });
}
export async function cancelar(reservaId: string) {
  const r = await llamar("cancelar_mi_reserva", { p_reserva_id: reservaId });
  return { error: r.error, penalizada: (r.data as { penalizada?: boolean } | null)?.penalizada ?? false };
}
export async function anotarEspera(horarioId: string, fecha: string, clienteId: string) {
  return llamar("unirse_lista_espera", { p_horario_id: horarioId, p_fecha: fecha, p_cliente_id: clienteId });
}
export async function salirEspera(id: string) {
  return llamar("salir_lista_espera", { p_id: id });
}
