"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function refrescar() {
  revalidatePath("/owner/contratos");
  revalidatePath("/owner/cobros");
  revalidatePath("/owner/activaciones");
  revalidatePath("/owner");
}

export async function actualizarContrato(id: string, estado: string, tenantId: string, renovacionAuto: boolean, documento: string, notas: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("contrato_actualizar", { p_id: id, p_estado: estado, p_tenant_id: tenantId || null, p_renovacion_auto: renovacionAuto, p_documento_url: documento || null, p_notas: notas || null });
  if (error) return { error: error.message };
  refrescar();
  return { error: null };
}
export async function cambiarEstadoContrato(id: string, estado: string, firmantes: string, motivo: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("contrato_estado", { p_id: id, p_estado: estado, p_fecha_firma: null, p_firmantes: firmantes || null, p_motivo: motivo || null });
  if (error) return { error: error.message };
  refrescar();
  return { error: null };
}
export async function aplicarSuscripcion(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("contrato_aplicar_suscripcion", { p_id: id });
  if (error) return { error: error.message };
  refrescar();
  return { error: null };
}
export async function altaDesdeContrato(i: { contratoId: string; slug: string; nombre: string; sede: string; zona: string; email: string; nombreDuena: string; confirmar: boolean }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("alta_estudio_desde_contrato", {
    p_contrato_id: i.contratoId, p_slug: i.slug, p_name: i.nombre, p_sede_nombre: i.sede, p_timezone: i.zona || "America/Guatemala",
    p_email_duena: i.email || null, p_nombre_duena: i.nombreDuena || null, p_confirmar_duplicado: i.confirmar,
  });
  if (error) return { error: error.message, resultado: null };
  refrescar();
  return { error: null, resultado: data as { tenant_id: string; sede_id: string; proyecto_id: string; token: string | null; reanudado: boolean } };
}
