import { notFound, redirect } from "next/navigation";
import { getPanelContext, puedeVer } from "@/lib/panel-context";
import ClaseView from "./clase-view";

export default async function ClasePage({
  params,
}: {
  params: Promise<{ horarioId: string; fecha: string }>;
}) {
  const { horarioId, fecha } = await params;
  const { supabase, membership, sedes } = await getPanelContext();

  if (!membership) return null;
  if (!puedeVer(membership.role, "/panel/calendario")) redirect("/panel/hoy");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) notFound();

  const { data: h } = await supabase
    .from("horarios")
    .select(
      "id, nombre_clase, hora_inicio, hora_fin, cupo_maximo, sede_id, sala_id, sedes(name), tenant_memberships(nombre)",
    )
    .eq("id", horarioId)
    .eq("tenant_id", membership.tenant_id)
    .maybeSingle();
  if (!h) notFound();

  const [{ data: reservas }, { data: espera }, { data: cancelada }, { data: clientas }, { data: salas }] =
    await Promise.all([
      supabase.rpc("roster_horarios", { p_horario_ids: [horarioId], p_fecha: fecha }),
      supabase.rpc("espera_horario", { p_horario_id: horarioId, p_fecha: fecha }),
      supabase
        .from("horario_cancelaciones")
        .select("id")
        .eq("horario_id", horarioId)
        .eq("fecha", fecha)
        .maybeSingle(),
      supabase
        .from("clientes")
        .select("id, nombre")
        .eq("tenant_id", membership.tenant_id)
        .order("nombre"),
      supabase.from("salas").select("id, nombre").eq("sede_id", h.sede_id).eq("activa", true).order("nombre"),
    ]);

  const rol = membership.role;
  const tz = sedes.find((s) => s.id === h.sede_id)?.timezone ?? "America/Guatemala";
  const hoy = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  return (
    <ClaseView
      horarioId={horarioId}
      fecha={fecha}
      esFuturaOHoy={fecha >= hoy}
      noEsFutura={fecha <= hoy}
      clase={{
        nombre: h.nombre_clase,
        hora: `${h.hora_inicio.slice(0, 5)}–${h.hora_fin.slice(0, 5)}`,
        cupo: h.cupo_maximo,
        sede: (h.sedes as unknown as { name: string } | null)?.name ?? "",
        instructora:
          (h.tenant_memberships as unknown as { nombre: string } | null)
            ?.nombre ?? "Sin asignar",
      }}
      salaId={h.sala_id ?? ""}
      salas={salas ?? []}
      cancelada={cancelada !== null}
      asistentes={((reservas ?? []) as { reserva_id: string; nombre: string; telefono: string | null; cuidados: string | null; tipo: string; asistio: boolean | null }[]).map((r) => ({
        id: r.reserva_id,
        nombre: r.nombre ?? "—",
        telefono: r.telefono ?? "",
        cuidados: r.cuidados ?? "",
        tipo: r.tipo,
        asistio: r.asistio,
      }))}
      espera={((espera ?? []) as { id: string; nombre: string }[]).map((e) => ({ id: e.id, nombre: e.nombre ?? "—" }))}
      clientas={clientas ?? []}
      puedeGestionar={["duena", "gerente_general", "admin_sede", "recepcion"].includes(rol)}
      puedeAdminClase={["duena", "gerente_general", "admin_sede"].includes(rol)}
    />
  );
}
