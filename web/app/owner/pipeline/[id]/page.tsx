import { notFound } from "next/navigation";
import { getOwnerContext } from "@/lib/owner-context";
import FichaOportunidad, { type Detalle } from "./ficha-view";
import Propuestas, { type Propuesta, type PlanOpt } from "./propuestas";

export default async function OportunidadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await getOwnerContext();
  const [{ data, error }, { data: props }, { data: planes }, { data: contratos }] = await Promise.all([
    supabase.rpc("crm_detalle", { p_lead_id: id }),
    supabase.rpc("propuestas_listar", { p_lead_id: id }),
    supabase.rpc("planes_listar"),
    supabase.rpc("contratos_listar"),
  ]);
  const conContrato: Record<string, boolean> = {};
  void contratos;
  if (error) return <main className="mx-auto max-w-3xl px-6 py-16 text-center text-white/60">{error.message}</main>;
  if (!data) notFound();
  const lista = (props ?? []) as Propuesta[];
  const { data: cs } = await supabase.rpc("contratos_listar");
  for (const c of (cs ?? []) as { lead_id: string | null; version_propuesta: number | null; estado: string }[]) {
    if (c.lead_id === id && c.estado !== "cancelado") {
      const p = lista.find((x) => x.version === c.version_propuesta);
      if (p) conContrato[p.id] = true;
    }
  }
  return (
    <>
      <FichaOportunidad d={data as Detalle} />
      <div className="mx-auto max-w-6xl px-6 pb-10 md:px-10">
        <Propuestas leadId={id} propuestas={lista} planes={((planes ?? []) as PlanOpt[])} tieneContrato={conContrato} />
      </div>
    </>
  );
}
