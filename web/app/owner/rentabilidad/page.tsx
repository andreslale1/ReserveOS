import { getOwnerContext } from "@/lib/owner-context";
import RentabilidadView, { type Rent, type Costo } from "./rentabilidad-view";

export default async function RentabilidadPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { mes } = await searchParams;
  const base = /^\d{4}-\d{2}$/.test(mes ?? "") ? (mes as string) : new Date().toISOString().slice(0, 7);
  const [y, m] = base.split("-").map(Number);
  const desde = `${base}-01`;
  const hasta = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const { supabase } = await getOwnerContext();
  const [{ data: rent, error }, { data: costos }, { data: estudios }] = await Promise.all([
    supabase.rpc("plataforma_rentabilidad", { p_desde: desde, p_hasta: hasta }),
    supabase.rpc("costos_listar", { p_desde: desde, p_hasta: hasta }),
    supabase.rpc("listar_tenants_plataforma"),
  ]);
  if (error) return <main className="mx-auto max-w-3xl px-6 py-16 text-center text-white/60">{error.message}</main>;
  return <RentabilidadView mes={base} rent={rent as Rent} costos={(costos ?? []) as Costo[]} estudios={((estudios ?? []) as { id: string; name: string }[]).map((e) => ({ id: e.id, name: e.name }))} />;
}
