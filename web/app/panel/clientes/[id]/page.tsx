import { notFound, redirect } from "next/navigation";
import { getPanelContext, puedeVer } from "@/lib/panel-context";
import FichaView from "./ficha-view";

const DIAS_ADELANTE = 14;

function fechaEnSede(tz: string, offset: number) {
  const d = new Date(Date.now() + offset * 86400000);
  const fecha = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  const dow = new Date(
    new Date(d).toLocaleString("en-US", { timeZone: tz }),
  ).getDay();
  return { fecha, dow };
}

export default async function FichaClientaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, membership, sedes } = await getPanelContext();

  if (!membership) return null;
  if (!puedeVer(membership.role, "/panel/clientes")) redirect("/panel/hoy");

  const { data: cliente } = await supabase
    .from("clientes")
    .select(
      "id, nombre, telefono, email, notas, cuidados_especiales, contacto_emergencia, fecha_nacimiento, consentimiento_completado_at, created_at",
    )
    .eq("id", id)
    .eq("tenant_id", membership.tenant_id)
    .maybeSingle();
  if (!cliente) notFound();

  const [{ data: membresias }, { data: reservas }, { data: paquetes }] =
    await Promise.all([
      supabase
        .from("membresias")
        .select(
          "id, estado, clases_totales, clases_usadas, fecha_inicio, fecha_vencimiento, precio_final, metodo_pago, origen, paquetes(nombre)",
        )
        .eq("cliente_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("reservas")
        .select(
          "id, fecha, estado, asistio, horarios(nombre_clase, hora_inicio), sedes(name)",
        )
        .eq("cliente_id", id)
        .order("fecha", { ascending: false })
        .limit(30),
      supabase
        .from("paquetes")
        .select("id, nombre, precio")
        .eq("tenant_id", membership.tenant_id)
        .eq("activo", true)
        .order("precio"),
    ]);

  // Clases de los próximos 14 días en las sedes del usuario, para reservar por la clienta.
  const tz = sedes[0]?.timezone ?? "America/Guatemala";
  const sedeIds = sedes.map((s) => s.id);
  const { data: horarios } = sedeIds.length
    ? await supabase
        .from("horarios")
        .select("id, nombre_clase, hora_inicio, dia_semana, sede_id, fecha_especifica")
        .in("sede_id", sedeIds)
        .eq("activo", true)
        .order("hora_inicio")
    : { data: [] };

  const opcionesClase: { horarioId: string; fecha: string; texto: string }[] =
    [];
  for (let i = 0; i < DIAS_ADELANTE; i++) {
    const { fecha, dow } = fechaEnSede(tz, i);
    for (const h of horarios ?? []) {
      const coincide = h.fecha_especifica
        ? h.fecha_especifica === fecha
        : h.dia_semana === dow;
      if (!coincide) continue;
      const sede = sedes.find((s) => s.id === h.sede_id)?.name ?? "";
      opcionesClase.push({
        horarioId: h.id,
        fecha,
        texto: `${fecha} · ${h.hora_inicio.slice(0, 5)} · ${h.nombre_clase}${sedes.length > 1 ? ` · ${sede}` : ""}`,
      });
    }
  }

  const { data: otras } = await supabase
    .from("clientes")
    .select("id, nombre")
    .eq("tenant_id", membership.tenant_id)
    .neq("id", id)
    .order("nombre");

  const rol = membership.role;
  return (
    <FichaView
      cliente={{
        id: cliente.id,
        nombre: cliente.nombre,
        telefono: cliente.telefono,
        email: cliente.email ?? "",
        notas: cliente.notas ?? "",
        cuidados: cliente.cuidados_especiales ?? "",
        emergencia: cliente.contacto_emergencia ?? "",
        nacimiento: cliente.fecha_nacimiento ?? "",
        consentimiento: cliente.consentimiento_completado_at !== null,
      }}
      membresias={(membresias ?? []).map((m) => ({
        id: m.id,
        estado: m.estado,
        totales: m.clases_totales,
        usadas: m.clases_usadas,
        inicio: m.fecha_inicio,
        vence: m.fecha_vencimiento,
        precio: m.precio_final,
        metodo: m.metodo_pago,
        origen: m.origen,
        paquete:
          (m.paquetes as unknown as { nombre: string } | null)?.nombre ?? "—",
      }))}
      reservas={(reservas ?? []).map((r) => ({
        id: r.id,
        fecha: r.fecha,
        estado: r.estado,
        asistio: r.asistio,
        clase:
          (r.horarios as unknown as { nombre_clase: string } | null)
            ?.nombre_clase ?? "Clase",
        hora:
          (
            r.horarios as unknown as { hora_inicio: string } | null
          )?.hora_inicio?.slice(0, 5) ?? "",
        sede: (r.sedes as unknown as { name: string } | null)?.name ?? "",
      }))}
      paquetes={(paquetes ?? []).map((p) => ({
        id: p.id,
        nombre: p.nombre,
        precio: Number(p.precio),
      }))}
      sedes={sedes.map((s) => ({ id: s.id, name: s.name }))}
      opcionesClase={opcionesClase}
      otrasClientas={otras ?? []}
      puedeVender={["duena", "gerente_general", "admin_sede", "recepcion"].includes(rol)}
      puedeCortesia={["duena", "gerente_general"].includes(rol)}
      puedeEditar={["duena", "gerente_general", "admin_sede", "recepcion"].includes(rol)}
    />
  );
}
