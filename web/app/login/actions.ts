"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function login(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const next = (formData.get("next") as string) || "/panel";

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`);
  }

  // Sin destino explícito, cada persona llega a lo suyo: operador, personal del estudio o clienta.
  if (next === "/panel") {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const [{ data: esOperador }, { data: esStaff }, { data: esClienta }] = await Promise.all([
        supabase.from("plataforma_staff").select("id").eq("user_id", user.id).maybeSingle(),
        supabase.from("tenant_memberships").select("id").eq("user_id", user.id).limit(1).maybeSingle(),
        supabase.from("clientes").select("id").eq("user_id", user.id).limit(1).maybeSingle(),
      ]);
      if (esOperador) redirect("/owner/direccion");
      if (!esStaff && esClienta) redirect("/cuenta");
    }
  }

  redirect(next);
}
