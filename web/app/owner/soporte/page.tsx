import { getOwnerContext } from "@/lib/owner-context";
import SoporteView, { type Ticket, type Incidente } from "./soporte-view";

export default async function SoportePage({ searchParams }: { searchParams: Promise<{ filtro?: string }> }) {
  const { filtro } = await searchParams;
  const { supabase } = await getOwnerContext();
  const [{ data: tickets, error }, { data: incidentes }, { data: tenants }] = await Promise.all([
    supabase.rpc("tickets_listar", { p_abiertos: false }),
    supabase.rpc("incidentes_listar"),
    supabase.rpc("listar_tenants_plataforma"),
  ]);
  if (error) return <main className="mx-auto max-w-3xl px-6 py-16 text-center text-white/70">{error.message}</main>;
  return <SoporteView filtro={["abiertos", "sla", "incidentes"].includes(filtro ?? "") ? (filtro as "abiertos" | "sla" | "incidentes") : undefined} tickets={(tickets ?? []) as Ticket[]} incidentes={(incidentes ?? []) as Incidente[]} estudios={((tenants ?? []) as { id: string; name: string }[]).map((t) => ({ id: t.id, name: t.name }))} />;
}
