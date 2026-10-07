import { getOwnerContext } from "@/lib/owner-context";
import PipelineView, { type Lead } from "./pipeline-view";

export default async function PipelinePage({ searchParams }: { searchParams: Promise<{ filtro?: string }> }) {
  const { filtro } = await searchParams;
  const { supabase } = await getOwnerContext();
  const [{ data: leads, error }, { data: resumen }] = await Promise.all([
    supabase.rpc("plataforma_leads_listar"),
    supabase.rpc("plataforma_resumen"),
  ]);
  if (error) {
    return <main className="mx-auto max-w-3xl px-6 py-16 text-center text-white/60">{error.message}</main>;
  }
  return <PipelineView leads={((leads ?? []) as Lead[]).filter((l) => filtro !== "sin-accion" || (!["ganado", "perdido"].includes(l.etapa) && !(l.proximo_paso ?? "").trim()))} resumen={resumen as { leads_abiertos: number; valor_pipeline: number } | null} />;
}
