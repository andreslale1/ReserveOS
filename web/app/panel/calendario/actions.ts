"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function crearHorario(input: {
  tenantId: string;
  sedeId: string;
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
  nombreClase: string;
  cupoMaximo: number;
  instructorMembershipId: string | null;
}) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("crear_horario", {
    p_tenant_id: input.tenantId,
    p_sede_id: input.sedeId,
    p_dia_semana: input.diaSemana,
    p_hora_inicio: input.horaInicio,
    p_hora_fin: input.horaFin,
    p_nombre_clase: input.nombreClase,
    p_cupo_maximo: input.cupoMaximo,
    p_instructor_membership_id: input.instructorMembershipId,
  });
  if (error) {
    return { error: error.message };
  }
  revalidatePath("/panel/calendario");
  return { error: null };
}
