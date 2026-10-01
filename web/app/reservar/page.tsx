import { getClientContext } from "@/lib/client-context";
import ReservarView from "./reservar-view";

const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

export default async function ReservarPage() {
  const { supabase, cliente } = await getClientContext();

  if (!cliente) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-cream px-6 text-center">
        <div>
          <p className="text-xl font-semibold text-ink">
            Esta cuenta no tiene un perfil de clienta en ningún estudio.
          </p>
          <p className="mt-2 text-sm text-ink-soft">
            Pedile al estudio que te registre, o entrá con tu cuenta de
            clienta.
          </p>
        </div>
      </main>
    );
  }

  const sede = cliente.sedes as unknown as {
    id: string;
    name: string;
    timezone: string;
  } | null;

  const timezone = sede?.timezone ?? "America/Guatemala";
  const hoy = new Date(
    new Date().toLocaleString("en-US", { timeZone: timezone }),
  );

  const dias = Array.from({ length: 5 }).map((_, i) => {
    const d = new Date(hoy);
    d.setDate(hoy.getDate() + i);
    const fecha = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
    }).format(d);
    return { fecha, dow: d.getDay(), label: DIAS[d.getDay()], dayNum: d.getDate() };
  });

  const { data: membresia } = await supabase
    .from("membresias")
    .select("clases_totales, clases_usadas, fecha_vencimiento")
    .eq("cliente_id", cliente.id)
    .eq("estado", "activa")
    .order("fecha_vencimiento", { ascending: true })
    .limit(1)
    .maybeSingle();

  const dows = [...new Set(dias.map((d) => d.dow))];

  const { data: horarios } = sede
    ? await supabase
        .from("horarios")
        .select("id, nombre_clase, hora_inicio, hora_fin, cupo_maximo, dia_semana, tenant_memberships(nombre)")
        .eq("sede_id", sede.id)
        .eq("activo", true)
        .in("dia_semana", dows)
        .order("hora_inicio")
    : { data: [] };

  const horarioIds = (horarios ?? []).map((h) => h.id);
  const fechas = dias.map((d) => d.fecha);

  const { data: reservas } = horarioIds.length
    ? await supabase
        .from("reservas")
        .select("horario_id, fecha, cliente_id, estado")
        .in("horario_id", horarioIds)
        .in("fecha", fechas)
    : { data: [] };

  const clasesPorDia = dias.map((dia) => ({
    ...dia,
    clases: (horarios ?? [])
      .filter((h) => h.dia_semana === dia.dow)
      .map((h) => {
        const reservasClase = (reservas ?? []).filter(
          (r) => r.horario_id === h.id && r.fecha === dia.fecha,
        );
        const confirmadas = reservasClase.filter(
          (r) => r.estado === "confirmada",
        );
        const miReserva = reservasClase.find(
          (r) => r.cliente_id === cliente.id && r.estado === "confirmada",
        );
        return {
          id: h.id,
          nombre: h.nombre_clase,
          horaInicio: h.hora_inicio.slice(0, 5),
          cupoMaximo: h.cupo_maximo,
          ocupados: confirmadas.length,
          instructora:
            (h.tenant_memberships as unknown as { nombre: string } | null)
              ?.nombre ?? "Sin asignar",
          yaReservada: !!miReserva,
        };
      }),
  }));

  return (
    <ReservarView
      nombre={cliente.nombre}
      sedeName={sede?.name ?? ""}
      clasesRestantes={
        membresia
          ? (membresia.clases_totales ?? 0) - membresia.clases_usadas
          : null
      }
      dias={clasesPorDia}
    />
  );
}
