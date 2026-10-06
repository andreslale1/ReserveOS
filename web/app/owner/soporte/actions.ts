"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function llamar(fn: string, args: Record<string, unknown>, rutas: string[]) {
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, args);
  if (error) return { error: error.message };
  rutas.forEach((r) => revalidatePath(r));
  return { error: null };
}
export async function responderTicket(id: string, mensaje: string, interno: boolean) {
  return llamar("ticket_responder", { p_id: id, p_mensaje: mensaje, p_interno: interno }, [`/owner/soporte/${id}`]);
}
export async function actualizarTicket(id: string, estado: string, prioridad: string, asignado: string, causa: string) {
  return llamar("ticket_actualizar", { p_id: id, p_estado: estado, p_prioridad: prioridad, p_asignado: asignado, p_causa: causa }, [`/owner/soporte/${id}`, "/owner/soporte"]);
}
export async function guardarIncidente(i: { id: string | null; titulo: string; descripcion: string; severidad: string; estado: string; tenantId: string; nota: string }) {
  return llamar("incidente_guardar", { p_id: i.id, p_titulo: i.titulo, p_descripcion: i.descripcion || null, p_severidad: i.severidad, p_estado: i.estado, p_tenant_id: i.tenantId || null, p_nota: i.nota || null }, ["/owner/soporte"]);
}
