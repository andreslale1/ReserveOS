"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function llamar(fn: string, args: Record<string, unknown>) {
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, args);
  if (error) return { error: error.message };
  revalidatePath("/panel/privadas");
  return { error: null };
}

export async function asignarPrivada(clienteId: string, paqueteId: string, horarioId: string, fecha: string, metodo: string) {
  return llamar("asignar_clase_privada_manual", { p_cliente_id: clienteId, p_paquete_id: paqueteId, p_horario_id: horarioId, p_fecha: fecha, p_metodo_pago: metodo });
}
export async function cancelarPrivada(reservaId: string) {
  return llamar("admin_cancelar_reserva", { p_reserva_id: reservaId });
}
export async function crearHorarioPrivado(i: { tenantId: string; sedeId: string; dia: number; inicio: string; fin: string; nombre: string; instructoraId: string }) {
  return llamar("crear_horario", {
    p_tenant_id: i.tenantId, p_sede_id: i.sedeId, p_dia_semana: i.dia, p_hora_inicio: i.inicio, p_hora_fin: i.fin,
    p_nombre_clase: i.nombre, p_cupo_maximo: 1, p_instructor_membership_id: i.instructoraId || null, p_categoria: "privado",
  });
}
