import LandingReserveOS from "@/components/sitio/landing-reserveos";
import { createClient } from "@/lib/supabase/server";

// El acceso de la barra cambia según quién mira: operador de ReserveOS, personal de un estudio, clienta o visitante.
async function acceso(): Promise<{ label: string; href: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { label: "Entrar", href: "/login" };
    const [{ data: op }, { data: st }, { data: cl }] = await Promise.all([
      supabase.from("plataforma_staff").select("id").eq("user_id", user.id).maybeSingle(),
      supabase.from("tenant_memberships").select("id").eq("user_id", user.id).limit(1).maybeSingle(),
      supabase.from("clientes").select("id").eq("user_id", user.id).limit(1).maybeSingle(),
    ]);
    if (op) return { label: "Mi consola", href: "/owner/direccion" };
    if (st) return { label: "Mi panel", href: "/panel" };
    if (cl) return { label: "Mi cuenta", href: "/cuenta" };
  } catch { /* sin sesión: acceso normal */ }
  return { label: "Entrar", href: "/login" };
}

export default async function Home() {
  return <LandingReserveOS acceso={await acceso()} />;
}
