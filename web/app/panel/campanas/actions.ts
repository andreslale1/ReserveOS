"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function llamar(fn: string, args: Record<string, unknown>) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { error: error.message, data: null };
  revalidatePath("/panel/campanas");
  return { error: null, data };
}
export async function crearSegmento(tenantId: string, nombre: string, tipo: string, dias: number) {
  return llamar("segmento_guardar", { p_tenant_id: tenantId, p_nombre: nombre, p_tipo: tipo, p_dias: dias });
}
export async function enviarCampana(tenantId: string, nombre: string, segmentoId: string, plantillaId: string, programada: string) {
  const r = await llamar("campana_enviar", { p_tenant_id: tenantId, p_nombre: nombre, p_segmento_id: segmentoId, p_plantilla_id: plantillaId, p_programada: programada ? new Date(programada).toISOString() : null });
  return { error: r.error, resumen: r.data as { encolados: number; omitidos_sin_consentimiento: number; omitidos_sin_destino: number } | null };
}
export async function cancelarCampana(id: string) {
  return llamar("campana_cancelar", { p_id: id });
}
export async function guardarPlantilla(i: { id: string | null; tenantId: string; clave: string; nombre: string; canal: string; asunto: string; cuerpo: string; activa: boolean }) {
  return llamar("plantilla_guardar", { p_id: i.id, p_tenant_id: i.tenantId, p_clave: i.clave, p_nombre: i.nombre, p_canal: i.canal, p_asunto: i.asunto || null, p_cuerpo: i.cuerpo, p_activa: i.activa });
}
