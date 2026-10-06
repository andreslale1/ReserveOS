"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function pedirReembolso(membresiaId: string, monto: number, motivo: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reembolso_solicitar", { p_membresia_id: membresiaId, p_monto: monto, p_motivo: motivo });
  if (error) return { error: error.message };
  revalidatePath("/cuenta/historial");
  return { error: null };
}
