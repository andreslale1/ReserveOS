import { getCuenta } from "@/lib/cuenta-context";
import ClasesView, { type Clase } from "./clases-view";

const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

export default async function ClasesPage({ searchParams }: { searchParams: Promise<{ sede?: string; dia?: string; para?: string }> }) {
  const sp = await searchParams;
  const { supabase, actual } = await getCuenta();
  const tenantId = actual!.tenant_id;

  const [{ data: sedes }, { data: deps }, { data: cfg }] = await Promise.all([
    supabase.from("sedes").select("id, name, timezone, status").eq("tenant_id", tenantId).eq("status", "activa").order("name"),
    supabase.rpc("mis_dependientes", { p_tenant_id: tenantId }),
    supabase.from("configuracion_reservas").select("horas_minimas_cancelacion, anticipacion_maxima_dias").eq("tenant_id", tenantId).maybeSingle(),
  ]);
  const listaSedes = sedes ?? [];
  if (listaSedes.length === 0) return <p className="text-sm text-ink/60">Este estudio aún no tiene sedes activas.</p>;

  const { data: yo } = await supabase.from("clientes").select("sede_habitual_id").eq("id", actual!.cliente_id!).maybeSingle();
  const sede = listaSedes.find((s) => s.id === sp.sede) ?? listaSedes.find((s) => s.id === yo?.sede_habitual_id) ?? listaSedes[0];

  const dias = Array.from({ length: Math.min(cfg?.anticipacion_maxima_dias ?? 14, 14) }).map((_, i) => {
    const d = new Date(Date.now() + i * 86400000);
    const fecha = new Intl.DateTimeFormat("en-CA", { timeZone: sede.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
    const dow = new Date(new Date(d).toLocaleString("en-US", { timeZone: sede.timezone })).getDay();
    return { fecha, dow, label: DIAS[dow], num: Number(fecha.slice(8)) };
  });
  const dia = dias.find((d) => d.fecha === sp.dia) ?? dias[0];

  const dependientes = (deps ?? []) as { id: string; nombre: string }[];
  const para = dependientes.find((d) => d.id === sp.para)?.id ?? actual!.cliente_id!;

  const { data: horarios } = await supabase
    .from("horarios")
    .select("id, nombre_clase, hora_inicio, hora_fin, cupo_maximo, dia_semana, fecha_especifica, categoria, tenant_memberships(nombre)")
    .eq("sede_id", sede.id).eq("activo", true).eq("categoria", "regular")
    .or(`and(fecha_especifica.is.null,dia_semana.eq.${dia.dow}),fecha_especifica.eq.${dia.fecha}`)
    .order("hora_inicio");

  const ids = (horarios ?? []).map((h) => h.id);
  const [{ data: ocup }, { data: mias }, { data: espera }] = await Promise.all([
    ids.length ? supabase.rpc("ocupacion_horarios", { p_horario_ids: ids, p_fecha_inicio: dia.fecha, p_fecha_fin: dia.fecha }) : Promise.resolve({ data: [] }),
    ids.length ? supabase.from("reservas").select("id, horario_id, cliente_id").in("horario_id", ids).eq("fecha", dia.fecha).eq("estado", "confirmada") : Promise.resolve({ data: [] }),
    supabase.rpc("mi_lista_espera"),
  ]);
  const elig = await Promise.all((horarios ?? []).map((h) => supabase.rpc("elegibilidad_clase", { p_horario_id: h.id, p_fecha: dia.fecha, p_cliente_id: para })));

  const clases: Clase[] = (horarios ?? []).map((h, i) => {
    const e = (elig[i].data ?? { puede: false, codigo: "error", motivo: "No pudimos revisar esta clase." }) as Clase["elig"];
    const reserva = ((mias ?? []) as { id: string; horario_id: string; cliente_id: string }[]).find((r) => r.horario_id === h.id && r.cliente_id === para);
    const ocupados = ((ocup ?? []) as { horario_id: string; fecha: string; ocupados: number }[]).find((o) => o.horario_id === h.id)?.ocupados ?? 0;
    const en = ((espera ?? []) as { id: string; horario_id: string; fecha: string; cliente_id?: string }[]).find((x) => x.horario_id === h.id && x.fecha === dia.fecha);
    return {
      id: h.id, nombre: h.nombre_clase, inicio: h.hora_inicio.slice(0, 5), fin: h.hora_fin.slice(0, 5),
      instructora: (h.tenant_memberships as unknown as { nombre: string } | null)?.nombre ?? "", lugares: Math.max(h.cupo_maximo - ocupados, 0),
      reservaId: reserva?.id ?? null, esperaId: en?.id ?? null, elig: e,
    };
  });

  return (
    <ClasesView
      sedes={listaSedes.map((s) => ({ id: s.id, name: s.name }))} sedeId={sede.id} dias={dias} dia={dia.fecha}
      dependientes={[{ id: actual!.cliente_id!, nombre: "Yo" }, ...dependientes]} para={para}
      clases={clases} horasCancelacion={cfg?.horas_minimas_cancelacion ?? 2}
    />
  );
}
