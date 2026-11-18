import Link from "next/link";
import { getOwnerContext } from "@/lib/owner-context";
import Asignar from "./asignar";

type Fila = {
  tenant_id: string; nombre: string; slug: string; reservas_7d: number; ultima_reserva: string | null;
  cobros_vencidos: number; monto_vencido: number; tickets_abiertos: number; tickets_urgentes: number;
  personal_total: number; personal_sin_entrar: number; responsables: string[]; puntos: number; motivos: string[];
};

export default async function AtencionPage({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const { supabase, user, operador } = await getOwnerContext();
  const { ver } = await searchParams;
  const [{ data, error }, { data: eq }] = await Promise.all([supabase.rpc("estudios_atencion"), supabase.rpc("equipo_listar")]);
  if (error) return <main className="mx-auto max-w-3xl px-6 py-16 text-center text-white/60" role="alert">{error.message}</main>;
  const todas = (data ?? []) as Fila[];
  const equipo = ((eq ?? []) as { user_id: string; nombre: string | null; email: string }[]).map((m) => ({ user_id: m.user_id, nombre: m.nombre ?? m.email }));
  const miNombre = equipo.find((m) => m.user_id === user.id)?.nombre;
  const filas = ver === "mios" && miNombre ? todas.filter((f) => f.responsables.includes(miNombre)) : todas;
  const urgentes = filas.filter((f) => f.puntos >= 3);

  return (
    <main className="mx-auto max-w-5xl px-6 py-8 text-white md:px-10">
      <h1 className="text-2xl font-black uppercase tracking-tight">Estudios que requieren atención</h1>
      <p className="mt-1 text-sm text-white/55">Ordenados por riesgo: sin reservas, cobros vencidos, tickets y personal que no entra. {urgentes.length} requieren acción hoy.</p>
      <div className="mt-4 flex gap-2 text-sm">
        <Link href="/owner/atencion" className={`rounded-full px-3 py-1 ${ver !== "mios" ? "bg-lime text-void" : "border border-white/20"}`}>Todos</Link>
        <Link href="/owner/atencion?ver=mios" className={`rounded-full px-3 py-1 ${ver === "mios" ? "bg-lime text-void" : "border border-white/20"}`}>Mis estudios</Link>
      </div>
      <ul className="mt-6 grid gap-3">
        {filas.length === 0 && <li className="rounded-2xl border border-white/10 bg-void-card p-5 text-sm text-white/60">No hay estudios para mostrar.</li>}
        {filas.map((f) => (
          <li key={f.tenant_id} className="rounded-2xl border border-white/10 bg-void-card p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-semibold">{f.nombre}</p>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${f.puntos >= 3 ? "bg-red-400/20 text-red-300" : f.puntos > 0 ? "bg-yellow-300/20 text-yellow-200" : "bg-lime/15 text-lime"}`}>
                {f.puntos >= 3 ? "Atender hoy" : f.puntos > 0 ? "Vigilar" : "Sano"}
              </span>
            </div>
            <p className="mt-1 text-sm text-white/65">{f.motivos.length ? f.motivos.join(" · ") : "Sin alertas."}</p>
            <p className="mt-1 text-xs text-white/40">{f.reservas_7d} reservas en 7 días · última {f.ultima_reserva ?? "nunca"} · {f.personal_total} cuentas de equipo</p>
            {operador.rol === "operador" ? (
              <Asignar tenantId={f.tenant_id} equipo={equipo} responsables={f.responsables} />
            ) : (
              <p className="mt-2 text-xs text-white/50">Responsable: {f.responsables.length ? f.responsables.join(", ") : "sin asignar"}</p>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
