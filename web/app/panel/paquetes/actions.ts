"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function crearPaquete(input: {
  tenantId: string;
  nombre: string;
  precio: number;
  vigenciaDias: number;
  numClases: number | null;
  cobertura: string;
  sedeIds: string[];
  descripcion: string;
}) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("crear_paquete", {
    p_tenant_id: input.tenantId,
    p_nombre: input.nombre,
    p_precio: input.precio,
    p_vigencia_dias: input.vigenciaDias,
    p_num_clases: input.numClases,
    p_cobertura: input.cobertura,
    p_sede_ids: input.sedeIds,
    p_descripcion: input.descripcion || null,
  });
  if (error) {
    return { error: error.message };
  }
  revalidatePath("/panel/paquetes");
  return { error: null };
}

export async function toggleActivoPaquete(paqueteId: string, activo: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("actualizar_paquete", {
    p_paquete_id: paqueteId,
    p_activo: activo,
  });
  if (error) {
    return { error: error.message };
  }
  revalidatePath("/panel/paquetes");
  return { error: null };
}
