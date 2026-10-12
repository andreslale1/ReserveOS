import Link from "next/link";
import { getCuenta } from "@/lib/cuenta-context";
import PrivadasClienta, { type Hueco, type MiPrivada } from "./privadas-view";

export default async function PrivadasPage() {
  const { supabase, actual } = await getCuenta();
  const tenantId = actual!.tenant_id;
  const [{ data: sedes }, { data: yo }] = await Promise.all([
    supabase.from("sedes").select("id, name, timezone").eq("tenant_id", tenantId).eq("status", "activa").order("name"),
    supabase.from("clientes").select("sede_habitual_id").eq("id", actual!.cliente_id!).maybeSingle(),
  ]);
  const zona = (sedes ?? []).find((s) => s.id === yo?.sede_habitual_id)?.timezone ?? sedes?.[0]?.timezone ?? "America/Guatemala";
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: zona }).format(new Date());
  const hasta = new Intl.DateTimeFormat("en-CA", { timeZone: zona }).format(new Date(Date.now() + 14 * 86400000));

  const [{ data: huecos }, { data: paquetes }, { data: mias }] = await Promise.all([
    supabase.rpc("disponibilidad_privada", { p_tenant_id: tenantId, p_desde: hoy, p_hasta: hasta }),
    supabase.from("membresias").select("id, clases_totales, clases_usadas, fecha_vencimiento, paquetes!inner(nombre, categoria)").eq("cliente_id", actual!.cliente_id!).eq("estado", "activa").eq("paquetes.categoria", "privado"),
    supabase.from("reservas").select("id, fecha, horarios(nombre_clase, hora_inicio, hora_fin, tenant_memberships(nombre)), sedes(name)").eq("cliente_id", actual!.cliente_id!).eq("tipo", "privado").eq("estado", "confirmada").gte("fecha", hoy).order("fecha"),
  ]);
  const conCredito = (paquetes ?? []).filter((m) => m.clases_totales === null || m.clases_usadas < m.clases_totales).length;
  const sedeNombre = new Map((sedes ?? []).map((s) => [s.id, s.name]));

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-serif text-2xl text-ink">Clases privadas</h1>
        <Link href="/cuenta/clases" className="text-sm text-ink underline">← Clases en grupo</Link>
      </div>
      {conCredito === 0 && (
        <p className="rounded-2xl bg-peach-tint px-5 py-4 text-sm text-ink">Para reservar una clase privada necesitas un paquete de clases privadas. <Link href="/cuenta/paquetes" className="underline">Ver paquetes</Link></p>
      )}
      <PrivadasClienta
        clienteId={actual!.cliente_id!} puedeReservar={conCredito > 0}
        huecos={((huecos ?? []) as Omit<Hueco, "sede">[] & { sede_id: string }[]).map((h) => ({ ...(h as object), sede: sedeNombre.get((h as unknown as { sede_id: string }).sede_id) ?? "" })) as Hueco[]}
        mias={((mias ?? []) as unknown as { id: string; fecha: string; horarios: { nombre_clase: string; hora_inicio: string; hora_fin: string; tenant_memberships: { nombre: string } | null } | null; sedes: { name: string } | null }[]).map((r): MiPrivada => ({
          id: r.id, fecha: r.fecha, clase: r.horarios?.nombre_clase ?? "", inicio: (r.horarios?.hora_inicio ?? "").slice(0, 5), fin: (r.horarios?.hora_fin ?? "").slice(0, 5), sede: r.sedes?.name ?? "", instructora: r.horarios?.tenant_memberships?.nombre ?? "",
        }))}
      />
    </div>
  );
}
