"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function hacerCheckin() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("hacer_checkin");
  if (error) return { error: error.message, clase: null as string | null };
  revalidatePath("/cuenta");
  return { error: null, clase: (data as { clase: string }).clase };
}
