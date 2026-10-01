"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function crearCodigoDescuento(input: {
  tenantId: string;
  codigo: string;
  descuentoPct: number;
  usosMaximos: number | null;
  vigenteHasta: string | null;
}) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("crear_codigo_descuento", {
    p_tenant_id: input.tenantId,
    p_codigo: input.codigo,
    p_descuento_pct: input.descuentoPct,
    p_usos_maximos: input.usosMaximos,
    p_vigente_hasta: input.vigenteHasta,
  });
  if (error) {
    return { error: error.message };
  }
  revalidatePath("/panel/descuentos");
  return { error: null };
}

export async function toggleCodigoDescuento(codigoId: string, activo: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("actualizar_codigo_descuento", {
    p_codigo_id: codigoId,
    p_activo: activo,
  });
  if (error) {
    return { error: error.message };
  }
  revalidatePath("/panel/descuentos");
  return { error: null };
}
