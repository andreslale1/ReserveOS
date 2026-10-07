import { getOwnerContext } from "@/lib/owner-context";
import CobrosView, { type Cobro, type Estudio, type PlanCat, type Resumen } from "./cobros-view";

export default async function CobrosPage({ searchParams }: { searchParams: Promise<{ filtro?: string }> }) {
  const { filtro } = await searchParams;
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guatemala" }).format(new Date());
  const en7 = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guatemala" }).format(new Date(Date.now() + 7 * 864e5));
  const { supabase } = await getOwnerContext();
  const [{ data: resumen, error }, { data: estudios }, { data: cobros }, { data: planes }] = await Promise.all([
    supabase.rpc("plataforma_resumen"),
    supabase.rpc("plataforma_estudios_cobro"),
    supabase.rpc("plataforma_cobros_listar", { p_estado: null }),
    supabase.rpc("planes_listar"),
  ]);
  if (error) {
    return <main className="mx-auto max-w-3xl px-6 py-16 text-center text-white/60">{error.message}</main>;
  }
  return <CobrosView resumen={resumen as Resumen} estudios={(estudios ?? []) as Estudio[]} cobros={((cobros ?? []) as Cobro[]).filter((c) => !["mora", "por-vencer"].includes(filtro ?? "") || (["pendiente", "parcial"].includes(c.estado) && (filtro === "mora" ? c.fecha_vencimiento < hoy : c.fecha_vencimiento >= hoy && c.fecha_vencimiento <= en7)))} planes={((planes ?? []) as (PlanCat & { estado?: string })[]).filter((p) => p.estado === "publicado")} />;
}
