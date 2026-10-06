"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function guardarMarca(tenantId: string, nombre: string, colorPrimario: string, logoUrl: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("actualizar_marca", {
    p_tenant_id: tenantId,
    p_nombre: nombre,
    p_branding: { color_primario: colorPrimario || null, logo_url: logoUrl || null },
  });
  if (error) return { error: error.message };
  revalidatePath("/panel/configuracion");
  revalidatePath("/panel", "layout");
  return { error: null };
}

export async function guardarReglas(tenantId: string, r: { horasCancelacion: number; horasConfirmacion: number; devuelveCredito: boolean; anticipacionDias: number; maxPorDia: number | null }) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("guardar_reglas_reservas", {
    p_tenant_id: tenantId, p_horas_cancelacion: r.horasCancelacion, p_horas_confirmacion: r.horasConfirmacion,
    p_devuelve_credito: r.devuelveCredito, p_anticipacion_dias: r.anticipacionDias, p_max_por_dia: r.maxPorDia,
  });
  if (error) return { error: error.message };
  revalidatePath("/panel/configuracion");
  return { error: null };
}
