import Link from "next/link";
import { redirect } from "next/navigation";
import { getPanelContext, puedeVer } from "@/lib/panel-context";
import Confirmar from "./confirmar";

type Sp = { q?: string; cliente?: string; sede?: string; dia?: string; clase?: string; carril?: string };
const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const pasos = ["¿Para quién?", "¿Qué clase?", "Confirmar"];

export default async function ReservarPage({ searchParams }: { searchParams: Promise<Sp> }) {
  const sp = await searchParams;
  const { supabase, membership, sedes } = await getPanelContext();
  if (!membership) return null;
  if (!puedeVer(membership.role, "/panel/reservar")) redirect("/panel/hoy");
  const tenantId = membership.tenant_id;
  const url = (p: Partial<Sp>) => { const m = { ...sp, ...p } as Record<string, string | undefined>; const u = new URLSearchParams(); for (const [k, v] of Object.entries(m)) if (v) u.set(k, v); return `/panel/reservar?${u.toString()}`; };

  // Paso 1: la persona
  const q = (sp.q ?? "").replace(/[%,()]/g, " ").trim();
  const { data: sel } = sp.cliente ? await supabase.from("clientes").select("id, nombre, telefono, email").eq("id", sp.cliente).eq("tenant_id", tenantId).maybeSingle() : { data: null };
  const { data: encontrados } = !sel && q.length >= 2
    ? await supabase.from("clientes").select("id, nombre, telefono, email, tutor_id").eq("tenant_id", tenantId).or(`nombre.ilike.%${q}%,telefono.ilike.%${q}%,email.ilike.%${q}%`).order("nombre").limit(8)
    : { data: [] };

  // Paso 2: sede, día y clase
  const sede = sedes.find((s) => s.id === sp.sede) ?? sedes[0];
  // eslint-disable-next-line react-hooks/purity -- componente de servidor: la hora de la petición es lo que se quiere
  const ahora = Date.now();
  const dias = Array.from({ length: 10 }).map((_, i) => {
    const d = new Date(ahora + i * 86400000);
    const fecha = new Intl.DateTimeFormat("en-CA", { timeZone: sede?.timezone ?? "America/Guatemala", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
    return { fecha, dow: new Date(fecha + "T12:00:00Z").getUTCDay(), num: Number(fecha.slice(8)) };
  });
  const dia = dias.find((d) => d.fecha === sp.dia) ?? dias[0];

  type Clase = { id: string; nombre: string; inicio: string; fin: string; instructora: string; lugares: number; modo: string };
  let clases: Clase[] = [];
  const carrilesDe = new Map<string, { recurso_id: string; nombre: string; ocupado: boolean }[]>();
  if (sel && sede) {
    const { data: hs } = await supabase.from("horarios").select("id, nombre_clase, hora_inicio, hora_fin, cupo_maximo, tenant_memberships(nombre)").eq("sede_id", sede.id).eq("activo", true).eq("categoria", "regular")
      .or(`and(fecha_especifica.is.null,dia_semana.eq.${dia.dow}),fecha_especifica.eq.${dia.fecha}`).order("hora_inicio");
    const ids = (hs ?? []).map((h) => h.id);
    const [{ data: oc }, { data: ef }, { data: md }] = await Promise.all([
      ids.length ? supabase.rpc("ocupacion_horarios", { p_horario_ids: ids, p_fecha_inicio: dia.fecha, p_fecha_fin: dia.fecha }) : Promise.resolve({ data: [] }),
      ids.length ? supabase.rpc("cupos_efectivos", { p_horario_ids: ids, p_fecha: dia.fecha }) : Promise.resolve({ data: [] }),
      ids.length ? supabase.from("horarios").select("id, modo_reserva").in("id", ids) : Promise.resolve({ data: [] }),
    ]);
    const ocup = new Map(((oc ?? []) as { horario_id: string; ocupados: number }[]).map((x) => [x.horario_id, Number(x.ocupados)] as const));
    const cupo = new Map(((ef ?? []) as { horario_id: string; cupo: number }[]).map((x) => [x.horario_id, x.cupo] as const));
    const modo = new Map(((md ?? []) as { id: string; modo_reserva?: string }[]).map((x) => [x.id, x.modo_reserva === "carril" ? "carril" : "cupo"] as const));
    clases = (hs ?? []).map((h) => ({ id: h.id, nombre: h.nombre_clase, inicio: h.hora_inicio.slice(0, 5), fin: h.hora_fin.slice(0, 5), instructora: (h.tenant_memberships as unknown as { nombre: string } | null)?.nombre ?? "", lugares: Math.max((cupo.get(h.id) ?? h.cupo_maximo) - (ocup.get(h.id) ?? 0), 0), modo: modo.get(h.id) ?? "cupo" }));
    await Promise.all(clases.filter((c) => c.modo === "carril").map(async (c) => {
      const { data } = await supabase.rpc("carriles_de_clase", { p_horario_id: c.id, p_fecha: dia.fecha });
      carrilesDe.set(c.id, (data ?? []) as { recurso_id: string; nombre: string; ocupado: boolean }[]);
    }));
  }

  // El derecho que se usará: paquetes vigentes de la persona
  const { data: paquetes } = sel ? await supabase.from("membresias").select("id, clases_totales, clases_usadas, fecha_vencimiento, pagada, paquetes(nombre)").eq("cliente_id", sel.id).eq("estado", "activa").gte("fecha_vencimiento", dia.fecha).order("fecha_vencimiento") : { data: [] };
  const vigentes = (paquetes ?? []).filter((m) => m.clases_totales === null || m.clases_usadas < m.clases_totales);

  const claseSel = clases.find((c) => c.id === sp.clase);
  const carriles = claseSel ? carrilesDe.get(claseSel.id) ?? [] : [];
  const carrilSel = carriles.find((k) => k.recurso_id === sp.carril && !k.ocupado);
  const listo = !!(sel && claseSel && (claseSel.modo !== "carril" || carrilSel));
  const paso = !sel ? 0 : !listo ? 1 : 2;

  return (
    <main className="px-5 py-8 md:px-10">
      <h1 className="text-[clamp(28px,3vw,40px)] leading-tight tracking-[-0.04em]">Nueva reserva</h1>
      <ol className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm" aria-label="Pasos">
        {pasos.map((t, i) => <li key={t} aria-current={i === paso ? "step" : undefined} className={i === paso ? "font-semibold text-ink" : i < paso ? "text-good" : "text-ink-soft"}>{i < paso ? "✓ " : `${i + 1}. `}{t}</li>)}
      </ol>

      <section aria-labelledby="p1" className="mt-8 max-w-3xl">
        <h2 id="p1" className="text-base font-semibold text-ink">1. ¿Para quién es la reserva?</h2>
        {sel ? (
          <p className="mt-3 flex flex-wrap items-center gap-3 border border-line bg-void-card px-4 py-3 text-sm">
            <b className="text-ink">{sel.nombre}</b><span className="text-ink-soft">{sel.telefono}{sel.email ? ` · ${sel.email}` : ""}</span>
            <Link href={url({ cliente: undefined, clase: undefined, carril: undefined })} className="ml-auto underline">Cambiar</Link>
          </p>
        ) : (
          <form action="/panel/reservar" className="mt-3 flex flex-wrap gap-2">
            <input name="q" defaultValue={sp.q} placeholder="Nombre, teléfono o correo" aria-label="Buscar a la persona" autoFocus className="min-w-64 flex-1 border border-line bg-void-card px-3 py-2.5 text-sm" />
            <button className="press-spring bg-ink px-5 py-2.5 text-sm font-semibold text-void">Buscar</button>
          </form>
        )}
        {!sel && q.length >= 2 && (
          <ul className="mt-3 divide-y divide-line border border-line bg-void-card">
            {(encontrados ?? []).length === 0 && <li className="px-4 py-3 text-sm text-ink-soft">Nadie coincide con «{q}». Si es nueva, créala primero en <Link href="/panel/clientes" className="underline">Clientas</Link>.</li>}
            {(encontrados ?? []).map((c) => (
              <li key={c.id}><Link href={url({ cliente: c.id, q: undefined })} className="press-spring flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm hover:bg-ink/[0.03]"><b className="text-ink">{c.nombre}{c.tutor_id ? " (dependiente)" : ""}</b><span className="text-ink-soft">{c.telefono}</span></Link></li>
            ))}
          </ul>
        )}
      </section>

      {sel && (
        <section aria-labelledby="p2" className="mt-10 max-w-3xl">
          <h2 id="p2" className="text-base font-semibold text-ink">2. ¿Qué clase?</h2>
          {sedes.length > 1 && (
            <nav aria-label="Sede" className="mt-3 flex flex-wrap gap-1.5">
              {sedes.map((s) => <Link key={s.id} href={url({ sede: s.id, clase: undefined, carril: undefined })} aria-current={s.id === sede?.id ? "page" : undefined} className={`border px-3 py-1.5 text-sm ${s.id === sede?.id ? "border-ink bg-ink text-void" : "border-line text-ink hover:border-ink/40"}`}>{s.name}</Link>)}
            </nav>
          )}
          <nav aria-label="Día" className="mt-3 grid grid-cols-5 gap-1.5 sm:grid-cols-10">
            {dias.map((d) => <Link key={d.fecha} href={url({ dia: d.fecha, clase: undefined, carril: undefined })} aria-current={d.fecha === dia.fecha ? "date" : undefined} className={`press-spring border px-1 py-2 text-center text-xs ${d.fecha === dia.fecha ? "border-ink bg-ink text-void" : "border-line bg-void-card text-ink hover:border-ink/40"}`}><span className="block opacity-70">{DIAS[d.dow]}</span><span className="block text-base font-semibold">{d.num}</span></Link>)}
          </nav>
          <ul className="mt-4 divide-y divide-line border border-line bg-void-card">
            {clases.length === 0 && <li className="px-4 py-4 text-sm text-ink-soft">No hay clases ese día en esta sede.</li>}
            {clases.map((c) => (
              <li key={c.id}>
                <Link href={url({ clase: c.id, carril: undefined })} aria-current={c.id === sp.clase ? "true" : undefined} className={`press-spring flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm ${c.id === sp.clase ? "bg-peach-tint" : "hover:bg-ink/[0.03]"} ${c.lugares === 0 ? "opacity-50" : ""}`}>
                  <span><b className="tabular text-ink">{c.inicio}</b> · <b className="text-ink">{c.nombre}</b>{c.instructora ? <span className="text-ink-soft"> · {c.instructora}</span> : null}{c.modo === "carril" ? <span className="ml-2 bg-neutral-tint px-1.5 py-0.5 text-xs text-ink-soft">Por carril</span> : null}</span>
                  <span className="text-ink-soft">{c.lugares === 0 ? "Sin cupo" : `${c.lugares} ${c.lugares === 1 ? "lugar" : "lugares"}`}</span>
                </Link>
              </li>
            ))}
          </ul>
          {claseSel?.modo === "carril" && (
            <div className="mt-4" role="group" aria-label="Carriles">
              <p className="mb-1.5 text-sm text-ink-soft">Elige el carril</p>
              <div className="flex flex-wrap gap-1.5">
                {carriles.map((k) => <Link key={k.recurso_id} href={k.ocupado ? "#" : url({ carril: k.recurso_id })} aria-disabled={k.ocupado} aria-pressed={k.recurso_id === sp.carril} className={`tabular grid h-9 min-w-9 place-items-center border px-2 text-sm font-semibold ${k.ocupado ? "pointer-events-none border-transparent bg-ink/10 text-ink/35" : k.recurso_id === sp.carril ? "border-lime bg-lime text-white" : "border-line text-ink hover:border-ink/40"}`}>{k.nombre.replace(/^\D+\s*/, "") || k.nombre}</Link>)}
              </div>
            </div>
          )}
        </section>
      )}

      {sel && claseSel && (
        <section aria-labelledby="p3" className="mt-10 max-w-3xl">
          <h2 id="p3" className="text-base font-semibold text-ink">3. Revisa y confirma</h2>
          <dl className="mt-3 divide-y divide-line border border-line bg-void-card text-sm">
            <div className="flex justify-between gap-4 px-4 py-3"><dt className="text-ink-soft">Persona</dt><dd className="font-medium text-ink">{sel.nombre}</dd></div>
            <div className="flex justify-between gap-4 px-4 py-3"><dt className="text-ink-soft">Clase</dt><dd className="text-right font-medium text-ink">{claseSel.nombre} · {claseSel.inicio}–{claseSel.fin} · {sede?.name}<br /><span className="text-ink-soft">{new Date(dia.fecha + "T12:00:00").toLocaleDateString("es-GT", { weekday: "long", day: "numeric", month: "long" })}</span></dd></div>
            {claseSel.modo === "carril" && <div className="flex justify-between gap-4 px-4 py-3"><dt className="text-ink-soft">Carril</dt><dd className="font-medium text-ink">{carrilSel?.nombre ?? "Elige uno arriba"}</dd></div>}
            <div className="flex justify-between gap-4 px-4 py-3"><dt className="text-ink-soft">Se descuenta de</dt><dd className="text-right font-medium text-ink">{vigentes[0] ? <>{(vigentes[0].paquetes as unknown as { nombre: string } | null)?.nombre ?? "Paquete"}<br /><span className="text-ink-soft">{vigentes[0].clases_totales === null ? "Clases ilimitadas" : `Quedan ${vigentes[0].clases_totales - vigentes[0].clases_usadas} de ${vigentes[0].clases_totales}`} · vence {vigentes[0].fecha_vencimiento}{vigentes[0].pagada ? "" : " · pago pendiente"}</span></> : <span className="text-warn">Sin paquete vigente para esa fecha</span>}</dd></div>
          </dl>
          <div className="mt-4">
            <Confirmar clienteId={sel.id} horarioId={claseSel.id} fecha={dia.fecha} recursoId={claseSel.modo === "carril" ? carrilSel?.recurso_id ?? null : null} puede={listo && claseSel.lugares > 0} motivo={claseSel.lugares === 0 ? "La clase no tiene lugares." : claseSel.modo === "carril" && !carrilSel ? "Elige un carril libre." : undefined} />
          </div>
        </section>
      )}
    </main>
  );
}
