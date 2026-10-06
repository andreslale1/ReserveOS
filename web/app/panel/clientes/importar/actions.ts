"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type Resultado = { validas: number; duplicadas: number; con_error: number; importadas: number; errores: { fila: number; nombre: string; motivo: string }[] };

export async function importar(tenantId: string, filas: { nombre: string; telefono: string; email: string }[], soloValidar: boolean) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("importar_clientes", { p_tenant_id: tenantId, p_filas: filas, p_solo_validar: soloValidar });
  if (error) return { error: error.message, resultado: null };
  if (!soloValidar) revalidatePath("/panel/clientes");
  return { error: null, resultado: data as Resultado };
}
