import { getOwnerContext } from "@/lib/owner-context";
import DominiosView, { type Dominio } from "./dominios-view";

export default async function DominiosPage() {
  const { supabase } = await getOwnerContext();
  const { data, error } = await supabase.rpc("dominios_plataforma");
  if (error) return <main className="mx-auto max-w-3xl px-6 py-16 text-center text-white/60" role="alert">{error.message}</main>;
  return <DominiosView dominios={(data ?? []) as Dominio[]} />;
}
