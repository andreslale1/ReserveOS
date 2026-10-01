import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function getClientContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/reservar");
  }

  const { data: cliente } = await supabase
    .from("clientes")
    .select("id, tenant_id, nombre, sede_habitual_id, sedes(id, name, timezone), tenants(name)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  return { supabase, user, cliente };
}
