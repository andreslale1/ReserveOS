"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function guardarPlan(i: {
  key: string; nombre: string; descripcion: string; precio: number;
  maxSedes: number | null; maxStaff: number | null; modulos: string[]; activo: boolean;
}) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("plan_guardar", {
    p_key: i.key, p_nombre: i.nombre, p_descripcion: i.descripcion || null, p_precio: i.precio,
    p_max_sedes: i.maxSedes, p_max_staff: i.maxStaff, p_modulos: i.modulos, p_activo: i.activo,
  });
  if (error) return { error: error.message };
  revalidatePath("/owner/planes");
  return { error: null };
}
