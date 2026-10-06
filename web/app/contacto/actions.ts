"use server";

import { createClient } from "@/lib/supabase/server";

export async function enviarConsulta(_prev: { ok: boolean; error: string | null } | null, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("captar_lead", {
    p_nombre_empresa: String(formData.get("empresa") ?? ""),
    p_contacto: String(formData.get("nombre") ?? ""),
    p_email: String(formData.get("email") ?? ""),
    p_telefono: String(formData.get("telefono") ?? ""),
    p_ciudad: String(formData.get("ciudad") ?? ""),
    p_mensaje: String(formData.get("mensaje") ?? ""),
    p_fuente: String(formData.get("fuente") ?? "web"),
    p_trampa: String(formData.get("sitio") ?? ""),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, error: null };
}
