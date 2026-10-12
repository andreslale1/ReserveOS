"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { destinoSeguro, slugSeguro } from "@/lib/destino";

type Pendiente = { tenant_id: string; nombre: string; telefono: string; genero?: string; como?: string; ref?: string };

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = destinoSeguro(formData.get("next") as string, "/panel");
  const e = slugSeguro(formData.get("e") as string);
  const volver = (msg: string) => redirect(`/login?error=${encodeURIComponent(msg)}&next=${encodeURIComponent(next)}${e ? `&e=${e}` : ""}`);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Mensaje único para correo inexistente o contraseña errada (no revela si la cuenta existe).
    volver(/confirm/i.test(error.message) ? "Confirma tu correo con el enlace que te enviamos y vuelve a entrar." : "Correo o contraseña incorrectos.");
  }

  const { data: { user } } = await supabase.auth.getUser();

  // Registro autónomo: si la persona confirmó su correo en otro momento, la ficha de clienta se crea en su primer ingreso.
  const pendiente = user?.user_metadata?.registro_pendiente as Pendiente | undefined;
  if (user && pendiente?.tenant_id) {
    const { error: errReg } = await supabase.rpc("registrar_clienta", {
      p_tenant_id: pendiente.tenant_id, p_nombre: pendiente.nombre, p_telefono: pendiente.telefono,
      p_genero: pendiente.genero ?? null, p_codigo_referido: pendiente.ref ?? null, p_como_se_entero: pendiente.como ?? null, p_es_cuenta_familiar: false,
    });
    if (!errReg) await supabase.auth.updateUser({ data: { registro_pendiente: null } });
  }

  // Sin destino explícito, cada persona llega a lo suyo: operador, personal del estudio o clienta.
  if (next === "/panel" && user) {
    const [{ data: esOperador }, { data: esStaff }, { data: esClienta }] = await Promise.all([
      supabase.from("plataforma_staff").select("id").eq("user_id", user.id).maybeSingle(),
      supabase.from("tenant_memberships").select("id").eq("user_id", user.id).limit(1).maybeSingle(),
      supabase.from("clientes").select("id").eq("user_id", user.id).limit(1).maybeSingle(),
    ]);
    if (esOperador) redirect("/owner/direccion");
    if (!esStaff && esClienta) redirect("/cuenta");
  }

  redirect(next);
}
