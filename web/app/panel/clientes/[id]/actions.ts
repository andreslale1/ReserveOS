"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Res = { error: string | null };

async function llamar(
  clienteId: string,
  fn: string,
  args: Record<string, unknown>,
): Promise<Res> {
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, args);
  if (error) {
    return { error: error.message };
  }
  revalidatePath(`/panel/clientes/${clienteId}`);
  revalidatePath("/panel/clientes");
  return { error: null };
}

// P12
export async function guardarFicha(
  clienteId: string,
  f: {
    nombre: string;
    telefono: string;
    email: string;
    notas: string;
    cuidados: string;
    emergencia: string;
    nacimiento: string;
  },
) {
  return llamar(clienteId, "actualizar_cliente", {
    p_cliente_id: clienteId,
    p_nombre: f.nombre,
    p_telefono: f.telefono,
    p_email: f.email || null,
    p_notas: f.notas || null,
    p_cuidados_especiales: f.cuidados || null,
    p_contacto_emergencia: f.emergencia || null,
    p_fecha_nacimiento: f.nacimiento || null,
  });
}

// P24 / P25: vender o dar de cortesía (metodo = "cortesia")
export async function venderPaquete(
  clienteId: string,
  i: {
    paqueteId: string;
    sedeId: string;
    metodo: string;
    codigo: string;
  },
) {
  return llamar(clienteId, "agregar_membresia_manual", {
    p_cliente_id: clienteId,
    p_paquete_id: i.paqueteId,
    p_sede_venta_id: i.sedeId,
    p_metodo_pago: i.metodo,
    p_codigo_descuento: i.codigo || null,
  });
}

// P25
export async function ajustarCreditos(
  clienteId: string,
  membresiaId: string,
  delta: number,
  motivo: string,
) {
  return llamar(clienteId, "ajustar_creditos_membresia", {
    p_membresia_id: membresiaId,
    p_delta: delta,
    p_motivo: motivo,
  });
}

// P26 / P27 (congelar, descongelar, transferir)
export async function congelar(clienteId: string, membresiaId: string) {
  return llamar(clienteId, "congelar_membresia", { p_membresia_id: membresiaId });
}
export async function descongelar(clienteId: string, membresiaId: string) {
  return llamar(clienteId, "descongelar_membresia", {
    p_membresia_id: membresiaId,
  });
}
export async function transferir(
  clienteId: string,
  membresiaId: string,
  destinoId: string,
) {
  return llamar(clienteId, "transferir_membresia", {
    p_membresia_id: membresiaId,
    p_cliente_destino_id: destinoId,
  });
}

// P18
export async function reservarPorClienta(
  clienteId: string,
  horarioId: string,
  fecha: string,
) {
  return llamar(clienteId, "admin_agregar_reserva", {
    p_cliente_id: clienteId,
    p_horario_id: horarioId,
    p_fecha: fecha,
  });
}
export async function cancelarReservaDeClienta(
  clienteId: string,
  reservaId: string,
) {
  return llamar(clienteId, "admin_cancelar_reserva", { p_reserva_id: reservaId });
}
