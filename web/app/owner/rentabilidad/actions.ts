"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function guardarCosto(fecha: string, categoria: string, descripcion: string, monto: number, tenantId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("costo_guardar", { p_fecha: fecha || null, p_categoria: categoria, p_descripcion: descripcion || null, p_monto: monto, p_tenant_id: tenantId || null });
  if (error) return { error: error.message };
  revalidatePath("/owner/rentabilidad");
  return { error: null };
}
export async function borrarCosto(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("costo_eliminar", { p_id: id });
  if (error) return { error: error.message };
  revalidatePath("/owner/rentabilidad");
  return { error: null };
}
