import { getOwnerContext } from "@/lib/owner-context";
import CobrosView, { type Cobro, type Estudio, type Resumen } from "./cobros-view";

export default async function CobrosPage() {
  const { supabase } = await getOwnerContext();
  const [{ data: resumen, error }, { data: estudios }, { data: cobros }] = await Promise.all([
    supabase.rpc("plataforma_resumen"),
    supabase.rpc("plataforma_estudios_cobro"),
    supabase.rpc("plataforma_cobros_listar", { p_estado: null }),
  ]);
  if (error) {
    return <main className="mx-auto max-w-3xl px-6 py-16 text-center text-white/60">{error.message}</main>;
  }
  return <CobrosView resumen={resumen as Resumen} estudios={(estudios ?? []) as Estudio[]} cobros={(cobros ?? []) as Cobro[]} />;
}
