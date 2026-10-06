"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_ESTUDIO, type Contexto } from "@/lib/cuenta-context";
import { createClient } from "@/lib/supabase/server";

export async function elegirEstudio(formData: FormData) {
  const tenantId = String(formData.get("tenant_id") ?? "");
  const supabase = await createClient();
  const { data } = await supabase.rpc("mis_contextos");
  const valido = ((data ?? []) as Contexto[]).some((c) => c.tenant_id === tenantId && c.es_clienta);
  if (!valido) redirect("/elegir-estudio");
  (await cookies()).set(COOKIE_ESTUDIO, tenantId, { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 60 * 60 * 24 * 90 });
  redirect("/cuenta");
}
