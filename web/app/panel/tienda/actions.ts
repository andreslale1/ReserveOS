"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function marcarCarritoPerdido(carritoId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("marcar_carrito_perdido", {
    p_carrito_id: carritoId,
  });
  if (error) {
    return { error: error.message };
  }
  revalidatePath("/panel/tienda");
  return { error: null };
}
