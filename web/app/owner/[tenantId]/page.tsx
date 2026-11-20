import Link from "next/link";
import { getOwnerContext } from "@/lib/owner-context";
import PlanModulos from "./plan-modulos";
import AccesoExcepcional from "./acceso-excepcional";
import GiroEstudio from "./giro-estudio";
import { ESTADO_LABEL } from "@/lib/estados-estudio";
import { Anillo, BarrasH, Distribucion } from "@/components/graficas/graficas";

const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

function fmt(n: number) {
  return `Q${Number(n ?? 0).toLocaleString("es-GT", { maximumFractionDigits: 0 })}`;
}

type Detalle = {
  tenant: { id: string; slug: string; name: string; status: string; tipo: string; estado_motivo: string | null; estado_cambiado_at: string | null; created_at: string };
  sedes: { id: string; name: string; timezone: string; status: string }[];
  personal: { id: string; nombre: string | null; role: string; email: string | null }[];
  paquetes: { id: string; nombre: string; precio: number; num_clases: number | null; activo: boolean }[];
  proximas_clases: { id: string; nombre_clase: string; dia_semana: number; hora_inicio: string; cupo_maximo: number; sede: string }[];
  contrato: { estado: string; fecha_firma: string | null; vigencia_meses: number | null; mensualidad: number | null } | null;
  suscripcion: { plan: string | null; precio_mensual: number | null; estado: string | null } | null;
  metricas: { clientas_registradas: number; clientas_con_acceso: number; pagos_pendientes: number; reservas_7d: number; ultima_reserva: string | null; errores_24h: number; tickets_abiertos: number };
};

export default async function OwnerTenantPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const { supabase, operador } = await getOwnerContext();

  const { data, error } = await supabase.rpc("owner_tenant_detalle", {
    p_tenant_id: tenantId,
  });

  const [{ data: accesos }, { data: tickets }, { data: historial }] = await Promise.all([
    supabase.rpc("acceso_excepcional_listar", { p_tenant_id: tenantId }),
    supabase.rpc("acceso_excepcional_tickets", { p_tenant_id: tenantId }),
    supabase.rpc("tenant_estado_historial_listar", { p_tenant_id: tenantId }),
  ]);
  const [{ data: modulos }, { data: planes }, { data: sus }] = await Promise.all([
    supabase.rpc("modulos_tenant", { p_tenant_id: tenantId }),
    supabase.rpc("planes_listar"),
    supabase.rpc("plataforma_estudios_cobro"),
  ]);
  const { data: filaGiro } = await supabase.from("tenants").select("giro").eq("id", tenantId).maybeSingle();
  const planActual =
    ((sus ?? []) as { tenant_id: string; plan: string | null }[]).find((x) => x.tenant_id === tenantId)?.plan ?? null;

  if (error || !data) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-center text-ink/60">
        {error?.message ?? "Estudio no encontrado"}
      </main>
    );
  }

  const d = data as Detalle;
  const m = d.metricas;
  const est = ESTADO_LABEL[d.tenant.status] ?? ESTADO_LABEL.cancelado;
  const puedeOtorgar = ["operador", "soporte"].includes(operador.rol);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 md:px-10">
      <Link href="/owner" className="text-sm text-ink/50 hover:text-ink">
        ← Estudios
      </Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-ink md:text-3xl">
            {d.tenant.name}
          </h1>
          <p className="mt-1 text-sm text-ink/50">
            {d.tenant.slug} · {est.label}{d.tenant.tipo !== "cliente" ? ` · ${d.tenant.tipo}` : ""} · creado{" "}
            {new Date(d.tenant.created_at).toLocaleDateString("es-GT")}
          </p>
        </div>
      </div>

      {d.tenant.estado_motivo && d.tenant.status !== "activo" && (
        <p className="mt-3 text-xs text-ink/50">Motivo del estado: {d.tenant.estado_motivo}</p>
      )}

      <section aria-label="Salud del estudio" className="mt-8 grid gap-4 lg:grid-cols-3">
        <div className="border border-ink/15 bg-void-card p-5"><h3 className="mb-4 text-[10px] font-medium uppercase tracking-[0.12em] text-ink/60">Clientas con acceso</h3>
          <Anillo pct={m.clientas_registradas > 0 ? Math.round((m.clientas_con_acceso / m.clientas_registradas) * 100) : null} etiqueta={`${m.clientas_con_acceso} de ${m.clientas_registradas} ya usan su cuenta`} /></div>
        <div className="border border-ink/15 bg-void-card p-5"><h3 className="mb-4 text-[10px] font-medium uppercase tracking-[0.12em] text-ink/60">Qué requiere atención</h3>
          <BarrasH filas={[{ nombre: "Pagos pendientes", valor: m.pagos_pendientes }, { nombre: "Tickets abiertos", valor: m.tickets_abiertos }, { nombre: "Errores en 24 h", valor: m.errores_24h }]} /></div>
        <div className="border border-ink/15 bg-void-card p-5"><h3 className="mb-4 text-[10px] font-medium uppercase tracking-[0.12em] text-ink/60">Clases de la semana por día</h3>
          <BarrasH filas={DIAS.map((n, i) => ({ nombre: n, valor: d.proximas_clases.filter((c) => c.dia_semana === i).length })).filter((x) => x.valor > 0)} vacio="Aún no hay clases programadas." /></div>
        <div className="border border-ink/15 bg-void-card p-5 lg:col-span-3"><h3 className="mb-4 text-[10px] font-medium uppercase tracking-[0.12em] text-ink/60">Equipo por rol · {d.personal.length} personas</h3>
          <Distribucion partes={Object.entries(d.personal.reduce<Record<string, number>>((a, x) => ({ ...a, [x.role]: (a[x.role] ?? 0) + 1 }), {})).map(([nombre, valor]) => ({ nombre, valor, tono: "marca" as const }))} vacio="Sin equipo registrado." /></div>
      </section>

      <div className="mt-8 grid gap-4 sm:grid-cols-4">
        {[
          ["Clientas con acceso", m.clientas_con_acceso],
          ["Clientas registradas", m.clientas_registradas],
          ["Reservas (7 días)", m.reservas_7d],
          ["Pagos pendientes", m.pagos_pendientes],
          ["Errores (24 h)", m.errores_24h],
          ["Tickets abiertos", m.tickets_abiertos],
        ].map(([t, v]) => (
          <div key={String(t)} className="rounded-2xl border border-ink/10 bg-void-card p-5">
            <p className="text-xs uppercase tracking-wide text-ink/40">{t}</p>
            <p className="mt-2 text-2xl font-bold text-ink">{v}</p>
          </div>
        ))}
        <div className="rounded-2xl border border-ink/10 bg-void-card p-5 sm:col-span-2">
          <p className="text-xs uppercase tracking-wide text-ink/40">Contrato y suscripción</p>
          <p className="mt-2 text-sm text-ink">
            {d.contrato ? `Contrato ${d.contrato.estado}${d.contrato.mensualidad != null ? ` · ${fmt(d.contrato.mensualidad)}/mes` : ""}` : "Sin contrato vinculado"}
          </p>
          <p className="mt-1 text-xs text-ink/50">
            {d.suscripcion ? `Plan ${d.suscripcion.plan ?? "—"} · ${d.suscripcion.estado ?? "—"}` : "Sin suscripción"}
          </p>
        </div>
      </div>

      <GiroEstudio tenantId={tenantId} actual={(filaGiro as { giro?: string } | null)?.giro ?? null} puede={operador.rol === "operador"} />
      <PlanModulos
        tenantId={tenantId}
        modulos={(modulos ?? []) as { key: string; nombre: string; descripcion: string; depende_de: string[]; activo: boolean }[]}
        planes={(planes ?? []) as { key: string; nombre: string; precio_mensual: number; max_sedes: number | null }[]}
        planActual={planActual}
      />

      <h2 className="mt-10 text-sm font-medium uppercase tracking-wide text-ink/40">
        Sedes
      </h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {d.sedes.map((s) => (
          <li
            key={s.id}
            className="rounded-full border border-ink/10 bg-void-card px-3 py-1.5 text-xs text-ink/70"
          >
            {s.name} · {s.timezone}
          </li>
        ))}
        {d.sedes.length === 0 && (
          <li className="text-xs text-ink/40">Sin sedes todavía.</li>
        )}
      </ul>

      <h2 className="mt-10 text-sm font-medium uppercase tracking-wide text-ink/40">
        Personal ({d.personal.length})
      </h2>
      <ul className="mt-3 space-y-1.5">
        {d.personal.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between rounded-lg border border-ink/5 bg-void-card/60 px-4 py-2 text-xs"
          >
            <span className="text-ink">
              {p.nombre ?? "—"}{" "}
              <span className="text-ink/40">{p.email}</span>
            </span>
            <span className="text-ink/50">{p.role}</span>
          </li>
        ))}
        {d.personal.length === 0 && (
          <li className="text-xs text-ink/40">Sin personal todavía.</li>
        )}
      </ul>

      <h2 className="mt-10 text-sm font-medium uppercase tracking-wide text-ink/40">
        Paquetes ({d.paquetes.length})
      </h2>
      <ul className="mt-3 space-y-1.5">
        {d.paquetes.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between rounded-lg border border-ink/5 bg-void-card/60 px-4 py-2 text-xs"
          >
            <span className={p.activo ? "text-ink" : "text-ink/40"}>
              {p.nombre} {!p.activo && "(inactivo)"}
            </span>
            <span className="text-ink/50">
              {fmt(p.precio)} · {p.num_clases ?? "∞"} clases
            </span>
          </li>
        ))}
        {d.paquetes.length === 0 && (
          <li className="text-xs text-ink/40">
            Sin paquetes todavía — este estudio no tiene nada que vender.
          </li>
        )}
      </ul>

      <h2 className="mt-10 text-sm font-medium uppercase tracking-wide text-ink/40">
        Clases programadas ({d.proximas_clases.length})
      </h2>
      <ul className="mt-3 space-y-1.5">
        {d.proximas_clases.map((c) => (
          <li
            key={c.id}
            className="flex items-center justify-between rounded-lg border border-ink/5 bg-void-card/60 px-4 py-2 text-xs"
          >
            <span className="text-ink">
              {c.nombre_clase} · {c.sede}
            </span>
            <span className="text-ink/50">
              {DIAS[c.dia_semana]} {String(c.hora_inicio).slice(0, 5)} ·{" "}
              {c.cupo_maximo} cupos
            </span>
          </li>
        ))}
        {d.proximas_clases.length === 0 && (
          <li className="text-xs text-ink/40">
            Sin clases programadas todavía.
          </li>
        )}
      </ul>

      <AccesoExcepcional
        tenantId={tenantId}
        accesos={(accesos ?? []) as never}
        tickets={(tickets ?? []) as never}
        puedeOtorgar={puedeOtorgar}
      />

      <h2 className="mt-10 text-sm font-medium uppercase tracking-wide text-ink/40">Historial de estado</h2>
      <ul className="mt-3 space-y-1.5">
        {((historial ?? []) as { created_at: string; estado_anterior: string; estado_nuevo: string; motivo: string; actor: string }[]).map((h) => (
          <li key={h.created_at + h.estado_nuevo} className="rounded-lg border border-ink/5 bg-void-card/60 px-4 py-2 text-xs text-ink/70">
            {new Date(h.created_at).toLocaleString("es-GT", { timeZone: "America/Guatemala", dateStyle: "short", timeStyle: "short" })} · {h.actor}: {h.estado_anterior} → {h.estado_nuevo} — {h.motivo}
          </li>
        ))}
        {(historial ?? []).length === 0 && <li className="text-xs text-ink/40">Sin cambios de estado registrados.</li>}
      </ul>
    </main>
  );
}
