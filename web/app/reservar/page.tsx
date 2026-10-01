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

  // reservas_propia_select limita esta tabla a solo las reservas de la propia
  // clienta -- para la ocupacion total (otras clientas) se usa el RPC
  // agregado ocupacion_horarios, que nunca expone identidades ajenas.
  const [{ data: misReservas }, { data: ocupacion }] = await Promise.all([
    horarioIds.length
      ? supabase
          .from("reservas")
          .select("horario_id, fecha")
          .eq("cliente_id", cliente.id)
          .eq("estado", "confirmada")
          .in("horario_id", horarioIds)
          .in("fecha", fechas)
      : Promise.resolve({ data: [] }),
    horarioIds.length
      ? supabase.rpc("ocupacion_horarios", {
          p_horario_ids: horarioIds,
          p_fecha_inicio: fechas[0],
          p_fecha_fin: fechas[fechas.length - 1],
        })
      : Promise.resolve({
          data: [] as { horario_id: string; fecha: string; ocupados: number }[],
        }),
  ]);

  const clasesPorDia = dias.map((dia) => ({
    ...dia,
    clases: (horarios ?? [])
      .filter((h) => h.dia_semana === dia.dow)
      .map((h) => {
        const ocupados =
          (
            (ocupacion ?? []) as {
              horario_id: string;
              fecha: string;
              ocupados: number;
            }[]
          ).find((o) => o.horario_id === h.id && o.fecha === dia.fecha)
            ?.ocupados ?? 0;
        const miReserva = (misReservas ?? []).some(
          (r) => r.horario_id === h.id && r.fecha === dia.fecha,
        );
        return {
          id: h.id,
          nombre: h.nombre_clase,
          horaInicio: h.hora_inicio.slice(0, 5),
          cupoMaximo: h.cupo_maximo,
          ocupados,
          instructora:
            (h.tenant_memberships as unknown as { nombre: string } | null)
              ?.nombre ?? "Sin asignar",
          yaReservada: miReserva,
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
