import { BarrasH, Distribucion, Meta, Tendencia } from "@/components/graficas/graficas";

type Gasto = { categoria: string; monto: number; fecha: string; tipo: string };
type Sede = { sede: string; neto: number };

const Tarjeta = ({ titulo, children, ancho }: { titulo: string; children: React.ReactNode; ancho?: string }) => (
  <section className={`border border-line bg-void-card p-5 ${ancho ?? ""}`}><h3 className="mb-4 text-[10px] font-medium uppercase tracking-[0.12em] text-ink-soft">{titulo}</h3>{children}</section>
);

// Gráficas de Finanzas con los datos que la página ya tiene (sin consultas nuevas).
export default function FinanzasGraficas({ ingresos, gastos, meta, lista, sedes, diaDelMes, diasDelMes }: { ingresos: number; gastos: number; meta: number | null; lista: Gasto[]; sedes: Sede[]; diaDelMes: number; diasDelMes: number }) {
  const porCat = Object.entries(lista.reduce<Record<string, number>>((a, g) => ({ ...a, [g.categoria]: (a[g.categoria] ?? 0) + g.monto }), {})).sort((a, b) => b[1] - a[1]);
  const porDia = Array.from({ length: diaDelMes }, (_, i) => ({ etiqueta: String(i + 1), valor: lista.filter((g) => Number(g.fecha.slice(8, 10)) === i + 1).reduce((a, g) => a + g.monto, 0) }));
  const fijo = lista.filter((g) => g.tipo === "fijo").reduce((a, g) => a + g.monto, 0);
  const margen = ingresos > 0 ? Math.round(((ingresos - gastos) / ingresos) * 100) : null;
  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-3">
      <Tarjeta titulo="Ingresos contra gastos">
        <BarrasH formato="quetzales" filas={[{ nombre: "Ingresos", valor: ingresos }, { nombre: "Gastos", valor: gastos }, { nombre: "Neto", valor: Math.max(ingresos - gastos, 0), texto: `Q${new Intl.NumberFormat("es-GT").format(Math.round(ingresos - gastos))}` }]} />
        <p className="mt-4 text-[12px] text-ink-soft">{margen === null ? "Sin ingresos todavía este mes." : `Margen del mes: ${margen}% de cada quetzal que entra queda.`}</p>
      </Tarjeta>
      {meta !== null ? (
        <Tarjeta titulo="Meta del mes"><Meta actual={ingresos} meta={meta} esperado={(meta * diaDelMes) / diasDelMes} formato="quetzales" /></Tarjeta>
      ) : (
        <Tarjeta titulo="Costos fijos y variables"><Distribucion unidad="" partes={[{ nombre: "Fijos", valor: Math.round(fijo), tono: "marca" }, { nombre: "Variables", valor: Math.round(gastos - fijo), tono: "gris" }]} vacio="Aún no hay gastos este mes." /></Tarjeta>
      )}
      <Tarjeta titulo="En qué se va el dinero"><BarrasH formato="quetzales" filas={porCat.slice(0, 6).map(([n, v]) => ({ nombre: n, valor: v }))} vacio="No hay gastos este mes." /></Tarjeta>
      <Tarjeta titulo="Gasto por día" ancho="lg:col-span-2"><Tendencia puntos={porDia} nombre="Gasto" formato="quetzales" alto={190} /></Tarjeta>
      {sedes.length > 1 ? <Tarjeta titulo="Ingreso neto por sede"><BarrasH formato="quetzales" filas={sedes.map((s) => ({ nombre: s.sede, valor: Math.max(s.neto, 0) }))} /></Tarjeta> : <Tarjeta titulo="Costos fijos y variables"><Distribucion partes={[{ nombre: "Fijos", valor: Math.round(fijo), tono: "marca" }, { nombre: "Variables", valor: Math.round(gastos - fijo), tono: "gris" }]} vacio="Aún no hay gastos este mes." /></Tarjeta>}
    </div>
  );
}
