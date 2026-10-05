import { getPanelContext, fechaYDowEnSede } from "@/lib/panel-context";
import CalendarioView from "./calendario-view";

export default async function CalendarioPage() {
  const { supabase, membership, sedes } = await getPanelContext();

  if (!membership) {
    return null;
  }

  const puedeCrear = ["duena", "gerente_general", "admin_sede"].includes(
    membership.role,
  );

  const { data: instructoras } = puedeCrear
    ? await supabase
        .from("tenant_memberships")
        .select("id, nombre")
        .eq("tenant_id", membership.tenant_id)
        .eq("role", "instructora")
        .order("nombre")
    : { data: [] };

  const sedeIds = sedes.map((s) => s.id);
  const { dow, fecha } = fechaYDowEnSede(
    sedes[0]?.timezone ?? "America/Guatemala",
  );

  const { data: horarios } = sedeIds.length
    ? await supabase
        .from("horarios")
        .select(
          "id, nombre_clase, hora_inicio, hora_fin, cupo_maximo, instructor_membership_id, tenant_memberships(nombre)",
        )
        .in("sede_id", sedeIds)
        .eq("dia_semana", dow)
        .eq("activo", true)
        .order("hora_inicio")
    : { data: [] };

  const horarioIds = (horarios ?? []).map((h) => h.id);

  const { data: reservas } = horarioIds.length
    ? await supabase
        .from("reservas")
        .select("horario_id, clientes(nombre)")
        .in("horario_id", horarioIds)
        .eq("fecha", fecha)
        .eq("estado", "confirmada")
    : { data: [] };

  // Cada instructora/horario recurrente actúa como "recurso" — columna del
  // calendario, igual que reformers/salas en el mockup del manual.
  const recursos = Array.from(
    new Map(
      (horarios ?? []).map((h) => [
        h.instructor_membership_id,
        (h.tenant_memberships as unknown as { nombre: string } | null)
          ?.nombre ?? "Sin asignar",
      ]),
    ),
  );

  const horas = Array.from(
    new Set((horarios ?? []).map((h) => h.hora_inicio.slice(0, 5))),
  ).sort();

  const celdas = (horarios ?? []).map((h) => ({
    hora: h.hora_inicio.slice(0, 5),
    recurso: h.instructor_membership_id,
    nombre: h.nombre_clase,
    clientas: (reservas ?? [])
      .filter((r) => r.horario_id === h.id)
      .map((r) => (r.clientes as unknown as { nombre: string } | null)?.nombre)
      .filter(Boolean) as string[],
    cupoMaximo: h.cupo_maximo,
  }));

  return (
    <CalendarioView
      fecha={fecha}
      recursos={recursos}
      horas={horas}
      celdas={celdas}
      tenantId={membership.tenant_id}
      sedes={sedes}
      instructoras={instructoras ?? []}
      puedeCrear={puedeCrear}
    />
  );
}
