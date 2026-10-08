import { getOwnerContext } from "@/lib/owner-context";
import ActivacionesView, { type Gate, type ModuloEstado, type Proyecto } from "./activaciones-view";

export default async function ActivacionesPage() {
  const { supabase, operador } = await getOwnerContext();
  const [{ data, error }, { data: tenants }] = await Promise.all([
    supabase.rpc("proyectos_listar"),
    supabase.rpc("listar_tenants_plataforma"),
  ]);
  if (error) return <main className="mx-auto max-w-3xl px-6 py-16 text-center text-white/60">{error.message}</main>;
  const proyectos = (data ?? []) as Proyecto[];
  // Puertas y estados por módulo solo de los proyectos que siguen en curso.
  const gates: Record<string, Gate[]> = {};
  const modulos: Record<string, ModuloEstado[]> = {};
  await Promise.all(proyectos.filter((p) => p.estado === "en_curso").map(async (p) => {
    const g = await supabase.rpc("proyecto_gates", { p_id: p.id });
    gates[p.id] = (g.data ?? []) as Gate[];
    if (p.tenant_id) {
      const m = await supabase.rpc("modulos_estado_listar", { p_tenant_id: p.tenant_id });
      modulos[p.id] = (m.data ?? []) as ModuloEstado[];
    }
  }));
  return (
    <ActivacionesView
      soloLectura={operador.rol !== "operador"}
      proyectos={proyectos}
      gates={gates}
      modulos={modulos}
      tenants={((tenants ?? []) as { id: string; name: string }[]).map((t) => ({ id: t.id, name: t.name }))}
    />
  );
}
