import { getPanelContext } from "@/lib/panel-context";
import FinanzasView from "./finanzas-view";

export default async function FinanzasPage() {
  const { supabase, membership } = await getPanelContext();

  if (!membership) {
    return null;
  }

  const hoy = new Date();
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10);

  const [{ data: membresias }, { data: gastos }, { data: meta }] =
    await Promise.all([
      supabase
        .from("membresias")
        .select("precio_final, confirmado_at, created_at")
        .eq("tenant_id", membership.tenant_id)
        .eq("pagada", true)
        .gte("created_at", inicioMes),
      supabase
        .from("gastos")
        .select("categoria, descripcion, monto, fecha, tipo")
        .eq("tenant_id", membership.tenant_id)
        .gte("fecha", inicioMes)
        .lte("fecha", finMes)
        .order("fecha", { ascending: false }),
      supabase
        .from("metas_mensuales")
        .select("meta")
        .eq("tenant_id", membership.tenant_id)
        .eq("mes", inicioMes)
        .eq("tipo", "ingreso")
        .maybeSingle(),
    ]);

  const ingresos = (membresias ?? []).reduce(
    (acc, m) => acc + Number(m.precio_final ?? 0),
    0,
  );
  const totalGastos = (gastos ?? []).reduce(
    (acc, g) => acc + Number(g.monto ?? 0),
    0,
  );

  return (
    <FinanzasView
      ingresos={ingresos}
      gastos={totalGastos}
      neto={ingresos - totalGastos}
      meta={meta?.meta ?? null}
      listaGastos={(gastos ?? []).map((g) => ({
        categoria: g.categoria,
        descripcion: g.descripcion,
        monto: Number(g.monto),
        fecha: g.fecha,
        tipo: g.tipo,
      }))}
    />
  );
}
