import { getPanelContext, ROLE_LABEL, fechaYDowEnSede } from "@/lib/panel-context";
import TodayView from "./today-view";

export default async function HoyPage() {
  const { supabase, user, membership, sedes, tenantName } =
    await getPanelContext();

  if (!membership) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-cream px-6 text-center">
        <div>
          <p className="font-serif text-xl text-ink">
            Esta cuenta no tiene un rol asignado en ningún estudio.
          </p>
          <p className="mt-2 text-sm text-ink/60">{user.email}</p>
        </div>
      </main>
    );
  }

  const sedeIds = sedes.map((s) => s.id);
  const { dow, fecha } = fechaYDowEnSede(
    sedes[0]?.timezone ?? "America/Guatemala",
  );

  const { data: horarios } = sedeIds.length
    ? await supabase
        .from("horarios")
        .select(
          "id, nombre_clase, hora_inicio, hora_fin, cupo_maximo, sede_id, sedes(name), tenant_memberships(nombre)",
        )
        .in("sede_id", sedeIds)
        .eq("dia_semana", dow)
        .eq("activo", true)
        .order("hora_inicio")
    : { data: [] };

  const horarioIds = (horarios ?? []).map((h) => h.id);

  // Nombres: roster con alcance (la instructora solo ve sus clases). Ocupación: conteo agregado, sin identidades.
  const [{ data: roster }, { data: ocupacion }] = await Promise.all([
    horarioIds.length ? supabase.rpc("roster_horarios", { p_horario_ids: horarioIds, p_fecha: fecha }) : Promise.resolve({ data: [] }),
    horarioIds.length ? supabase.rpc("ocupacion_horarios", { p_horario_ids: horarioIds, p_fecha_inicio: fecha, p_fecha_fin: fecha }) : Promise.resolve({ data: [] }),
  ]);
  const reservas = (roster ?? []) as { horario_id: string; nombre: string }[];
  const ocup = (ocupacion ?? []) as { horario_id: string; ocupados: number }[];

  const clases = (horarios ?? []).map((h) => {
    const ocupantes = (reservas ?? []).filter((r) => r.horario_id === h.id);
    return {
      id: h.id,
      nombre: h.nombre_clase,
      horaInicio: h.hora_inicio.slice(0, 5),
      horaFin: h.hora_fin.slice(0, 5),
      cupoMaximo: h.cupo_maximo,
      sede: (h.sedes as unknown as { name: string } | null)?.name ?? "",
      instructora:
        (h.tenant_memberships as unknown as { nombre: string } | null)
          ?.nombre ?? "Sin asignar",
      ocupados: Number(ocup.find((o) => o.horario_id === h.id)?.ocupados ?? ocupantes.length),
      clientas: ocupantes.map((o) => o.nombre),
    };
  });

  return (
    <TodayView
      nombre={membership.nombre ?? user.email ?? ""}
      rol={ROLE_LABEL[membership.role] ?? membership.role}
      tenantName={tenantName}
      fecha={fecha}
      clases={clases}
    />
  );
}
