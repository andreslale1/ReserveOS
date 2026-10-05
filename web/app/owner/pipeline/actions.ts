"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function crearProspecto(i: {
  nombre: string; tipo: string; ciudad: string; sitioWeb: string; fuente: string;
  valor: number; numSedes: number | null; planInteres: string; etapa: string;
  proximoPaso: string; proximoPasoFecha: string;
  contacto: string; cargo: string; telefono: string; email: string;
}) {
  const supabase = await createClient();
  const { data: empresaId, error: e1 } = await supabase.rpc("empresa_guardar", {
    p_id: null, p_nombre: i.nombre, p_tipo: i.tipo, p_ciudad: i.ciudad || null, p_sitio_web: i.sitioWeb || null,
    p_tamano_sedes: i.numSedes, p_fuente: i.fuente || null, p_notas: null,
  });
  if (e1) return { error: e1.message };
  if (i.contacto.trim()) {
    const { error: e2 } = await supabase.rpc("contacto_guardar", {
      p_id: null, p_empresa_id: empresaId, p_nombre: i.contacto, p_cargo: i.cargo || null,
      p_telefono: i.telefono || null, p_email: i.email || null, p_es_decisor: true,
    });
    if (e2) return { error: e2.message };
  }
  const { error: e3 } = await supabase.rpc("oportunidad_guardar", {
    p_id: null, p_empresa_id: empresaId, p_valor_mensual: i.valor, p_etapa: i.etapa,
    p_plan_interes: i.planInteres || null, p_num_sedes: i.numSedes, p_probabilidad: null,
    p_proximo_paso: i.proximoPaso || null, p_proximo_paso_fecha: i.proximoPasoFecha || null,
    p_fuente: i.fuente || null, p_motivo_perdida: null, p_notas: null,
  });
  if (e3) return { error: e3.message };
  revalidatePath("/owner/pipeline");
  return { error: null };
}
export async function cambiarEtapa(id: string, etapa: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("lead_cambiar_etapa", { p_id: id, p_etapa: etapa });
  if (error) return { error: error.message };
  revalidatePath("/owner/pipeline");
  revalidatePath("/owner/activaciones");
  return { error: null };
}
export async function eliminarLead(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("lead_eliminar", { p_id: id });
  if (error) return { error: error.message };
  revalidatePath("/owner/pipeline");
  return { error: null };
}
