"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function verificarOperador() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false as const, error: "No autenticado" };
  }
  const { data: operador } = await supabase
    .from("plataforma_staff")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!operador) {
    return { ok: false as const, error: "No autorizado" };
  }
  return { ok: true as const, supabase };
}

export async function crearEstudio(input: {
  slug: string;
  name: string;
  sedeNombre: string;
  timezone: string;
}) {
  const check = await verificarOperador();
  if (!check.ok) {
    return { error: check.error };
  }

  const { error } = await check.supabase.rpc("crear_tenant_plataforma", {
    p_slug: input.slug,
    p_name: input.name,
    p_sede_nombre: input.sedeNombre,
    p_timezone: input.timezone || "America/Guatemala",
  });
  if (error) {
    return { error: error.message };
  }

  revalidatePath("/owner");
  return { error: null };
}

export async function cambiarEstadoEstudio(tenantId: string, status: string) {
  const check = await verificarOperador();
  if (!check.ok) {
    return { error: check.error };
  }
  const { error } = await check.supabase.rpc(
    "cambiar_estado_tenant_plataforma",
    { p_tenant_id: tenantId, p_status: status },
  );
  if (error) {
    return { error: error.message };
  }
  revalidatePath("/owner");
  return { error: null };
}
