"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function llamar(id: string, fn: string, args: Record<string, unknown>) {
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, args);
  if (error) return { error: error.message };
  revalidatePath(`/owner/pipeline/${id}`);
  revalidatePath("/owner/contratos");
  revalidatePath("/owner/activaciones");
  return { error: null };
}
export async function guardarPropuesta(leadId: string, p: { plan: string; sedes: number; sedesExtra: number; setup: number; mensualidad: number; appPropia: boolean; soporte: string; inicio: string; notas: string }) {
  return llamar(leadId, "propuesta_guardar", {
    p_lead_id: leadId, p_plan_key: p.plan || null, p_num_sedes: p.sedes, p_sedes_extra: p.sedesExtra, p_modulos_extra: [],
    p_setup: p.setup, p_mensualidad: p.mensualidad, p_app_propia: p.appPropia, p_soporte: p.soporte, p_inicio: p.inicio || null, p_notas: p.notas || null,
  });
}
export async function cambiarEstadoPropuesta(leadId: string, id: string, estado: string) {
  return llamar(leadId, "propuesta_estado", { p_id: id, p_estado: estado });
}
export async function crearContrato(leadId: string, propuestaId: string, vigencia: number, renovacionAuto: boolean, documento: string) {
  return llamar(leadId, "contrato_crear", { p_propuesta_id: propuestaId, p_fecha_firma: null, p_vigencia_meses: vigencia, p_renovacion_auto: renovacionAuto, p_documento_url: documento || null, p_notas: null });
}
