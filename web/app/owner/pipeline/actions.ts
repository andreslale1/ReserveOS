"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type LeadInput = {
  id: string | null;
  nombre: string;
  contacto: string;
  telefono: string;
  email: string;
  ciudad: string;
  tipo: string;
  valor: number;
  etapa: string;
  proximoPaso: string;
  proximoPasoFecha: string;
  notas: string;
};

export async function guardarLead(i: LeadInput) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("lead_guardar", {
    p_id: i.id,
    p_nombre: i.nombre,
    p_contacto: i.contacto || null,
    p_telefono: i.telefono || null,
    p_email: i.email || null,
    p_ciudad: i.ciudad || null,
    p_tipo: i.tipo,
    p_valor_mensual: i.valor,
    p_etapa: i.etapa,
    p_proximo_paso: i.proximoPaso || null,
    p_proximo_paso_fecha: i.proximoPasoFecha || null,
    p_notas: i.notas || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/owner/pipeline");
  return { error: null };
}
export async function cambiarEtapa(id: string, etapa: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("lead_cambiar_etapa", { p_id: id, p_etapa: etapa });
  if (error) return { error: error.message };
  revalidatePath("/owner/pipeline");
  return { error: null };
}
export async function eliminarLead(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("lead_eliminar", { p_id: id });
  if (error) return { error: error.message };
  revalidatePath("/owner/pipeline");
  return { error: null };
}
