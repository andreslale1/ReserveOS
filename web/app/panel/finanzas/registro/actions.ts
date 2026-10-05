"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function llamar(fn: string, args: Record<string, unknown>) {
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, args);
  if (error) return { error: error.message };
  revalidatePath("/panel/finanzas/registro");
  revalidatePath("/panel/finanzas");
  return { error: null };
}

export async function registrarGasto(i: {
  tenantId: string;
  sedeId: string | null;
  fecha: string;
  categoria: string;
  descripcion: string;
  monto: number;
  tipo: string;
  metodo: string;
}) {
  return llamar("registrar_gasto", {
    p_tenant_id: i.tenantId,
    p_sede_id: i.sedeId,
    p_fecha: i.fecha,
    p_categoria: i.categoria,
    p_descripcion: i.descripcion || null,
    p_monto: i.monto,
    p_tipo: i.tipo,
    p_metodo_pago: i.metodo || null,
  });
}
export async function eliminarGasto(id: string) {
  return llamar("eliminar_gasto", { p_gasto_id: id });
}
export async function registrarActivoPasivo(i: {
  tenantId: string;
  tabla: "activos" | "pasivos";
  descripcion: string;
  fecha: string;
  monto: number;
}) {
  return llamar("registrar_activo_pasivo", {
    p_tenant_id: i.tenantId,
    p_tabla: i.tabla,
    p_descripcion: i.descripcion,
    p_fecha: i.fecha,
    p_monto: i.monto,
  });
}
export async function eliminarActivoPasivo(tabla: "activos" | "pasivos", id: string) {
  return llamar("eliminar_activo_pasivo", { p_tabla: tabla, p_id: id });
}
export async function definirMeta(tenantId: string, mes: string, meta: number) {
  return llamar("definir_meta_mensual", { p_tenant_id: tenantId, p_mes: mes, p_meta: meta });
}
