"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_PANEL } from "@/lib/panel-context";
import { createClient } from "@/lib/supabase/server";

export async function elegirPanel(formData: FormData) {
  const tenantId = String(formData.get("tenant_id") ?? "");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await supabase.from("tenant_memberships").select("tenant_id").eq("user_id", user.id).eq("tenant_id", tenantId).maybeSingle();
  if (!data) redirect("/elegir-panel");     // solo se puede elegir un estudio al que realmente se pertenece
  (await cookies()).set(COOKIE_PANEL, tenantId, { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 60 * 60 * 24 * 30 });
  redirect("/panel");
}
