"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function reenviarAcceso(clienteId: string): Promise<{ error: string | null; enlace: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reenviar_acceso_clienta", { p_cliente_id: clienteId });
  if (error) return { error: error.message, enlace: null };
  revalidatePath(`/panel/clientes/${clienteId}`);
  return { error: null, enlace: `/invitar/clienta/${data as string}` };
}

export async function recordarConsentimientoClienta(clienteId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("recordar_consentimiento", { p_cliente_id: clienteId });
  if (error) return { error: error.message };
  return { error: null };
}

export async function eliminarCuenta(clienteId: string, nombre: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("eliminar_cliente", { p_cliente_id: clienteId, p_confirmar_nombre: nombre });
  if (error) return { error: error.message };
  revalidatePath("/panel/clientes");
  return { error: null };
}
