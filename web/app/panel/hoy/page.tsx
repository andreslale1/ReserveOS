import { getPanelContext, ROLE_LABEL, fechaYDowEnSede } from "@/lib/panel-context";
import TodayView from "./today-view";

export default async function HoyPage({ searchParams }: { searchParams: Promise<{ vista?: string; f?: string }> }) {
  const sp = await searchParams;
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
  const { fecha: hoy } = fechaYDowEnSede(
    sedes[0]?.timezone ?? "America/Guatemala",
  );
  const vista = sp.vista === "semana" || sp.vista === "mes" ? sp.vista : "dia";
  const fecha = sp.f && /^\d{4}-\d{2}-\d{2}$/.test(sp.f) ? sp.f : hoy;
  const dowDe = (iso: string) => new Date(iso + "T00:00:00Z").getUTCDay();
  const dow = dowDe(fecha);

  const { data: horarios } = sedeIds.length
    ? await supabase
        .from("horarios")
        .select(
          "id, nombre_clase, hora_inicio, hora_fin, cupo_maximo, sede_id, dia_semana, sedes(name), tenant_memberships(nombre)",
        )
        .in("sede_id", sedeIds)
        .eq("activo", true)
        .order("hora_inicio")
    : { data: [] };

  const todos = horarios ?? [];
  const delDia = todos.filter((h) => h.dia_semana === dow);
  const horarioIds = delDia.map((h) => h.id);

  // Nombres: roster con alcance (la instructora solo ve sus clases). Ocupación: conteo agregado, sin identidades.
  const [{ data: roster }, { data: ocupacion }] = await Promise.all([
    horarioIds.length ? supabase.rpc("roster_horarios", { p_horario_ids: horarioIds, p_fecha: fecha }) : Promise.resolve({ data: [] }),
    horarioIds.length ? supabase.rpc("ocupacion_horarios", { p_horario_ids: horarioIds, p_fecha_inicio: fecha, p_fecha_fin: fecha }) : Promise.resolve({ data: [] }),
  ]);
  const reservas = (roster ?? []) as { horario_id: string; nombre: string }[];
  const ocup = (ocupacion ?? []) as { horario_id: string; ocupados: number }[];

  const clases = delDia.map((h) => {
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

  // Semana (lunes a domingo de la fecha elegida) y mes: solo qué clases hay cada día; la ocupación se ve al abrir el día.
  const sumar = (iso: string, d: number) => { const x = new Date(iso + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + d); return x.toISOString().slice(0, 10); };
  const lunes = sumar(fecha, -((dow + 6) % 7));
  const resumenDia = (iso: string) => todos.filter((h) => h.dia_semana === dowDe(iso)).sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
  const semana = Array.from({ length: 7 }, (_, i) => {
    const d = sumar(lunes, i);
    return { fecha: d, clases: resumenDia(d).map((h) => ({ hora: h.hora_inicio.slice(0, 5), nombre: h.nombre_clase, sede: (h.sedes as unknown as { name: string } | null)?.name ?? "" })) };
  });
  const primero = fecha.slice(0, 8) + "01";
  const relleno = (dowDe(primero) + 6) % 7;
  const diasMes = new Date(Number(fecha.slice(0, 4)), Number(fecha.slice(5, 7)), 0).getDate();
  const mes = Array.from({ length: relleno + diasMes }, (_, i) => {
    if (i < relleno) return null;
    const d = sumar(primero, i - relleno);
    return { fecha: d, n: resumenDia(d).length };
  });

  return (
    <TodayView
      vista={vista}
      hoy={hoy}
      semana={semana}
      mes={mes}
      nombre={membership.nombre ?? user.email ?? ""}
      rol={ROLE_LABEL[membership.role] ?? membership.role}
      tenantName={tenantName}
      fecha={fecha}
      clases={clases}
    />
  );
}
