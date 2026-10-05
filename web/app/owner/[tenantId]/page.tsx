import Link from "next/link";
import { getOwnerContext } from "@/lib/owner-context";
import PlanModulos from "./plan-modulos";

const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

function fmt(n: number) {
  return `Q${Number(n ?? 0).toLocaleString("es-GT", { maximumFractionDigits: 0 })}`;
}

type Detalle = {
  tenant: { id: string; slug: string; name: string; status: string; created_at: string };
  sedes: { id: string; name: string; timezone: string; status: string }[];
  personal: { id: string; nombre: string | null; role: string; email: string }[];
  clientas: { id: string; nombre: string; telefono: string; email: string | null; tiene_acceso: boolean }[];
  paquetes: { id: string; nombre: string; precio: number; num_clases: number | null; activo: boolean }[];
  proximas_clases: { id: string; nombre_clase: string; dia_semana: number; hora_inicio: string; cupo_maximo: number; sede: string }[];
  pagos_pendientes: { id: string; cliente_nombre: string; metodo_pago: string; referencia_pago: string | null; created_at: string }[];
  ingreso_mes: number;
  gastos_mes: number;
};

export default async function OwnerTenantPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const { supabase } = await getOwnerContext();

  const { data, error } = await supabase.rpc("owner_tenant_detalle", {
    p_tenant_id: tenantId,
  });

  const [{ data: modulos }, { data: planes }, { data: sus }] = await Promise.all([
    supabase.rpc("modulos_tenant", { p_tenant_id: tenantId }),
    supabase.rpc("planes_listar"),
    supabase.rpc("plataforma_estudios_cobro"),
  ]);
  const planActual =
    ((sus ?? []) as { tenant_id: string; plan: string | null }[]).find((x) => x.tenant_id === tenantId)?.plan ?? null;

  if (error || !data) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-center text-white/60">
        {error?.message ?? "Estudio no encontrado"}
      </main>
    );
  }

  const d = data as Detalle;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 md:px-10">
      <Link href="/owner" className="text-sm text-white/50 hover:text-white">
        ← Estudios
      </Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-white md:text-3xl">
            {d.tenant.name}
          </h1>
          <p className="mt-1 text-sm text-white/50">
            {d.tenant.slug} · {d.tenant.status} · creado{" "}
            {new Date(d.tenant.created_at).toLocaleDateString("es-GT")}
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-void-card p-5">
          <p className="text-xs uppercase tracking-wide text-white/40">
            Ingreso del mes
          </p>
          <p className="mt-2 text-2xl font-bold text-white">
            {fmt(d.ingreso_mes)}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-void-card p-5">
          <p className="text-xs uppercase tracking-wide text-white/40">
            Gastos del mes
          </p>
          <p className="mt-2 text-2xl font-bold text-white">
            {fmt(d.gastos_mes)}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-void-card p-5">
          <p className="text-xs uppercase tracking-wide text-white/40">
            Clientas
          </p>
          <p className="mt-2 text-2xl font-bold text-white">
            {d.clientas.length}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-void-card p-5">
          <p className="text-xs uppercase tracking-wide text-white/40">
            Pagos pendientes
          </p>
          <p className="mt-2 text-2xl font-bold text-white">
            {d.pagos_pendientes.length}
          </p>
        </div>
      </div>

      <PlanModulos
        tenantId={tenantId}
        modulos={(modulos ?? []) as { key: string; nombre: string; descripcion: string; depende_de: string[]; activo: boolean }[]}
        planes={(planes ?? []) as { key: string; nombre: string; precio_mensual: number; max_sedes: number | null }[]}
        planActual={planActual}
      />

      <h2 className="mt-10 text-sm font-medium uppercase tracking-wide text-white/40">
        Sedes
      </h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {d.sedes.map((s) => (
          <li
            key={s.id}
            className="rounded-full border border-white/10 bg-void-card px-3 py-1.5 text-xs text-white/70"
          >
            {s.name} · {s.timezone}
          </li>
        ))}
        {d.sedes.length === 0 && (
          <li className="text-xs text-white/40">Sin sedes todavía.</li>
        )}
      </ul>

      <h2 className="mt-10 text-sm font-medium uppercase tracking-wide text-white/40">
        Personal ({d.personal.length})
      </h2>
      <ul className="mt-3 space-y-1.5">
        {d.personal.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between rounded-lg border border-white/5 bg-void-card/60 px-4 py-2 text-xs"
          >
            <span className="text-white">
              {p.nombre ?? "—"}{" "}
              <span className="text-white/40">{p.email}</span>
            </span>
            <span className="text-white/50">{p.role}</span>
          </li>
        ))}
        {d.personal.length === 0 && (
          <li className="text-xs text-white/40">Sin personal todavía.</li>
        )}
      </ul>

      <h2 className="mt-10 text-sm font-medium uppercase tracking-wide text-white/40">
        Paquetes ({d.paquetes.length})
      </h2>
      <ul className="mt-3 space-y-1.5">
        {d.paquetes.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between rounded-lg border border-white/5 bg-void-card/60 px-4 py-2 text-xs"
          >
            <span className={p.activo ? "text-white" : "text-white/40"}>
              {p.nombre} {!p.activo && "(inactivo)"}
            </span>
            <span className="text-white/50">
              {fmt(p.precio)} · {p.num_clases ?? "∞"} clases
            </span>
          </li>
        ))}
        {d.paquetes.length === 0 && (
          <li className="text-xs text-white/40">
            Sin paquetes todavía — este estudio no tiene nada que vender.
          </li>
        )}
      </ul>

      <h2 className="mt-10 text-sm font-medium uppercase tracking-wide text-white/40">
        Clases programadas ({d.proximas_clases.length})
      </h2>
      <ul className="mt-3 space-y-1.5">
        {d.proximas_clases.map((c) => (
          <li
            key={c.id}
            className="flex items-center justify-between rounded-lg border border-white/5 bg-void-card/60 px-4 py-2 text-xs"
          >
            <span className="text-white">
              {c.nombre_clase} · {c.sede}
            </span>
            <span className="text-white/50">
              {DIAS[c.dia_semana]} {String(c.hora_inicio).slice(0, 5)} ·{" "}
              {c.cupo_maximo} cupos
            </span>
          </li>
        ))}
        {d.proximas_clases.length === 0 && (
          <li className="text-xs text-white/40">
            Sin clases programadas todavía.
          </li>
        )}
      </ul>

      <h2 className="mt-10 text-sm font-medium uppercase tracking-wide text-white/40">
        Clientas ({d.clientas.length})
      </h2>
      <ul className="mt-3 space-y-1.5">
        {d.clientas.map((c) => (
          <li
            key={c.id}
            className="flex items-center justify-between rounded-lg border border-white/5 bg-void-card/60 px-4 py-2 text-xs"
          >
            <span className="text-white">
              {c.nombre} <span className="text-white/40">{c.telefono}</span>
            </span>
            <span className="text-white/50">
              {c.tiene_acceso ? "con acceso" : "sin acceso"}
            </span>
          </li>
        ))}
        {d.clientas.length === 0 && (
          <li className="text-xs text-white/40">Sin clientas todavía.</li>
        )}
      </ul>
    </main>
  );
}
