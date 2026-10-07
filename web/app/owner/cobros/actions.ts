"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type VistaPrevia = {
  periodo: string; cantidad: number; total: number;
  a_generar: { tenant_id: string; estudio: string; plan: string; monto: number; vence: string }[];
  ya_existentes: { tenant_id: string; estudio: string; monto: number; estado: string }[];
  excepciones: { tenant_id: string; estudio: string; motivo: string }[];
};

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
// El período lo decide el servidor (mes actual en Guatemala) cuando se manda null.
export async function vistaPreviaCobros(periodo: string | null) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generar_cobros_vista_previa", { p_periodo: periodo });
  if (error) return { error: error.message, data: null };
  return { error: null, data: data as VistaPrevia };
}
export async function generarCobros(periodo: string | null) {
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
