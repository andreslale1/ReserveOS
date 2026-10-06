"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function llamar(fn: string, args: Record<string, unknown>) {
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, args);
  if (error) return { error: error.message };
  revalidatePath("/cuenta", "layout");
  return { error: null };
}
export async function guardarPerfil(tenantId: string, p: { nombre: string; telefono: string; email: string; emergencia: string; cuidados: string }) {
  return llamar("actualizar_mi_perfil", { p_tenant_id: tenantId, p_nombre: p.nombre, p_telefono: p.telefono, p_email: p.email, p_contacto_emergencia: p.emergencia, p_cuidados: p.cuidados });
}
export async function agregarDependiente(tenantId: string, nombre: string, nacimiento: string) {
  return llamar("agregar_dependiente", { p_tenant_id: tenantId, p_nombre: nombre, p_fecha_nacimiento: nacimiento || null });
}
export async function quitarDependiente(tenantId: string, id: string) {
  return llamar("eliminar_dependiente", { p_tenant_id: tenantId, p_id: id });
}
export async function firmarConsentimiento(tenantId: string, c: { emergencia: string; cuidados: string; experiencia: string; responsabilidad: boolean; cancelacion: boolean; imagen: boolean; firma: string }) {
  return llamar("completar_consentimiento", {
    p_tenant_id: tenantId, p_contacto_emergencia: c.emergencia, p_cuidados_especiales: c.cuidados, p_objetivos: [], p_objetivo_otro: null,
    p_experiencia_pilates: c.experiencia, p_consiente_responsabilidad: c.responsabilidad, p_consiente_cancelacion: c.cancelacion, p_autoriza_imagen: c.imagen, p_firma_nombre: c.firma,
  });
}
