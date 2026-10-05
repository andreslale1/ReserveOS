import { getOwnerContext } from "@/lib/owner-context";
import TareasView, { type Tarea } from "./tareas-view";

export default async function TareasPage() {
  const { supabase } = await getOwnerContext();
  const { data, error } = await supabase.rpc("tareas_listar");
  if (error) return <main className="mx-auto max-w-3xl px-6 py-16 text-center text-white/60">{error.message}</main>;
  return <TareasView tareas={(data ?? []) as Tarea[]} />;
}
