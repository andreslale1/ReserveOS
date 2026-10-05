"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function asignarSede(tenantMembershipId: string, sedeId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("asignar_sede_personal", {
    p_tenant_membership_id: tenantMembershipId,
    p_sede_id: sedeId,
  });
  if (error) {
    return { error: error.message };
  }
  revalidatePath("/panel/personal");
  return { error: null };
}

export async function crearInvitacionPersonal(input: {
  tenantId: string;
  email: string;
  role: string;
  nombre: string;
  sedeIds: string[];
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crear_invitacion_personal", {
    p_tenant_id: input.tenantId,
    p_email: input.email,
    p_role: input.role,
    p_nombre: input.nombre,
    p_sede_ids: input.sedeIds,
  });
  if (error) {
    return { error: error.message, token: null };
  }
  revalidatePath("/panel/personal");
  return { error: null, token: data as string };
}

export async function quitarSede(tenantMembershipId: string, sedeId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("quitar_sede_personal", {
    p_tenant_membership_id: tenantMembershipId,
    p_sede_id: sedeId,
  });
  if (error) {
    return { error: error.message };
  }
  revalidatePath("/panel/personal");
  return { error: null };
}
