"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function verificarAhora() {
  const supabase = await createClient();
  const { error } = await supabase.rpc("salud_verificar");
  if (error) return { error: error.message };
  revalidatePath("/owner/salud");
  return { error: null };
}
