import { getOwnerContext } from "@/lib/owner-context";
import ContratosView, { type Contrato } from "./contratos-view";

export default async function ContratosPage({ searchParams }: { searchParams: Promise<{ filtro?: string }> }) {
  const { filtro } = await searchParams;
  const { supabase } = await getOwnerContext();
  const [{ data, error }, { data: tenants }] = await Promise.all([supabase.rpc("contratos_listar"), supabase.rpc("listar_tenants_plataforma")]);
  if (error) return <main className="mx-auto max-w-3xl px-6 py-16 text-center text-white/60">{error.message}</main>;
  return <ContratosView contratos={((data ?? []) as Contrato[]).filter((c) => filtro !== "por-vencer" || (c.estado === "vigente" && c.dias_para_vencer >= 0 && c.dias_para_vencer <= 60))} estudios={((tenants ?? []) as { id: string; name: string }[]).map((t) => ({ id: t.id, name: t.name }))} />;
}
