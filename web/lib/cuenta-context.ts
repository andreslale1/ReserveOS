import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Contexto = { tenant_id: string; estudio: string; slug: string; es_clienta: boolean; cliente_id: string | null; rol_staff: string | null };

export const COOKIE_ESTUDIO = "rs_estudio";

// Una sola identidad, varios estudios: el estudio activo se elige de forma explícita y se valida SIEMPRE contra
// los contextos reales de la persona (nunca se confía en un id que venga del navegador sin comprobarlo).
export async function getCuenta() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/cuenta");

  const { data } = await supabase.rpc("mis_contextos");
  const contextos = ((data ?? []) as Contexto[]).filter((c) => c.es_clienta);
  const todos = (data ?? []) as Contexto[];
  if (contextos.length === 0) {
    return { supabase, user, contextos, todos, actual: null as Contexto | null, dominioEstudio: null as string | null };
  }
  // En el dominio propio de un estudio, el contexto lo manda el host verificado (no una cookie ni un parámetro).
  const hostTenant = (await headers()).get("x-tenant-id");
  if (hostTenant) {
    return { supabase, user, contextos, todos, actual: contextos.find((c) => c.tenant_id === hostTenant) ?? null, dominioEstudio: hostTenant };
  }
  const guardado = (await cookies()).get(COOKIE_ESTUDIO)?.value;
  let actual = contextos.find((c) => c.tenant_id === guardado) ?? null;
  if (!actual && contextos.length === 1) actual = contextos[0];
  if (!actual) redirect("/elegir-estudio");
  return { supabase, user, contextos, todos, actual, dominioEstudio: null as string | null };
}
