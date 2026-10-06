"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function crearDelegacion(i: { tenantId: string; membershipId: string | null; rol: string | null; accion: string; sedeIds: string[] | null; vence: string; motivo: string }) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delegacion_crear", {
    p_tenant_id: i.tenantId, p_membership_id: i.membershipId, p_rol: i.rol, p_action: i.accion,
    p_sede_ids: i.sedeIds && i.sedeIds.length ? i.sedeIds : null, p_vence: i.vence || null, p_motivo: i.motivo,
  });
  if (error) return { error: error.message };
  revalidatePath("/panel/delegaciones");
  return { error: null };
}
export async function revocarDelegacion(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delegacion_revocar", { p_id: id });
  if (error) return { error: error.message };
  revalidatePath("/panel/delegaciones");
  return { error: null };
}
