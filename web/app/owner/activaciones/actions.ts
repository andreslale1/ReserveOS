"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function refrescar() {
  revalidatePath("/owner/activaciones");
  revalidatePath("/owner");
}
async function llamar(fn: string, args: Record<string, unknown>) {
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, args);
  if (error) return { error: error.message };
  refrescar();
  return { error: null };
}
export async function marcarEtapa(id: string, key: string, hecha: boolean) {
  return llamar("proyecto_etapa", { p_id: id, p_key: key, p_hecha: hecha });
}
export async function vincularEstudio(id: string, tenantId: string) {
  return llamar("proyecto_vincular_estudio", { p_id: id, p_tenant_id: tenantId });
}
export async function publicarProyecto(id: string, excepcion?: string) {
  return llamar("proyecto_publicar", { p_id: id, p_excepcion: excepcion?.trim() || null });
}
export async function marcarHitoModulo(tenantId: string, modulo: string, hito: string, hecho: boolean, evidencia?: string) {
  return llamar("modulo_hito_marcar", { p_tenant_id: tenantId, p_module: modulo, p_hito: hito, p_hecho: hecho, p_evidencia: evidencia?.trim() || null });
}
export async function altaManual(i: { slug: string; nombre: string; sede: string; motivo: string; email: string; nombreDuena: string; confirmar: boolean }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("alta_estudio_manual", {
    p_slug: i.slug, p_name: i.nombre, p_sede_nombre: i.sede, p_motivo: i.motivo, p_timezone: "America/Guatemala",
    p_email_duena: i.email || null, p_nombre_duena: i.nombreDuena || null, p_confirmar_duplicado: i.confirmar,
  });
  if (error) return { error: error.message, token: null as string | null };
  refrescar();
  return { error: null, token: ((data as { token?: string | null })?.token ?? null) as string | null };
}
