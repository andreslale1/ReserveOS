"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function llamar(id: string, fn: string, args: Record<string, unknown>) {
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, args);
  if (error) return { error: error.message };
  revalidatePath(`/owner/pipeline/${id}`);
  revalidatePath("/owner/pipeline");
  revalidatePath("/owner/tareas");
  revalidatePath("/owner/activaciones");
  return { error: null };
}

export async function guardarOportunidad(leadId: string, empresaId: string, f: {
  valor: number; etapa: string; planInteres: string; numSedes: number | null; probabilidad: number | null;
  proximoPaso: string; proximoPasoFecha: string; fuente: string; motivoPerdida: string; notas: string;
}) {
  return llamar(leadId, "oportunidad_guardar", {
    p_id: leadId, p_empresa_id: empresaId, p_valor_mensual: f.valor, p_etapa: f.etapa, p_plan_interes: f.planInteres || null,
    p_num_sedes: f.numSedes, p_probabilidad: f.probabilidad, p_proximo_paso: f.proximoPaso || null,
    p_proximo_paso_fecha: f.proximoPasoFecha || null, p_fuente: f.fuente || null,
    p_motivo_perdida: f.motivoPerdida || null, p_notas: f.notas || null,
  });
}
export async function guardarContacto(leadId: string, empresaId: string, c: { nombre: string; cargo: string; telefono: string; email: string; decisor: boolean }) {
  return llamar(leadId, "contacto_guardar", {
    p_id: null, p_empresa_id: empresaId, p_nombre: c.nombre, p_cargo: c.cargo || null,
    p_telefono: c.telefono || null, p_email: c.email || null, p_es_decisor: c.decisor,
  });
}
export async function eliminarContacto(leadId: string, id: string) {
  return llamar(leadId, "contacto_eliminar", { p_id: id });
}
export async function registrarActividad(leadId: string, tipo: string, resumen: string) {
  return llamar(leadId, "actividad_registrar", { p_lead_id: leadId, p_empresa_id: null, p_tipo: tipo, p_resumen: resumen });
}
export async function crearTarea(leadId: string, titulo: string, vence: string) {
  return llamar(leadId, "tarea_guardar", { p_id: null, p_lead_id: leadId, p_tenant_id: null, p_titulo: titulo, p_vence: vence || null });
}
export async function completarTarea(leadId: string, id: string, hecha: boolean) {
  return llamar(leadId, "tarea_completar", { p_id: id, p_hecha: hecha });
}
