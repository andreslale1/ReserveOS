"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function llamar(fn: string, args: Record<string, unknown>) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { error: error.message, data: null };
  revalidatePath("/owner/cobros");
  return { error: null, data };
}

export async function guardarSuscripcion(tenantId: string, plan: string, precio: number, dia: number, estado: string) {
  return llamar("suscripcion_guardar", { p_tenant_id: tenantId, p_plan: plan, p_precio_mensual: precio, p_dia_cobro: dia, p_estado: estado });
}
export async function generarCobros(periodo: string) {
  return llamar("generar_cobros_mes", { p_periodo: periodo });
}
export async function registrarPago(cobroId: string, metodo: string, referencia: string, fecha: string, monto: number | null) {
  return llamar("registrar_pago_cobro", { p_cobro_id: cobroId, p_metodo: metodo, p_referencia: referencia || null, p_fecha: fecha || null, p_monto: monto });
}
export async function crearCobro(tenantId: string, concepto: string, monto: number, descuento: number, vence: string, notas: string) {
  return llamar("cobro_crear", { p_tenant_id: tenantId, p_concepto: concepto, p_monto: monto, p_descuento: descuento, p_vence: vence || null, p_notas: notas || null });
}
export async function anularCobro(cobroId: string) {
  return llamar("anular_cobro_plataforma", { p_cobro_id: cobroId });
}
export async function cambiarEstadoEstudio(tenantId: string, status: string) {
  return llamar("cambiar_estado_tenant_plataforma", { p_tenant_id: tenantId, p_status: status });
}
