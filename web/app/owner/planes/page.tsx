import { getOwnerContext } from "@/lib/owner-context";
import PlanesView, { type Plan, type ModuloCat } from "./planes-view";

export default async function PlanesPage() {
  const { supabase, operador } = await getOwnerContext();
  const [{ data: planes, error }, { data: mods }] = await Promise.all([
    supabase.rpc("planes_listar"),
    supabase.from("module_catalog").select("key, name, description, depends_on").order("name"),
  ]);
  if (error) {
    return <main className="mx-auto max-w-3xl px-6 py-16 text-center text-white/60">{error.message}</main>;
  }
  return <PlanesView planes={(planes ?? []) as Plan[]} modulos={(mods ?? []) as ModuloCat[]} soloLectura={operador.rol !== "operador"} />;
}
