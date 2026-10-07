import { getOwnerContext } from "@/lib/owner-context";
import TareasView, { type Tarea, type Opcion } from "./tareas-view";

export default async function TareasPage({ searchParams }: { searchParams: Promise<{ filtro?: string }> }) {
  const { filtro } = await searchParams;
  const { supabase, user } = await getOwnerContext();
  const [{ data, error }, { data: resp }, { data: leads }, { data: tenants }] = await Promise.all([
    supabase.rpc("tareas_listar"),
    supabase.rpc("tareas_responsables"),
    supabase.from("plataforma_leads").select("id, nombre").not("etapa", "in", "(ganado,perdido)").order("nombre").limit(200),
    supabase.rpc("listar_tenants_plataforma"),
  ]);
  if (error) return <main className="mx-auto max-w-3xl px-6 py-16 text-center text-white/70" role="alert">{error.message}</main>;
  return (
    <TareasView
      tareas={(data ?? []) as Tarea[]}
      filtro={filtro === "vencidas" || filtro === "hoy" ? filtro : undefined}
      yo={user.id}
      responsables={((resp ?? []) as { user_id: string; nombre: string }[]).map((r): Opcion => ({ id: r.user_id, nombre: r.nombre }))}
      leads={((leads ?? []) as { id: string; nombre: string }[]).map((l): Opcion => ({ id: l.id, nombre: l.nombre }))}
      estudios={((tenants ?? []) as { id: string; name: string }[]).map((t): Opcion => ({ id: t.id, nombre: t.name }))}
    />
  );
}
