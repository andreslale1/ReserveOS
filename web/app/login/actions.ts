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

  if (next === "/panel") {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: esOperador } = user
      ? await supabase
          .from("plataforma_staff")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle()
      : { data: null };
    if (esOperador) {
      redirect("/owner");
    }
  }

  redirect(next);
}
