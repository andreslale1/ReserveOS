import { getOwnerContext } from "@/lib/owner-context";
import ActivacionesView, { type Proyecto } from "./activaciones-view";

export default async function ActivacionesPage() {
  const { supabase } = await getOwnerContext();
  const [{ data, error }, { data: tenants }] = await Promise.all([
    supabase.rpc("proyectos_listar"),
    supabase.rpc("listar_tenants_plataforma"),
  ]);
  if (error) return <main className="mx-auto max-w-3xl px-6 py-16 text-center text-white/60">{error.message}</main>;
  return (
    <ActivacionesView
      proyectos={(data ?? []) as Proyecto[]}
      tenants={((tenants ?? []) as { id: string; name: string }[]).map((t) => ({ id: t.id, name: t.name }))}
    />
  );
}
