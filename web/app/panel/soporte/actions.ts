"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function abrirTicket(tenantId: string, asunto: string, descripcion: string, prioridad: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("ticket_crear", { p_tenant_id: tenantId, p_asunto: asunto, p_descripcion: descripcion || null, p_prioridad: prioridad, p_sede_nombre: null, p_version: null });
  if (error) return { error: error.message };
  revalidatePath("/panel/soporte");
  return { error: null };
}
export async function escribirTicket(id: string, mensaje: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("ticket_mensaje_estudio", { p_ticket_id: id, p_mensaje: mensaje });
  if (error) return { error: error.message };
  revalidatePath("/panel/soporte");
  return { error: null };
}
export async function verTicket(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("mi_ticket_detalle", { p_ticket_id: id });
  return data as { ticket: { asunto: string; estado: string }; mensajes: { autor_nombre: string | null; es_equipo: boolean; mensaje: string; created_at: string }[] } | null;
}
