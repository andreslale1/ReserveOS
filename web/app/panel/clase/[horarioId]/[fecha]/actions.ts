"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Res = { error: string | null };

async function llamar(
  horarioId: string,
  fecha: string,
  fn: string,
  args: Record<string, unknown>,
): Promise<Res> {
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, args);
  if (error) {
    return { error: error.message };
  }
  revalidatePath(`/panel/clase/${horarioId}/${fecha}`);
  revalidatePath("/panel/hoy");
  return { error: null };
}

// P21
export async function marcarAsistencia(
  horarioId: string,
  fecha: string,
  reservaId: string,
  asistio: boolean,
) {
  return llamar(horarioId, fecha, "registrar_asistencia", {
    p_reserva_id: reservaId,
    p_asistio: asistio,
  });
}

// P18
export async function agregarAsistente(
  horarioId: string,
  fecha: string,
  clienteId: string,
) {
  return llamar(horarioId, fecha, "admin_agregar_reserva", {
    p_cliente_id: clienteId,
    p_horario_id: horarioId,
    p_fecha: fecha,
  });
}

export async function quitarAsistente(
  horarioId: string,
  fecha: string,
  reservaId: string,
) {
  return llamar(horarioId, fecha, "admin_cancelar_reserva", {
    p_reserva_id: reservaId,
  });
}

// P20
export async function anotarEnEspera(
  horarioId: string,
  fecha: string,
  clienteId: string,
) {
  return llamar(horarioId, fecha, "unirse_lista_espera", {
    p_horario_id: horarioId,
    p_fecha: fecha,
    p_cliente_id: clienteId,
  });
}

// P14
export async function cambiarCupo(
  horarioId: string,
  fecha: string,
  cupo: number,
) {
  return llamar(horarioId, fecha, "actualizar_horario", {
    p_horario_id: horarioId,
    p_cupo_maximo: cupo,
  });
}

export async function cancelarClase(horarioId: string, fecha: string) {
  return llamar(horarioId, fecha, "cancelar_clase_fecha", {
    p_horario_id: horarioId,
    p_fecha: fecha,
  });
}

export async function reabrirClase(horarioId: string, fecha: string) {
  return llamar(horarioId, fecha, "reabrir_clase_fecha", {
    p_horario_id: horarioId,
    p_fecha: fecha,
  });
}

export async function asignarSala(horarioId: string, fecha: string, salaId: string | null) {
  return llamar(horarioId, fecha, "asignar_sala_horario", { p_horario_id: horarioId, p_sala_id: salaId });
}
