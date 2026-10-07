import { getOwnerContext } from "@/lib/owner-context";
import EquipoView, { type Invitacion, type Miembro } from "./equipo-view";

export default async function EquipoPage() {
  const { supabase, user } = await getOwnerContext();
  const [{ data, error }, { data: invs }, { data: rol }] = await Promise.all([
    supabase.rpc("equipo_listar"), supabase.rpc("equipo_invitaciones_listar"), supabase.rpc("mi_rol_plataforma"),
  ]);
  if (error) return <main className="mx-auto max-w-3xl px-6 py-16 text-center text-white/60" role="alert">{error.message}</main>;
  return <EquipoView miembros={(data ?? []) as Miembro[]} invitaciones={(invs ?? []) as Invitacion[]} puedeEditar={rol === "operador"} yoId={user.id} />;
}
