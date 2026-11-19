import { getPanelContext, ROLE_LABEL, fechaYDowEnSede } from "@/lib/panel-context";
import TodayView from "./today-view";
import QueHagoHoy from "./que-hago-hoy";
import Resumen, { type Atencion, type Kpi } from "./resumen";

export default async function HoyPage({ searchParams }: { searchParams: Promise<{ vista?: string; f?: string }> }) {
  const sp = await searchParams;
  const { supabase, user, membership, sedes, tenantName, modulos } =
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

  const { data: efs } = horarioIds.length ? await supabase.rpc("cupos_efectivos", { p_horario_ids: horarioIds, p_fecha: fecha }) : { data: [] };
  const cupoDe = new Map(((efs ?? []) as { horario_id: string; cupo: number }[]).map((x) => [x.horario_id, x.cupo] as const));

  const clases = delDia.map((h) => {
    const ocupantes = (reservas ?? []).filter((r) => r.horario_id === h.id);
    return {
      id: h.id,
      nombre: h.nombre_clase,
      horaInicio: h.hora_inicio.slice(0, 5),
      horaFin: h.hora_fin.slice(0, 5),
      cupoMaximo: cupoDe.get(h.id) ?? h.cupo_maximo,
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

  // Resumen para roles de gestión: indicadores y pendientes con datos reales. Si una consulta falla, se dice (no se muestra 0).
  const gestion = ["duena", "gerente_general", "gerente_regional", "admin_sede"].includes(membership.role);
  let resumen: React.ReactNode = null;
  if (gestion) {
    const t = membership.tenant_id;
    const inicioMes = hoy.slice(0, 8) + "01";
    const en7 = (() => { const d = new Date(hoy + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + 7); return d.toISOString().slice(0, 10); })();
    const [fin, pend, vigentes, porVencer, espera] = await Promise.all([
      supabase.rpc("kpi_finanzas_resumen", { p_tenant_id: t, p_desde: inicioMes, p_hasta: hoy }),
      supabase.from("membresias").select("id, paquetes(precio)").eq("tenant_id", t).eq("pagada", false).eq("estado", "activa"),
      supabase.from("membresias").select("cliente_id").eq("tenant_id", t).eq("estado", "activa").eq("pagada", true).gte("fecha_vencimiento", hoy),
      supabase.from("membresias").select("id", { count: "exact", head: true }).eq("tenant_id", t).eq("estado", "activa").gte("fecha_vencimiento", hoy).lte("fecha_vencimiento", en7),
      supabase.from("lista_espera").select("id", { count: "exact", head: true }).eq("tenant_id", t).eq("fecha", hoy),
    ]);
    const totalReservas = clases.reduce((a, c) => a + c.ocupados, 0);
    const totalCupos = clases.reduce((a, c) => a + c.cupoMaximo, 0);
    const ocupacionPct = totalCupos ? Math.round((totalReservas / totalCupos) * 100) : 0;
    // El ingreso mensual solo lo ven dueña y gerencia general (la función devuelve null para otros roles).
    const verFinanzas = ["duena", "gerente_general"].includes(membership.role);
    const ingreso = (fin.data as { ingresos?: number } | null)?.ingresos ?? null;
    const q = (n: number) => `Q${Math.round(n).toLocaleString("es-GT")}`;
    const nPend = pend.error ? null : (pend.data ?? []).length;
    const montoPend = (pend.data ?? []).reduce((a, m) => a + Number((m.paquetes as unknown as { precio: number } | null)?.precio ?? 0), 0);
    const activos = vigentes.error ? null : new Set((vigentes.data ?? []).map((m) => m.cliente_id)).size;
    const kpis: Kpi[] = [
      verFinanzas
        ? { etiqueta: "Ingreso confirmado del mes", valor: ingreso === null || fin.error ? "—" : q(Number(ingreso)), nota: "Solo dinero confirmado", href: "/panel/finanzas", error: !!fin.error || ingreso === null }
        : { etiqueta: "Reservas de hoy", valor: String(totalReservas), nota: `${clases.length} ${clases.length === 1 ? "clase" : "clases"} en el día`, href: "/panel/calendario" },
      { etiqueta: "Ocupación de hoy", valor: String(ocupacionPct), unidad: "%", nota: `${totalReservas} de ${totalCupos} lugares reservados`, href: "/panel/calendario" },
      { etiqueta: "Clientes con paquete vigente", valor: activos === null ? "—" : String(activos), nota: "Con paquete pagado y vigente", href: "/panel/clientes", error: activos === null },
      { etiqueta: "Pagos por revisar", valor: nPend === null ? "—" : String(nPend), nota: nPend === null ? "" : `${q(montoPend)} por confirmar`, href: "/panel/pagos-pendientes", error: nPend === null },
    ];
    const atencion: Atencion[] = [
      { n: nPend, titulo: "Pagos por confirmar", detalle: "Revisa la transferencia en el banco antes de confirmar", href: "/panel/pagos-pendientes" },
      { n: porVencer.error ? null : porVencer.count ?? 0, titulo: "Paquetes por vencer en 7 días", detalle: "Ayúdales a seguir entrenando", href: "/panel/clientes" },
      { n: espera.error ? null : espera.count ?? 0, titulo: "Personas en lista de espera hoy", detalle: "Hay clases llenas con gente esperando", href: "/panel/calendario" },
    ];
    const fechaTxt = new Date(fecha + "T00:00:00").toLocaleDateString("es-GT", { weekday: "long", day: "numeric", month: "long" });
    resumen = <Resumen estudio={tenantName} rol={ROLE_LABEL[membership.role] ?? membership.role} fecha={fechaTxt} alcance={sedes.length > 1 ? `${sedes.length} sedes` : sedes[0] ? `Sede ${sedes[0].name}` : "Todas las sedes"} kpis={kpis} atencion={atencion} />;
  }

  return (
    <>
    {gestion ? null : <QueHagoHoy rol={membership.role} modulos={modulos} />}
    <TodayView encabezado={resumen}
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
    </>
  );
}
