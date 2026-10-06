import { getOwnerContext } from "@/lib/owner-context";
import EquipoView, { type Miembro } from "./equipo-view";

export default async function EquipoPage() {
  const { supabase } = await getOwnerContext();
  const [{ data, error }, { data: rol }] = await Promise.all([supabase.rpc("equipo_listar"), supabase.rpc("mi_rol_plataforma")]);
  if (error) return <main className="mx-auto max-w-3xl px-6 py-16 text-center text-white/60">{error.message}</main>;
  return <EquipoView miembros={(data ?? []) as Miembro[]} puedeEditar={rol === "operador"} />;
}
