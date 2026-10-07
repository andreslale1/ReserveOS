import Link from "next/link";
import { getOwnerContext } from "@/lib/owner-context";

type Cambio = { campo: string; antes: unknown; despues: unknown };
type Item = { registro: string | null; cambios: Cambio[] };
type Fila = { created_at: string; actor: string; tabla: string; operacion: string; estudio: string | null; n: number; items: Item[] };
type Sp = Record<string, string | undefined>;

const MODULOS: [string, string][] = [
  ["plataforma_staff", "Equipo"], ["plataforma_invitaciones", "Invitaciones"], ["tenant_entitlements", "Módulos de estudios"], ["plataforma_planes", "Planes"],
  ["plataforma_suscripciones", "Suscripciones"], ["plataforma_cobros", "Cobros"], ["plataforma_pagos", "Pagos"], ["plataforma_costos", "Costos"],
  ["plataforma_proyectos", "Activaciones"], ["plataforma_tickets", "Soporte"], ["plataforma_campanas", "Marketing"], ["plataforma_propuestas", "Propuestas"], ["plataforma_contratos", "Contratos"],
];
const modLabel = (t: string) => MODULOS.find(([v]) => v === t)?.[1] ?? t.replace(/^plataforma_/, "");
const ACCION: Record<string, string> = { insert: "Creó", update: "Cambió", delete: "Eliminó" };
const POR_PAGINA = 50;
const input = "mt-1 w-full rounded-lg border border-white/15 bg-void px-3 py-2 text-sm text-white outline-none focus:border-lime/60 focus-visible:ring-2 focus-visible:ring-lime/60";
const val = (v: unknown) => (v === null || v === undefined ? "∅" : typeof v === "object" ? JSON.stringify(v) : String(v));

export default async function AuditoriaPlataformaPage({ searchParams }: { searchParams: Promise<Sp> }) {
  const sp = await searchParams;
  const { supabase } = await getOwnerContext();
  const pag = Math.max(1, Number(sp.pag) || 1);
  const [{ data, error }, { data: estudios }] = await Promise.all([
    supabase.rpc("plataforma_auditoria_buscar", {
      p_desde: sp.desde || null, p_hasta: sp.hasta || null, p_tenant_id: sp.estudio || null, p_actor: sp.actor || null,
      p_tabla: sp.modulo || null, p_operacion: sp.accion || null, p_q: sp.q || null, p_limite: POR_PAGINA, p_offset: (pag - 1) * POR_PAGINA,
    }),
    supabase.rpc("plataforma_auditoria_estudios"),
  ]);
  if (error) return <main className="mx-auto max-w-3xl px-6 py-16 text-center text-white/60" role="alert">{error.message}</main>;
  const { total, filas } = data as { total: number; filas: Fila[] };
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const qs = (extra: Sp) => new URLSearchParams(Object.entries({ ...sp, ...extra }).filter(([, v]) => v) as [string, string][]).toString();
  const exportQs = qs({ pag: undefined });

  return (
    <main className="mx-auto max-w-5xl px-6 py-8 md:px-10">
      <h1 className="text-2xl font-semibold">Auditoría de plataforma</h1>
      <p className="mt-1 text-sm text-white/60">Cambios de planes, cobros, pagos, costos, equipo, módulos y proyectos. Los cambios hechos en lote (misma operación) se agrupan. Correos, teléfonos y secretos aparecen ocultos. Retención: los registros se conservan sin purga automática.</p>

      <form method="get" className="mt-5 grid gap-3 rounded-2xl border border-white/10 bg-void-card p-4 sm:grid-cols-3" aria-label="Filtros de auditoría">
        <label className="text-xs text-white/70">Desde<input type="date" name="desde" defaultValue={sp.desde} className={input} /></label>
        <label className="text-xs text-white/70">Hasta<input type="date" name="hasta" defaultValue={sp.hasta} className={input} /></label>
        <label className="text-xs text-white/70">Estudio
          <select name="estudio" defaultValue={sp.estudio ?? ""} className={input}><option value="">Todos</option>{((estudios ?? []) as { id: string; nombre: string }[]).map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}</select>
        </label>
        <label className="text-xs text-white/70">Módulo
          <select name="modulo" defaultValue={sp.modulo ?? ""} className={input}><option value="">Todos</option>{MODULOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </label>
        <label className="text-xs text-white/70">Acción
          <select name="accion" defaultValue={sp.accion ?? ""} className={input}><option value="">Todas</option><option value="insert">Creó</option><option value="update">Cambió</option><option value="delete">Eliminó</option></select>
        </label>
        <label className="text-xs text-white/70">Quién<input name="actor" defaultValue={sp.actor} placeholder="Nombre de la persona" className={input} /></label>
        <label className="text-xs text-white/70 sm:col-span-2">Buscar<input name="q" defaultValue={sp.q} placeholder="Estudio, módulo o registro" className={input} /></label>
        <div className="flex items-end gap-2">
          <button className="rounded-full bg-lime px-4 py-2 text-sm font-semibold text-void" type="submit">Filtrar</button>
          <Link href="/owner/auditoria" className="rounded-full border border-white/20 px-4 py-2 text-sm">Limpiar</Link>
        </div>
      </form>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-white/65">
        <p>{total} {total === 1 ? "evento" : "eventos"} {paginas > 1 ? `· página ${pag} de ${paginas}` : ""}</p>
        <a href={`/owner/auditoria/export?${exportQs}`} className="rounded-full border border-white/20 px-3 py-1.5 text-xs hover:text-white">Exportar CSV</a>
      </div>

      <ul className="mt-3 divide-y divide-white/10 rounded-2xl border border-white/10 bg-void-card px-5">
        {filas.length === 0 && <li className="py-6 text-sm text-white/60">No hay eventos con esos filtros.</li>}
        {filas.map((f, i) => (
          <li key={i} className="py-3 text-sm">
            <p>
              <span className="text-white/60">{new Date(f.created_at).toLocaleString("es-GT", { timeZone: "America/Guatemala", dateStyle: "short", timeStyle: "short" })}</span>
              {" · "}<strong>{f.actor}</strong>{" · "}{ACCION[f.operacion] ?? f.operacion} {f.n > 1 ? `${f.n} registros en ` : ""}<span className="text-lime">{modLabel(f.tabla)}</span>
              {f.estudio && <span className="text-white/60"> · {f.estudio}</span>}
              {f.n > 1 && <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/70">lote</span>}
            </p>
            <details className="mt-1 text-xs text-white/65">
              <summary className="cursor-pointer">Ver detalle</summary>
              <ul className="mt-2 space-y-2">
                {f.items.map((it, j) => (
                  <li key={j}><p className="text-white/80">{it.registro ?? "—"}</p>
                    <ul className="ml-3 space-y-0.5">{it.cambios.map((c, k) => <li key={k}><span className="text-white/50">{c.campo}:</span> {f.operacion !== "insert" && <><s className="text-red-300/80">{val(c.antes)}</s> → </>}<span className="text-lime/90">{f.operacion === "delete" ? "eliminado" : val(c.despues)}</span></li>)}</ul>
                  </li>
                ))}
                {f.n > f.items.length && <li>…y {f.n - f.items.length} más (descarga el CSV).</li>}
              </ul>
            </details>
          </li>
        ))}
      </ul>

      {paginas > 1 && (
        <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Paginación">
          {pag > 1 ? <Link className="underline" href={`/owner/auditoria?${qs({ pag: String(pag - 1) })}`}>← Anterior</Link> : <span />}
          {pag < paginas ? <Link className="underline" href={`/owner/auditoria?${qs({ pag: String(pag + 1) })}`}>Siguiente →</Link> : <span />}
        </nav>
      )}
    </main>
  );
}
