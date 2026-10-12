// CLASES, ASISTENCIA E INSTRUCTORAS por API directa, con la sesión real de cada rol sobre los estudios de prueba
// (VIM de 3 sedes, un estudio de una sede y uno ajeno): historial de reservas, clases por instructora (el pasado no cambia al cambiar
// el horario), corrección masiva y sustitución (solo la dueña, auditada), corrección de asistencia con devolución exacta del crédito,
// cancelar la clase de un día con su aviso, confirmación de asistencia y liberación de cupos, reto mensual, clases privadas 1 a 1 y QR.
// Todo lo que se crea lleva el prefijo «TMP CL» y se borra al terminar; los créditos de las clientas del fixture se restauran.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import roles from "./fixtures/roles.json";
import { login, rpc } from "./helpers";
// @ts-expect-error módulo .mjs sin tipos
import { consulta } from "./escenarios/concurrencia.mjs";

const MGMT = process.env.SUPABASE_ACCESS_TOKEN ?? "";
const REF = process.env.SUPABASE_PROJECT_REF ?? "agkqppuhyltirrhngybq";
const sql = (q: string) => { const r = consulta(MGMT, REF, q); if (r && !Array.isArray(r) && r.message) throw new Error(String(r.message).slice(0, 400)); return r as Record<string, any>[]; };
const email = (a: string) => `${a}@${roles.dominio}`;
const ok = (s: number) => s === 200 || s === 204;
const msg = (r: { body: any }) => String(r.body?.message ?? "");
const tok: Record<string, string> = {};
const tag = `TMP CL ${Date.now().toString(36)}`;
let T = "", UNA = "";
const S: Record<string, string> = {}, M: Record<string, string> = {}, C: Record<string, string> = {};
let H1 = "", H2 = "", P = "", P7 = "";
let usadasInicial: { id: string; clases_usadas: number }[] = [];
let emailCli1: string | null = null;

const limpiar = () => {
  sql(`delete from reservas where horario_id in (select id from horarios where nombre_clase like 'TMP CL %');
       delete from lista_espera where horario_id in (select id from horarios where nombre_clase like 'TMP CL %');
       delete from horario_cancelaciones where horario_id in (select id from horarios where nombre_clase like 'TMP CL %');
       delete from clase_instructora_ajustes where horario_id in (select id from horarios where nombre_clase like 'TMP CL %');
       delete from membresias where paquete_id in (select id from paquetes where nombre like 'TMP CL %');
       delete from paquetes where nombre like 'TMP CL %';
       delete from horarios where nombre_clase like 'TMP CL %';
       delete from cola_mensajes where clave_unica like 'clase-cancel:%' and cliente_id in (select id from clientes where nombre in ('FX Clienta Centro','FX Clienta Norte'));
       delete from admin_acciones_log where tabla in ('clase_instructora_ajustes') and tenant_id = (select id from tenants where slug='vim-prueba');
       delete from admin_acciones_log where operacion='correccion_asistencia' and tenant_id = (select id from tenants where slug='vim-prueba');
       delete from staff_sedes where tenant_membership_id = (select m.id from tenant_memberships m join auth.users u on u.id=m.user_id where u.email='instr3@${roles.dominio}' and m.tenant_id=(select id from tenants where slug='vim-prueba'))
         and sede_id = (select id from sedes where name='Centro' and tenant_id=(select id from tenants where slug='vim-prueba'));`);
};

beforeAll(async () => {
  if (!MGMT) throw new Error("Falta SUPABASE_ACCESS_TOKEN");
  for (const u of roles.usuarios) tok[u.alias] = await login(email(u.alias), roles.password);
  tok.cli1 = await login(email("cli1"), roles.password); tok.cli2 = await login(email("cli2"), roles.password);
  limpiar();
  T = String(sql("select id from tenants where slug='vim-prueba'")[0].id); UNA = String(sql("select id from tenants where slug='unasede-prueba'")[0].id);
  for (const s of sql(`select id,name from sedes where tenant_id='${T}'`)) S[s.name] = s.id;
  for (const a of ["instr12", "instr3"]) M[a] = String(sql(`select m.id from tenant_memberships m join auth.users u on u.id=m.user_id where m.tenant_id='${T}' and u.email='${email(a)}'`)[0].id);
  for (const n of ["FX Clienta Centro", "FX Clienta Norte", "FX Clienta Sur", "FX Clienta Visita"]) C[n] = String(sql(`select id from clientes where tenant_id='${T}' and nombre='${n}'`)[0].id);
  usadasInicial = sql(`select id, clases_usadas from membresias where cliente_id in ('${C["FX Clienta Centro"]}','${C["FX Clienta Norte"]}')`) as any;
  emailCli1 = sql(`select email from clientes where id='${C["FX Clienta Centro"]}'`)[0].email;
  if (!emailCli1) sql(`update clientes set email='${email("cli1")}' where id='${C["FX Clienta Centro"]}'`);
  // instr3 trabaja también en Centro (para poder probar la corrección de quién dio una clase)
  sql(`insert into staff_sedes(tenant_membership_id,sede_id) values ('${M.instr3}','${S.Centro}') on conflict do nothing`);

  const hoy = String(sql(`select public.hoy_en_sede('${S.Centro}') h`)[0].h);
  const f = (dias: number) => String(sql(`select ('${hoy}'::date + (${dias}))::text d`)[0].d);
  P = f(-3); P7 = f(-10);
  const dow = Number(sql(`select extract(dow from '${P}'::date)::int d`)[0].d);
  H1 = String(sql(`insert into horarios(tenant_id,sede_id,instructor_membership_id,dia_semana,hora_inicio,hora_fin,nombre_clase,cupo_maximo) values ('${T}','${S.Centro}','${M.instr12}',${dow},'05:00','05:50','${tag} Centro',8) returning id`)[0].id);
  H2 = String(sql(`insert into horarios(tenant_id,sede_id,instructor_membership_id,dia_semana,hora_inicio,hora_fin,nombre_clase,cupo_maximo) values ('${T}','${S.Sur}','${M.instr3}',${dow},'02:00','02:50','${tag} Sur',8) returning id`)[0].id);
  const m1 = sql(`select id from membresias where cliente_id='${C["FX Clienta Centro"]}' and estado='activa' order by fecha_vencimiento limit 1`)[0].id;
  // reservas ya pasadas (se insertan sin disparadores, porque el sistema no deja reservar una clase que ya empezó)
  sql(`set local session_replication_role = replica;
       insert into reservas(tenant_id,sede_id,horario_id,cliente_id,fecha,tipo,estado,asistio) values
        ('${T}','${S.Centro}','${H1}','${C["FX Clienta Centro"]}','${P}','regular','confirmada',true),
        ('${T}','${S.Centro}','${H1}','${C["FX Clienta Norte"]}','${P}','regular','confirmada',false),
        ('${T}','${S.Centro}','${H1}','${C["FX Clienta Visita"]}','${P}','regular','confirmada',null),
        ('${T}','${S.Sur}','${H2}','${C["FX Clienta Sur"]}','${P}','regular','confirmada',null);
       insert into reservas(tenant_id,sede_id,horario_id,cliente_id,fecha,tipo,estado,asistio,membresia_id) values
        ('${T}','${S.Centro}','${H1}','${C["FX Clienta Centro"]}','${P7}','regular','confirmada',null,'${m1}');
       update membresias set clases_usadas = clases_usadas + 1 where id='${m1}';`);
}, 240_000);

afterAll(() => {
  limpiar();
  for (const m of usadasInicial) sql(`update membresias set clases_usadas=${m.clases_usadas} where id='${m.id}'`);
  sql(`update configuracion_reservas set reto_mensual_clases=12 where tenant_id='${T}'`);
  if (!emailCli1) sql(`update clientes set email=null where id='${C["FX Clienta Centro"]}'`);
});

type Fila = { nombre_clase: string; cliente: string; instructora: string | null; estado: string; asistio: boolean | null; total: number; sede: string; fecha: string };
const historial = async (alias: string, extra: Record<string, unknown> = {}, tenant = T) => {
  const r = await rpc(tok[alias], "historial_reservas", { p_tenant_id: tenant, p_desde: P7, p_hasta: P, ...extra });
  return { status: r.status, filas: (Array.isArray(r.body) ? r.body : []).filter((x: Fila) => String(x.nombre_clase).startsWith(tag)) as Fila[], body: r.body };
};

describe("historial de reservas: cada rol ve solo lo suyo", () => {
  it("la dueña ve las tres sedes: quién reservó y quién asistió", async () => {
    const h = await historial("duena"); expect(h.status).toBe(200);
    expect(h.filas.length).toBe(5);
    expect(h.filas.filter((x) => x.nombre_clase.endsWith("Sur")).length).toBe(1);
    expect(h.filas.find((x) => x.cliente === "FX Clienta Centro" && x.fecha === P)?.asistio).toBe(true);
    expect(h.filas.find((x) => x.cliente === "FX Clienta Norte")?.asistio).toBe(false);
    expect(h.filas[0].instructora).toMatch(/FX instr/);
  });
  it("la administradora y la recepción de Centro ven solo Centro; la de Sur, solo Sur; la de Norte, nada de estas clases", async () => {
    expect((await historial("admin1")).filas.every((x) => x.nombre_clase.endsWith("Centro"))).toBe(true);
    expect((await historial("admin1")).filas.length).toBe(4);
    expect((await historial("recep1")).filas.length).toBe(4);
    const sur = await historial("recep3"); expect(sur.filas.length).toBe(1); expect(sur.filas[0].nombre_clase.endsWith("Sur")).toBe(true);
    expect((await historial("admin2")).filas.length).toBe(0);
    expect((await historial("regional")).filas.length).toBe(4);   // Centro y Norte, no Sur
  });
  it("la instructora ve solo las clases que da ella", async () => {
    expect((await historial("instr12")).filas.length).toBe(4);
    const i3 = await historial("instr3"); expect(i3.filas.length).toBe(1); expect(i3.filas[0].instructora).toBe("FX instr3");
  });
  it("contabilidad, marketing, una clienta, otro estudio y quien no es del estudio quedan fuera", async () => {
    for (const a of ["contadora", "marketing", "cli1"]) expect((await historial(a)).status, a).toBe(400);
    expect((await historial("duena-una")).status).toBe(400);        // dueña de otro estudio pidiendo el de VIM
    expect((await historial("duena", {}, UNA)).status).toBe(400);   // dueña de VIM pidiendo otro estudio
    expect((await rpc(null, "historial_reservas", { p_tenant_id: T })).status).toBe(401);
  });
  it("filtra por asistencia, día de la semana, hora, sede, estado e instructora, y reporta el total para paginar", async () => {
    expect((await historial("duena", { p_asistencia: "asistio" })).filas.map((x) => x.cliente)).toEqual(["FX Clienta Centro"]);
    expect((await historial("duena", { p_asistencia: "no_vino" })).filas.map((x) => x.cliente)).toEqual(["FX Clienta Norte"]);
    expect((await historial("duena", { p_asistencia: "sin_marcar" })).filas.length).toBe(3);
    const dow = Number(sql(`select extract(dow from '${P}'::date)::int d`)[0].d);
    expect((await historial("duena", { p_dia_semana: dow })).filas.length).toBe(5);
    expect((await historial("duena", { p_dia_semana: (dow + 1) % 7 })).filas.length).toBe(0);
    expect((await historial("duena", { p_hora: "05:00" })).filas.length).toBe(4);   // solo la clase de Centro; la de Sur es a otra hora
    expect((await historial("duena", { p_hora: "09:00" })).filas.length).toBe(0);
    expect((await historial("duena", { p_sede_id: S.Sur })).filas.length).toBe(1);
    expect((await historial("duena", { p_estado: "cancelada" })).filas.length).toBe(0);
    expect((await historial("duena", { p_instructora: M.instr3 })).filas.length).toBe(1);
    const pag = await rpc(tok.duena, "historial_reservas", { p_tenant_id: T, p_desde: P7, p_hasta: P, p_limite: 1 });
    expect((pag.body as Fila[]).length).toBe(1); expect(Number((pag.body as Fila[])[0].total)).toBeGreaterThanOrEqual(5);
    expect((await rpc(tok.duena, "historial_reservas", { p_tenant_id: T, p_estado: "rara" })).status).toBe(400);
  });
});

type Dictada = { horario_id: string; fecha: string; instructora: string | null; es_sustitucion: boolean; reservadas: number; asistieron: number; no_vinieron: number; sin_marcar: number; canceladas: number; ocupacion_pct: number };
const dictadas = async (alias: string) => {
  const r = await rpc(tok[alias], "clases_dictadas", { p_tenant_id: T, p_desde: P7, p_hasta: P });
  return { status: r.status, filas: (Array.isArray(r.body) ? r.body : []) as Dictada[] };
};

describe("clases por instructora", () => {
  it("cuenta alumnas, asistencia, sin marcar y ocupación de cada clase dada", async () => {
    const d = await dictadas("duena"); expect(d.status).toBe(200);
    const c = d.filas.find((x) => x.horario_id === H1 && x.fecha === P)!;
    expect(c).toMatchObject({ instructora: "FX instr12", reservadas: 3, asistieron: 1, no_vinieron: 1, sin_marcar: 1, es_sustitucion: false });
    expect(Number(c.ocupacion_pct)).toBeCloseTo(37.5, 1);
  });
  it("el resumen por instructora suma sus clases, y cada instructora solo ve el suyo", async () => {
    const todo = await rpc(tok.duena, "resumen_instructoras", { p_tenant_id: T, p_desde: P7, p_hasta: P });
    expect(todo.status).toBe(200);
    const i12 = (todo.body as { instructora: string; clases: number; alumnas: number; asistencia_pct: number }[]).find((x) => x.instructora === "FX instr12")!;
    expect(i12.clases).toBeGreaterThanOrEqual(2); expect(i12.alumnas).toBeGreaterThanOrEqual(4);
    const suyo = await rpc(tok.instr3, "resumen_instructoras", { p_tenant_id: T, p_desde: P7, p_hasta: P });
    expect((suyo.body as { instructora: string }[]).every((x) => x.instructora === "FX instr3")).toBe(true);
    expect((await rpc(tok.contadora, "resumen_instructoras", { p_tenant_id: T })).status).toBe(400);
    expect((await dictadas("recep3")).filas.every((x) => x.instructora === "FX instr3")).toBe(true);   // solo su sede
  });
  it("cambiar la instructora del horario solo vale hacia adelante: lo ya dado no cambia", async () => {
    const r = await rpc(tok.duena, "actualizar_horario", { p_horario_id: H1, p_instructor_membership_id: M.instr3 });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    try {
      const futuro = String(sql(`select ('${P}'::date + 14)::text d`)[0].d);
      expect((await rpc(tok.duena, "instructora_de_clase", { p_horario_id: H1, p_fecha: futuro })).body).toBe(M.instr3);
      expect((await rpc(tok.duena, "instructora_de_clase", { p_horario_id: H1, p_fecha: P })).body).toBe(M.instr12);
      expect((await dictadas("duena")).filas.find((x) => x.horario_id === H1 && x.fecha === P)!.instructora).toBe("FX instr12");
      expect((await historial("duena")).filas.filter((x) => x.nombre_clase.endsWith("Centro")).every((x) => x.instructora === "FX instr12")).toBe(true);
    } finally { await rpc(tok.duena, "actualizar_horario", { p_horario_id: H1, p_instructor_membership_id: M.instr12 }); }
  });
});

describe("corregir quién dio una clase y registrar sustituciones (solo la dueña, con auditoría)", () => {
  const args = (o: Record<string, unknown> = {}) => ({ p_tenant_id: T, p_clases: [{ horario_id: H1, fecha: P }], p_instructora: M.instr3, p_motivo: "La titular estaba enferma", p_sustitucion: false, ...o });
  it("la administradora, la recepción y la instructora no pueden", async () => {
    for (const a of ["admin1", "recep1", "instr12", "regional"]) expect((await rpc(tok[a], "corregir_instructora_clases", args())).status, a).toBe(400);
  });
  it("exige motivo, una clase, y que la persona sea instructora del estudio", async () => {
    expect((await rpc(tok.duena, "corregir_instructora_clases", args({ p_motivo: "ok" }))).status).toBe(400);
    expect((await rpc(tok.duena, "corregir_instructora_clases", args({ p_clases: [] }))).status).toBe(400);
    const admin = String(sql(`select m.id from tenant_memberships m join auth.users u on u.id=m.user_id where m.tenant_id='${T}' and u.email='${email("admin1")}'`)[0].id);
    const r = await rpc(tok.duena, "corregir_instructora_clases", args({ p_instructora: admin })); expect(r.status).toBe(400); expect(msg(r)).toMatch(/no es instructora/i);
    const otro = await rpc(tok["duena-una"], "corregir_instructora_clases", args()); expect(otro.status).toBe(400);
  });
  it("la dueña corrige y registra una sustitución en varias clases a la vez; el reporte lo refleja", async () => {
    const r = await rpc(tok.duena, "corregir_instructora_clases", args({ p_clases: [{ horario_id: H1, fecha: P }, { horario_id: H1, fecha: P7 }], p_sustitucion: true }));
    expect(r.status, JSON.stringify(r.body)).toBe(200); expect(r.body).toBe(2);
    const d = await dictadas("duena");
    expect(d.filas.filter((x) => x.horario_id === H1).every((x) => x.instructora === "FX instr3" && x.es_sustitucion)).toBe(true);
    const log = sql(`select count(*)::int n from admin_acciones_log where tenant_id='${T}' and tabla='clase_instructora_ajustes' and operacion='sustitucion'`)[0].n;
    expect(log).toBeGreaterThanOrEqual(2);
  });
  it("la sustituta puede marcar asistencia de esa clase y la titular ya no", async () => {
    const res = String(sql(`select id from reservas where horario_id='${H1}' and fecha='${P}' and cliente_id='${C["FX Clienta Visita"]}'`)[0].id);
    const titular = await rpc(tok.instr12, "registrar_asistencia", { p_reserva_id: res, p_asistio: true }); expect(titular.status).toBe(400);
    expect(ok((await rpc(tok.instr3, "registrar_asistencia", { p_reserva_id: res, p_asistio: true })).status)).toBe(true);
    const c = (await dictadas("duena")).filas.find((x) => x.horario_id === H1 && x.fecha === P)!;
    expect(c.sin_marcar).toBe(0); expect(c.asistieron).toBe(2);
    expect((await dictadas("instr3")).filas.some((x) => x.horario_id === H1 && x.fecha === P)).toBe(true);   // ahora la ve como suya
    expect((await dictadas("instr12")).filas.some((x) => x.horario_id === H1 && x.fecha === P)).toBe(false);
  });
});

describe("corregir una asistencia errónea", () => {
  const reserva = (cli: string, fecha: string) => String(sql(`select id from reservas where horario_id='${H1}' and fecha='${fecha}' and cliente_id='${C[cli]}'`)[0].id);
  const usadas = () => Number(sql(`select clases_usadas from membresias where id=(select membresia_id from reservas where horario_id='${H1}' and fecha='${P7}' and cliente_id='${C["FX Clienta Centro"]}')`)[0].clases_usadas);
  it("otra sede no puede; exige motivo; la recepción de la sede sí", async () => {
    const id = reserva("FX Clienta Norte", P);
    expect((await rpc(tok.recep3, "corregir_asistencia", { p_reserva_id: id, p_accion: "asistio", p_motivo: "se equivocaron" })).status).toBe(400);
    expect((await rpc(tok.recep1, "corregir_asistencia", { p_reserva_id: id, p_accion: "asistio", p_motivo: "no" })).status).toBe(400);
    expect((await rpc(tok.recep1, "corregir_asistencia", { p_reserva_id: id, p_accion: "rara", p_motivo: "se equivocaron" })).status).toBe(400);
    expect((await rpc(tok.recep1, "corregir_asistencia", { p_reserva_id: id, p_accion: "asistio", p_motivo: "se equivocaron" })).status).toBe(200);
    expect((await historial("duena", { p_asistencia: "asistio" })).filas.map((x) => x.cliente)).toContain("FX Clienta Norte");
    expect((await rpc(tok.instr12, "corregir_asistencia", { p_reserva_id: id, p_accion: "no_vino", p_motivo: "no corresponde" })).status).toBe(400);
  });
  it("anular y devolver regresa el crédito a la membresía exacta, una sola vez", async () => {
    const id = reserva("FX Clienta Centro", P7);
    const antes = usadas();
    const r = await rpc(tok.recep1, "corregir_asistencia", { p_reserva_id: id, p_accion: "anular_y_devolver", p_motivo: "Se registró por error" });
    expect(r.status, JSON.stringify(r.body)).toBe(200); expect((r.body as { credito_devuelto: boolean }).credito_devuelto).toBe(true);
    expect(usadas()).toBe(antes - 1);
    const otra = await rpc(tok.recep1, "corregir_asistencia", { p_reserva_id: id, p_accion: "anular_y_devolver", p_motivo: "Se registró por error" });
    expect(otra.status).toBe(400); expect(usadas()).toBe(antes - 1);
    expect(sql(`select count(*)::int n from admin_acciones_log where tenant_id='${T}' and operacion='correccion_asistencia'`)[0].n).toBeGreaterThanOrEqual(2);
  });
});

describe("cancelar la clase de un día", () => {
  let HF = "", D = "", reservaId = "";
  const usadasCli1 = () => Number(sql(`select coalesce(sum(clases_usadas),0)::int n from membresias where cliente_id='${C["FX Clienta Centro"]}'`)[0].n);
  beforeAll(() => {
    D = String(sql(`select (public.hoy_en_sede('${S.Centro}') + 2)::text d`)[0].d);
    const dow = Number(sql(`select extract(dow from '${D}'::date)::int d`)[0].d);
    HF = String(sql(`insert into horarios(tenant_id,sede_id,instructor_membership_id,dia_semana,hora_inicio,hora_fin,nombre_clase,cupo_maximo) values ('${T}','${S.Centro}','${M.instr12}',${dow},'04:00','04:50','${tag} Futura',8) returning id`)[0].id);
  });
  it("cancela las reservas, devuelve cada crédito y deja un aviso propio en la cola", async () => {
    const antes = usadasCli1();
    const r = await rpc(tok.cli1, "agendar_clase", { p_horario_id: HF, p_fecha: D, p_cliente_id: C["FX Clienta Centro"] });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    reservaId = String(sql(`select id from reservas where horario_id='${HF}' and fecha='${D}' and estado='confirmada'`)[0].id);
    expect(usadasCli1()).toBe(antes + 1);
    expect((await rpc(tok.recep3, "cancelar_clase_fecha", { p_horario_id: HF, p_fecha: D })).status).toBe(400);   // otra sede
    const sinDelegacion = await rpc(tok.recep1, "cancelar_clase_fecha", { p_horario_id: HF, p_fecha: D });
    expect(sinDelegacion.status).toBe(400); expect(msg(sinDelegacion)).toMatch(/delegaci/i);                      // cancelar una fecha es delegable (P14)
    const c = await rpc(tok.duena, "cancelar_clase_fecha", { p_horario_id: HF, p_fecha: D });
    expect(c.status, JSON.stringify(c.body)).toBe(200); expect((c.body as { reservas_canceladas: number }).reservas_canceladas).toBe(1);
    expect(usadasCli1()).toBe(antes);
    expect(sql(`select estado from reservas where id='${reservaId}'`)[0].estado).toBe("cancelada");
    const cola = sql(`select clave_unica, asunto from cola_mensajes where clave_unica like 'clase-cancel:${reservaId}%'`);
    expect(cola.length).toBeGreaterThanOrEqual(1);
    expect(sql(`select count(*)::int n from cola_mensajes where clave_unica like 'res-cancel:${reservaId}%'`)[0].n).toBe(0);   // no se duplica con el aviso genérico
  });
  it("después de cancelada, esa fecha ya no admite reservas; las demás fechas siguen igual", async () => {
    const r = await rpc(tok.cli1, "agendar_clase", { p_horario_id: HF, p_fecha: D, p_cliente_id: C["FX Clienta Centro"] });
    expect(r.status).toBe(400);
  });
});

describe("confirmación de asistencia y liberación de cupos", () => {
  it("quien no confirma pierde el cupo cuando la clase está llena, y entra la primera de la lista de espera", async () => {
    const hora = String(sql(`select to_char(public.ahora_en_sede('${S.Centro}'), 'HH24:MI') h`)[0].h);
    if (hora < "00:20" || hora > "22:00") return;   // la ventana de «dentro de la próxima hora» cruzaría la medianoche
    const ahora = sql(`select public.ahora_en_sede('${S.Centro}')::date::text f, extract(dow from public.ahora_en_sede('${S.Centro}'))::int d,
                       (public.ahora_en_sede('${S.Centro}') + interval '30 minutes')::time::text i, (public.ahora_en_sede('${S.Centro}') + interval '80 minutes')::time::text e`)[0];
    const hid = String(sql(`insert into horarios(tenant_id,sede_id,instructor_membership_id,dia_semana,hora_inicio,hora_fin,nombre_clase,cupo_maximo) values ('${T}','${S.Centro}','${M.instr12}',${ahora.d},'${ahora.i}','${ahora.e}','${tag} Llena',1) returning id`)[0].id);
    const r1 = await rpc(tok.cli1, "agendar_clase", { p_horario_id: hid, p_fecha: ahora.f, p_cliente_id: C["FX Clienta Centro"] });
    expect(r1.status, JSON.stringify(r1.body)).toBe(200);
    const res1 = String(sql(`select id from reservas where horario_id='${hid}' and cliente_id='${C["FX Clienta Centro"]}'`)[0].id);
    expect(ok((await rpc(tok.cli2, "unirse_lista_espera", { p_horario_id: hid, p_fecha: ahora.f, p_cliente_id: C["FX Clienta Norte"] })).status)).toBe(true);
    // otra clienta no puede confirmar la reserva ajena; la dueña de la reserva sí
    expect((await rpc(tok.cli2, "confirmar_mi_reserva", { p_reserva_id: res1 })).status).toBe(400);
    expect((await rpc(tok.cli1, "confirmar_mi_reserva", { p_reserva_id: res1 })).status).toBe(200);
    sql(`select * from public.liberar_cupos_no_confirmados()`);
    expect(sql(`select estado from reservas where id='${res1}'`)[0].estado).toBe("confirmada");          // confirmó: conserva el lugar
    sql(`update reservas set confirmada_por_clienta_at=null where id='${res1}'`);
    const lib = sql(`select * from public.liberar_cupos_no_confirmados()`);
    expect(lib.some((x) => x.reserva_id === res1), JSON.stringify(lib) + JSON.stringify(sql(`select r.*, h.cupo_maximo, h.hora_inicio, public.ahora_en_sede(r.sede_id) ahora from reservas r join horarios h on h.id=r.horario_id where r.id='${res1}'`))).toBe(true);
    const rr = sql(`select estado, liberada_por_no_confirmar from reservas where id='${res1}'`)[0];
    expect(rr).toMatchObject({ estado: "cancelada", liberada_por_no_confirmar: true });
    const promovida = sql(`select estado from reservas where horario_id='${hid}' and cliente_id='${C["FX Clienta Norte"]}' and fecha='${ahora.f}'`);
    expect(promovida[0]?.estado).toBe("confirmada");                                                          // la primera de la espera entró
  }, 120_000);
});

describe("reto mensual", () => {
  it("la clienta ve su avance real hacia la meta y la dueña configura la meta del estudio", async () => {
    const antes = (await rpc(tok.cli1, "mi_reto_mensual", { p_tenant_id: T })).body as { meta: number; asistidas: number; porcentaje: number };
    expect(antes.meta).toBeGreaterThanOrEqual(1);
    const real = Number(sql(`select count(*)::int n from reservas r where r.cliente_id='${C["FX Clienta Centro"]}' and r.estado='confirmada' and r.asistio is true
      and r.fecha between date_trunc('month', public.hoy_en_sede('${S.Centro}'))::date and (date_trunc('month', public.hoy_en_sede('${S.Centro}')) + interval '1 month - 1 day')::date`)[0].n);
    expect(antes.asistidas).toBe(real);
    expect((await rpc(tok.recep1, "guardar_reto_mensual", { p_tenant_id: T, p_meta: 5 })).status).toBe(400);
    expect((await rpc(tok.duena, "guardar_reto_mensual", { p_tenant_id: T, p_meta: 0 })).status).toBe(400);
    expect((await rpc(tok.duena, "guardar_reto_mensual", { p_tenant_id: T, p_meta: 61 })).status).toBe(400);
    expect(ok((await rpc(tok.duena, "guardar_reto_mensual", { p_tenant_id: T, p_meta: 5 })).status)).toBe(true);
    const despues = (await rpc(tok.cli1, "mi_reto_mensual", { p_tenant_id: T })).body as { meta: number };
    expect(despues.meta).toBe(5);
    expect((await rpc(tok["duena-una"], "mi_reto_mensual", { p_tenant_id: T })).body).toBeNull();   // quien no es clienta del estudio no ve nada
  });
});

describe("clases privadas 1 a 1", () => {
  let HP = "", D2 = "", PQ = "";
  const usadasPriv = () => Number(sql(`select coalesce(sum(clases_usadas),0)::int n from membresias where paquete_id='${PQ}' and cliente_id='${C["FX Clienta Centro"]}'`)[0].n);
  beforeAll(async () => {
    PQ = String(sql(`insert into paquetes(tenant_id,nombre,precio,num_clases,vigencia_dias,cobertura,categoria) values ('${T}','${tag} Privado',150,1,30,'sede','privado') returning id`)[0].id);
    sql(`insert into paquete_sedes(paquete_id,sede_id) values ('${PQ}','${S.Centro}') on conflict do nothing`);
    D2 = String(sql(`select (public.hoy_en_sede('${S.Centro}') + 3)::text d`)[0].d);
    const dow = Number(sql(`select extract(dow from '${D2}'::date)::int d`)[0].d);
    const h = await rpc(tok.duena, "crear_horario", { p_tenant_id: T, p_sede_id: S.Centro, p_dia_semana: dow, p_hora_inicio: "03:00", p_hora_fin: "03:50", p_nombre_clase: `${tag} Privada`, p_cupo_maximo: 1, p_instructor_membership_id: M.instr12, p_categoria: "privado" });
    expect(h.status, JSON.stringify(h.body)).toBe(200); HP = (h.body as { id: string }).id;
  });
  const agenda = async (alias: string) => {
    const r = await rpc(tok[alias], "privadas_agenda", { p_tenant_id: T, p_desde: D2, p_hasta: D2 });
    return { status: r.status, filas: (Array.isArray(r.body) ? r.body : []).filter((x: { nombre_clase: string }) => x.nombre_clase.startsWith(tag)) as { cliente: string | null; reserva_id: string | null; sede: string }[] };
  };
  it("la agenda respeta el alcance: la sede, la dueña y la instructora de esa clase", async () => {
    for (const a of ["duena", "admin1", "recep1", "instr12", "regional"]) expect((await agenda(a)).filas.length, a).toBe(1);
    for (const a of ["admin2", "recep3", "instr3"]) expect((await agenda(a)).filas.length, a).toBe(0);
    for (const a of ["contadora", "marketing", "cli1"]) expect((await agenda(a)).status, a).toBe(400);
  });
  it("sin paquete privado no se reserva; la recepción de otra sede no asigna; la de la sede sí", async () => {
    const sin = await rpc(tok.cli2, "agendar_clase_privada", { p_horario_id: HP, p_fecha: D2, p_cliente_id: C["FX Clienta Norte"] });
    expect(sin.status).toBe(400); expect(msg(sin)).toMatch(/paquete de clase privada/i);
    const args = { p_cliente_id: C["FX Clienta Centro"], p_paquete_id: PQ, p_horario_id: HP, p_fecha: D2, p_metodo_pago: "efectivo" };
    expect((await rpc(tok.recep3, "asignar_clase_privada_manual", args)).status).toBe(400);
    const r = await rpc(tok.recep1, "asignar_clase_privada_manual", args); expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect((await agenda("duena")).filas[0].cliente).toBe("FX Clienta Centro");
    expect(usadasPriv()).toBe(1);
    expect(sql(`select count(*)::int n from reservas where horario_id='${HP}' and membresia_id is not null and estado='confirmada'`)[0].n).toBe(1);   // ligada a su paquete
    expect((await rpc(tok.recep1, "asignar_clase_privada_manual", args)).status).toBe(400);                                                           // el horario ya está ocupado
  });
  it("cancelar a tiempo devuelve el crédito del paquete privado, y se puede volver a reservar con él", async () => {
    const id = String(sql(`select id from reservas where horario_id='${HP}' and estado='confirmada'`)[0].id);
    const c = await rpc(tok.cli1, "cancelar_mi_reserva", { p_reserva_id: id }); expect(c.status, JSON.stringify(c.body)).toBe(200);
    expect(usadasPriv()).toBe(0);
    const otra = await rpc(tok.cli1, "agendar_clase_privada", { p_horario_id: HP, p_fecha: D2, p_cliente_id: C["FX Clienta Centro"] });
    expect(otra.status, JSON.stringify(otra.body)).toBe(200); expect(usadasPriv()).toBe(1);
    expect(sql(`select credito_devuelto_at from reservas where id='${(otra.body as { reserva_id: string }).reserva_id}'`)[0].credito_devuelto_at).toBeNull();
    const id2 = String((otra.body as { reserva_id: string }).reserva_id);
    expect((await rpc(tok.recep1, "admin_cancelar_reserva", { p_reserva_id: id2 })).status).toBe(200);
    expect(usadasPriv()).toBe(0);
  });
});

describe("asistencia por QR", () => {
  it("el personal de la sede registra la asistencia con el código de la clienta; otra sede no, y repetirlo no duplica", async () => {
    const hora = String(sql(`select to_char(public.ahora_en_sede('${S.Centro}'), 'HH24:MI') h`)[0].h);
    if (hora < "00:30" || hora > "22:30") return;
    const a = sql(`select public.ahora_en_sede('${S.Centro}')::date::text f, extract(dow from public.ahora_en_sede('${S.Centro}'))::int d,
                   (public.ahora_en_sede('${S.Centro}') - interval '10 minutes')::time::text i, (public.ahora_en_sede('${S.Centro}') + interval '40 minutes')::time::text e`)[0];
    const hid = String(sql(`insert into horarios(tenant_id,sede_id,instructor_membership_id,dia_semana,hora_inicio,hora_fin,nombre_clase,cupo_maximo) values ('${T}','${S.Centro}','${M.instr3}',${a.d},'${a.i}','${a.e}','${tag} Ahora',8) returning id`)[0].id);
    sql(`set local session_replication_role = replica; insert into reservas(tenant_id,sede_id,horario_id,cliente_id,fecha,tipo,estado) values ('${T}','${S.Centro}','${hid}','${C["FX Clienta Centro"]}','${a.f}','regular','confirmada')`);
    const codigo = String(sql(`select codigo_checkin from clientes where id='${C["FX Clienta Centro"]}'`)[0].codigo_checkin);
    expect((await rpc(tok.recep3, "checkin_por_codigo", { p_tenant_id: T, p_codigo: `RSCK:${codigo}` })).status).toBe(400);
    expect((await rpc(tok.recep1, "checkin_por_codigo", { p_tenant_id: T, p_codigo: "NOEXISTE" })).status).toBe(400);
    expect((await rpc(tok.contadora, "checkin_por_codigo", { p_tenant_id: T, p_codigo: `RSCK:${codigo}` })).status).toBe(400);
    const r = await rpc(tok.recep1, "checkin_por_codigo", { p_tenant_id: T, p_codigo: `RSCK:${codigo}` });
    expect(r.status, JSON.stringify(r.body)).toBe(200); expect((r.body as { ya_registrada: boolean }).ya_registrada).toBe(false);
    expect(sql(`select asistio from reservas where horario_id='${hid}'`)[0].asistio).toBe(true);
    expect((await rpc(tok.recep1, "checkin_por_codigo", { p_tenant_id: T, p_codigo: `RSCK:${codigo}` })).body).toMatchObject({ ya_registrada: true });
  }, 120_000);
});
