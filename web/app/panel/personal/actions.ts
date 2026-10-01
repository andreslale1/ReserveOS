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
