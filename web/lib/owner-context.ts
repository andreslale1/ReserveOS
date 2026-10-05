import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function getOwnerContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/owner");
  }

  const { data: operador } = await supabase
    .from("plataforma_staff")
    .select("id, nombre, rol")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!operador) {
    redirect("/panel");
  }

  return { supabase, user, operador };
}
