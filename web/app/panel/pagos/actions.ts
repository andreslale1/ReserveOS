"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function llamar(fn: string, args: Record<string, unknown>) {
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, args);
  if (error) return { error: error.message };
  revalidatePath("/panel/pagos");
  return { error: null };
}
export async function resolverReembolso(id: string, aprobar: boolean, nota: string) {
  return llamar("reembolso_resolver", { p_id: id, p_aprobar: aprobar, p_nota: nota || null });
}
export async function marcarDevuelto(id: string, referencia: string) {
  return llamar("reembolso_marcar_devuelto", { p_id: id, p_referencia: referencia || null });
}
