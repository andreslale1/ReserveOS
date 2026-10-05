"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function confirmarPago(membresiaId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("confirmar_pago_membresia", {
    p_membresia_id: membresiaId,
  });
  if (error) {
    return { error: error.message };
  }
  revalidatePath("/panel/pagos-pendientes");
  return { error: null };
}

export async function rechazarPago(membresiaId: string, motivo: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("rechazar_membresia_pendiente", {
    p_membresia_id: membresiaId,
    p_motivo: motivo || null,
  });
  if (error) {
    return { error: error.message };
  }
  revalidatePath("/panel/pagos-pendientes");
  return { error: null };
}
