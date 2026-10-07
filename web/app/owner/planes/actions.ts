"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function guardarPlan(i: {
  key: string; nombre: string; descripcion: string; precio: number; moneda: string; pruebaGratuita: boolean; estado: string; crear: boolean;
  maxSedes: number | null; maxStaff: number | null; modulos: string[];
}) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("plan_guardar", {
    p_key: i.key, p_nombre: i.nombre, p_descripcion: i.descripcion || null, p_precio: i.precio,
    p_max_sedes: i.maxSedes, p_max_staff: i.maxStaff, p_modulos: i.modulos,
    p_estado: i.estado, p_moneda: i.moneda, p_prueba_gratuita: i.pruebaGratuita, p_crear: i.crear,
  });
  if (error) return { error: error.message };
  revalidatePath("/owner/planes");
  return { error: null };
}

export async function impactoPlan(key: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("plan_impacto", { p_key: key });
  if (error) return { error: error.message, impacto: null };
  return { error: null, impacto: data as { suscripciones_activas: number; estudios: number; mrr: number; propuestas_abiertas: number } };
}
