import Link from "next/link";

export type Kpi = { etiqueta: string; valor: string; unidad?: string; nota: string; href: string; error?: boolean };
export type Atencion = { n: number | null; titulo: string; detalle: string; href: string };

// «Resumen» de la propuesta de diseño: lo que necesita la dueña en una sola mirada, con datos reales.
export default function Resumen({ estudio, rol, fecha, alcance, kpis, atencion }: {
  estudio: string; rol: string; fecha: string; alcance: string; kpis: Kpi[]; atencion: Atencion[];
}) {
  const pendientes = atencion.filter((a) => (a.n ?? 0) > 0).length;
  const titulo = pendientes === 0 ? "Todo bajo control." : `Hoy hay ${pendientes} ${pendientes === 1 ? "cosa" : "cosas"} por atender.`;
  return (
    <section aria-labelledby="resumen-h" className="px-5 pb-2 pt-8 md:px-10 md:pt-9">
      <p className="text-[10px] font-medium uppercase tracking-[0.11em] text-ink-soft">{estudio} / {rol}</p>
      <div className="mb-7 mt-3 flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 id="resumen-h" className="text-[clamp(30px,3.2vw,47px)] leading-[1.07] tracking-[-0.05em]">{titulo}</h1>
          <p className="mt-2 text-[13px] text-ink-soft first-letter:uppercase">{fecha} · {alcance}</p>
        </div>
        <Link href="/panel/calendario" className="press-spring inline-flex h-[42px] items-center gap-4 border border-ink bg-ink px-4 text-[12px] font-medium text-void hover:border-lime hover:bg-lime">Nueva reserva <span aria-hidden>↗</span></Link>
      </div>

      <dl className="mb-8 grid border-b border-line border-t border-t-ink sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k, i) => (
          <Link key={k.etiqueta} href={k.href} className={`press-spring block border-line px-0 py-5 sm:px-[23px] ${i > 0 ? "sm:border-l" : "sm:pl-0"} ${i > 0 ? "border-t sm:border-t-0" : ""} hover:bg-ink/[0.03]`}>
            <dt className="flex items-center justify-between text-[11px] text-ink-soft">{k.etiqueta}<span aria-hidden>↗</span></dt>
            <dd className="mt-2">
              {k.error ? (
                <span className="block text-[13px] text-bad" role="status">No se pudo cargar</span>
              ) : (
                <span className="tabular text-[clamp(30px,3vw,42px)] font-medium leading-none tracking-[-0.05em] text-ink">{k.valor}{k.unidad && <small className="ml-0.5 text-[0.5em]">{k.unidad}</small>}</span>
              )}
              <span className="mt-2 block text-[12px] text-ink-soft">{k.nota}</span>
            </dd>
          </Link>
        ))}
      </dl>

      <div className="mb-8 border border-line bg-void-card" aria-labelledby="atencion-h">
        <h2 id="atencion-h" className="border-b border-line px-5 py-3 text-[10px] font-medium uppercase tracking-[0.12em] text-ink-soft">Necesita tu atención</h2>
        <ul className="divide-y divide-line">
          {atencion.map((a) => (
            <li key={a.titulo}>
              <Link href={a.href} className="press-spring flex items-center gap-5 px-5 py-4 hover:bg-ink/[0.03]">
                <span className={`tabular w-8 text-[28px] font-medium leading-none tracking-[-0.05em] ${a.n === null ? "text-ink-soft" : a.n > 0 ? "text-ink" : "text-ink/30"}`}>{a.n === null ? "—" : a.n}</span>
                <span className="min-w-0 flex-1"><b className="block text-[14px] font-semibold text-ink">{a.titulo}</b><span className="text-[12px] text-ink-soft">{a.n === null ? "No se pudo cargar. Recarga la página." : a.detalle}</span></span>
                <span aria-hidden className="text-ink-soft">↗</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <h2 className="mb-1 text-[22px] tracking-[-0.04em]">El día, en una vista.</h2>
    </section>
  );
}
