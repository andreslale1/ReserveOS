// CONSOLA OWNER · ESTUDIOS (O-01, O-02, O-06, O-11) sobre datos reales por API directa, con una sesión por rol de plataforma.
// Usa un estudio fixture propio (owner-estados-prueba, tipo interno) que se reinicia en cada corrida; los usuarios temporales se borran. Requiere SUPABASE_ACCESS_TOKEN.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { consulta } from "./escenarios/concurrencia.mjs";
import { ANON_KEY, SUPABASE_URL, login, rpc, selectFrom } from "./helpers";

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN!, REF = process.env.SUPABASE_PROJECT_REF ?? "agkqppuhyltirrhngybq";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sql = (q: string) => consulta(TOKEN, REF, q) as Record<string, any>[];
const run = Date.now().toString(36), PASS = "TmpOwner2026!", slug = "owner-estados-prueba";
const mail = (a: string) => `tmp-${a}-${run}@owner-prueba.test`;
const tok: Record<string, string> = {}, uid: Record<string, string> = {};
let T = "", TICKET = "", TICKET_AJENO = "";

// El registro de auditoría referencia a quien actuó: se desvincula el actor de las filas de PRUEBA antes de borrar sus usuarios.
function limpiarUsuarios() {
  const ids = sql(`select id from auth.users where email like 'tmp-%@owner-prueba.test'`).map((x) => `'${x.id}'`);
  if (!ids.length) return;
  sql(`update admin_acciones_log set actor_id=null where actor_id in (${ids.join(",")}); delete from plataforma_staff where user_id in (${ids.join(",")}); delete from auth.users where id in (${ids.join(",")})`);
}
async function crearUsuario(alias: string) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, { method: "POST", headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" }, body: JSON.stringify({ email: mail(alias), password: PASS, email_confirm: true }) });
  const j = await r.json(); expect(r.ok, JSON.stringify(j)).toBe(true); uid[alias] = j.id;
}
const msg = (r: { body: any }) => String(r.body?.message ?? "");
const estado = (s: string, motivo?: string, t = tok.operador) => rpc(t, "cambiar_estado_tenant_plataforma", { p_tenant_id: T, p_status: s, p_motivo: motivo ?? null });
const nuevoPaquete = (n: string) => rpc(tok.duena, "crear_paquete", { p_tenant_id: T, p_nombre: n, p_precio: 10, p_vigencia_dias: 30, p_num_clases: 4 });
const nuevaClienta = (n: string) => rpc(tok.duena, "crear_cliente", { p_tenant_id: T, p_nombre: n, p_telefono: String(Math.floor(Math.random() * 9e8) + 1e9) });

beforeAll(async () => {
  expect(TOKEN, "falta SUPABASE_ACCESS_TOKEN").toBeTruthy();
  limpiarUsuarios();   // restos de corridas anteriores
  for (const a of ["operador", "ventas", "soporte", "duena"]) await crearUsuario(a);
  sql(`insert into plataforma_staff(user_id,nombre,rol) values ('${uid.operador}','TMP oe operador','operador'),('${uid.ventas}','TMP oe ventas','ventas'),('${uid.soporte}','TMP oe soporte','soporte')`);
  sql(`insert into tenants(slug,name,tipo) values ('${slug}','Owner Estados (fixture de pruebas)','interno') on conflict (slug) do nothing`);
  T = sql(`select id from tenants where slug='${slug}'`)[0].id;
  sql(`update tenants set status='activo', tipo='interno', estado_motivo=null where id='${T}'`);
  sql(`delete from admin_acciones_log where tenant_id='${T}'; delete from tenant_estado_historial where tenant_id='${T}'; delete from acceso_excepcional_tenant where tenant_id='${T}'; delete from plataforma_tickets where tenant_id='${T}'; delete from paquetes where tenant_id='${T}'; delete from clientes where tenant_id='${T}'; delete from tenant_memberships where tenant_id='${T}'`);
  sql(`insert into tenant_entitlements(tenant_id,module_key,enabled,reason,effective_at) select '${T}',key,true,'tmp',now() from module_catalog on conflict do nothing`);
  sql(`insert into sedes(tenant_id,name) values ('${T}','Unica') on conflict do nothing`);
  sql(`insert into tenant_memberships(tenant_id,user_id,role,nombre) values ('${T}','${uid.duena}','duena','TMP dueña')`);
  sql(`insert into clientes(tenant_id,nombre,telefono,user_id) values ('${T}','TMP Clienta A','5570000001','${uid.duena}'),('${T}','TMP Clienta B','5570000002',null),('${T}','TMP Clienta C','5570000003',null)`);
  TICKET = sql(`insert into plataforma_tickets(tenant_id,asunto,prioridad,estado,sla_vence) values ('${T}','TMP ticket','normal','abierto',now()+interval '1 day') returning id`)[0].id;
  const ajeno = sql(`select id from tenants where slug='ficticio-a'`)[0].id;
  TICKET_AJENO = sql(`insert into plataforma_tickets(tenant_id,asunto,prioridad,estado,sla_vence) values ('${ajeno}','TMP ticket ajeno','normal','abierto',now()+interval '1 day') returning id`)[0].id;
  for (const a of ["operador", "ventas", "soporte", "duena"]) tok[a] = await login(mail(a), PASS);
}, 60000);

afterAll(async () => {
  sql(`update tenants set status='activo', tipo='interno' where id='${T}'`);
  sql(`delete from plataforma_tickets where id='${TICKET_AJENO}' or tenant_id='${T}'; delete from acceso_excepcional_tenant where tenant_id='${T}'; delete from paquetes where tenant_id='${T}'; delete from clientes where tenant_id='${T}'; delete from tenant_memberships where tenant_id='${T}'`);
  limpiarUsuarios();
  const quedan = sql(`select (select count(*) from plataforma_staff where nombre like 'TMP oe %')::int s, (select count(*) from auth.users where email like 'tmp-%@owner-prueba.test')::int u`)[0];
  expect(quedan).toEqual({ s: 0, u: 0 });
}, 60000);

describe("O-01 · estados reales con bloqueo en la base", () => {
  it("solo el operador cambia el estado; ventas es rechazada", async () => {
    expect(msg(await estado("pausado", "prueba de permisos", tok.ventas))).toMatch(/No autorizado/);
    expect(msg(await estado("pausado", "prueba de permisos", tok.duena))).toMatch(/No autorizado/);
  });
  it("estado inválido, mismo estado y falta de motivo se rechazan", async () => {
    expect(msg(await estado("congelado", "x".repeat(10)))).toMatch(/inválido/);
    expect(msg(await estado("activo"))).toMatch(/ya está/);
    expect(msg(await estado("suspendido"))).toMatch(/motivo/);
    expect(msg(await estado("suspendido", "hey"))).toMatch(/motivo/);
  });
  it("pausado: bloquea altas nuevas pero deja configurar y leer", async () => {
    expect((await estado("pausado", "Pausa por prueba automatizada")).status).toBe(200);
    expect(msg(await nuevaClienta("TMP bloqueada"))).toMatch(/no admite esta operación/);
    expect((await nuevoPaquete("TMP paquete en pausa")).status).toBe(200);
    expect((await selectFrom(tok.duena, "clientes", `?select=nombre&tenant_id=eq.${T}`)).body).toHaveLength(3);
  });
  it("suspendido: bloquea configuración y altas; la dueña sigue leyendo; el operador sí puede operar", async () => {
    expect((await estado("suspendido", "Suspensión por prueba automatizada")).status).toBe(200);
    expect(msg(await nuevoPaquete("TMP paquete suspendido"))).toMatch(/no admite esta operación/);
    expect(msg(await nuevaClienta("TMP bloqueada 2"))).toMatch(/no admite esta operación/);
    const lee = await selectFrom(tok.duena, "paquetes", `?select=nombre&tenant_id=eq.${T}`);
    expect(lee.status).toBe(200); expect((lee.body as unknown[]).length).toBeGreaterThan(0);
    // el operador de la plataforma no queda bloqueado por la suspensión (simulando su sesión en la base)
    const op = sql(`select set_config('request.jwt.claims','{"sub":"${uid.operador}","role":"authenticated"}',true); insert into paquetes(tenant_id,nombre,precio,num_clases,vigencia_dias) values ('${T}','TMP del operador',5,1,30) returning id`);
    expect(JSON.stringify(op)).not.toMatch(/message/);
    const du = sql(`select set_config('request.jwt.claims','{"sub":"${uid.duena}","role":"authenticated"}',true); insert into paquetes(tenant_id,nombre,precio,num_clases,vigencia_dias) values ('${T}','TMP de la dueña',5,1,30) returning id`);
    expect(JSON.stringify(du)).toMatch(/no admite esta operación/);
  });
  it("un visitante sin cuenta tampoco puede dar de alta clientas en un estudio suspendido", async () => {
    const r = await rpc(null, "captar_lead", { p_slug: slug, p_nombre: "TMP lead", p_telefono: "5579999999" });
    expect([400, 401, 403, 404]).toContain(r.status);
  });
  it("reactivar con motivo restablece la operación y todo queda en historial y auditoría", async () => {
    expect((await estado("activo", "Reactivación por prueba")).status).toBe(200);
    expect((await nuevoPaquete("TMP paquete reactivado")).status).toBe(200);
    expect((await nuevaClienta("TMP clienta reactivada")).status).toBe(200);
    const h = await rpc(tok.soporte, "tenant_estado_historial_listar", { p_tenant_id: T });
    expect(h.status).toBe(200);
    expect((h.body as { estado_nuevo: string }[]).map((x) => x.estado_nuevo)).toEqual(["activo", "suspendido", "pausado"]);
    const log = sql(`select detalle->>'a' a, detalle->>'motivo' m from admin_acciones_log where tenant_id='${T}' and tabla='plataforma_tenant_estado' order by created_at`);
    expect(log.map((x) => x.a)).toEqual(["pausado", "suspendido", "activo"]);
    expect(sql(`select estado_motivo from tenants where id='${T}'`)[0].estado_motivo).toBe("Reactivación por prueba");
  });
  it("un estudio suspendido sigue sin afectar a otro estudio", async () => {
    await estado("suspendido", "Suspensión para verificar aislamiento");
    const ajeno = sql(`select status from tenants where slug='ficticio-a'`)[0].status;
    expect(ajeno).toBe("activo");
    await estado("activo", "Reactivación");
  });
});

describe("O-02 · la ficha no expone datos de clientas ni finanzas", () => {
  it("el operador ve metadatos y métricas pero no clientas, teléfonos, ingresos ni gastos", async () => {
    const r = await rpc(tok.operador, "owner_tenant_detalle", { p_tenant_id: T });
    expect(r.status).toBe(200);
    const b = r.body as Record<string, any>;
    expect(Object.keys(b)).not.toContain("clientas");
    expect(Object.keys(b)).not.toContain("ingreso_mes");
    expect(Object.keys(b)).not.toContain("gastos_mes");
    expect(JSON.stringify(b)).not.toMatch(/5570000001|TMP Clienta/);
    expect(b.metricas.clientas_registradas).toBeGreaterThanOrEqual(3);
    expect(b.metricas.clientas_con_acceso).toBe(1);
    expect(b.personal[0].email).toBe(mail("duena"));   // contacto administrativo de la dueña
  });
  it("ventas no puede abrir la ficha; la dueña de un estudio tampoco", async () => {
    expect(msg(await rpc(tok.ventas, "owner_tenant_detalle", { p_tenant_id: T }))).toMatch(/No autorizado/);
    expect(msg(await rpc(tok.duena, "owner_tenant_detalle", { p_tenant_id: T }))).toMatch(/No autorizado/);
  });
  it("sin acceso excepcional las lecturas sensibles fallan, incluso para el operador", async () => {
    expect(msg(await rpc(tok.operador, "owner_tenant_datos_sensibles", { p_tenant_id: T, p_alcance: "clientas" }))).toMatch(/Sin acceso excepcional/);
    expect(msg(await rpc(tok.operador, "owner_tenant_datos_sensibles", { p_tenant_id: T, p_alcance: "finanzas" }))).toMatch(/Sin acceso excepcional/);
  });
  it("otorgar exige rol, ticket abierto del mismo estudio, motivo, alcance y plazo válidos", async () => {
    const base = { p_tenant_id: T, p_ticket_id: TICKET, p_motivo: "Soporte: clienta no puede reservar, revisar su ficha", p_alcance: ["clientas"], p_horas: 2 };
    expect(msg(await rpc(tok.ventas, "acceso_excepcional_otorgar", base))).toMatch(/No autorizado/);
    expect(msg(await rpc(tok.operador, "acceso_excepcional_otorgar", { ...base, p_ticket_id: TICKET_AJENO }))).toMatch(/ticket abierto de este estudio/);
    expect(msg(await rpc(tok.operador, "acceso_excepcional_otorgar", { ...base, p_motivo: "corto" }))).toMatch(/motivo/);
    expect(msg(await rpc(tok.operador, "acceso_excepcional_otorgar", { ...base, p_alcance: ["todo"] }))).toMatch(/Alcance/);
    expect(msg(await rpc(tok.operador, "acceso_excepcional_otorgar", { ...base, p_horas: 500 }))).toMatch(/72 horas/);
  });
  it("con acceso vigente solo se lee el alcance concedido, con paginación acotada, y cada lectura se registra", async () => {
    const o = await rpc(tok.soporte, "acceso_excepcional_otorgar", { p_tenant_id: T, p_ticket_id: TICKET, p_motivo: "Soporte: clienta no puede reservar, revisar su ficha", p_alcance: ["clientas"], p_horas: 2 });
    expect(o.status, JSON.stringify(o.body)).toBe(200);
    const id = o.body as unknown as string;
    const c = await rpc(tok.soporte, "owner_tenant_datos_sensibles", { p_tenant_id: T, p_alcance: "clientas", p_limite: 2 });
    expect(c.status).toBe(200);
    expect((c.body as any).total).toBeGreaterThanOrEqual(3);
    expect((c.body as any).clientas).toHaveLength(2);
    expect(msg(await rpc(tok.soporte, "owner_tenant_datos_sensibles", { p_tenant_id: T, p_alcance: "finanzas" }))).toMatch(/Sin acceso excepcional/);
    // otro usuario de plataforma no hereda el acceso
    expect(msg(await rpc(tok.operador, "owner_tenant_datos_sensibles", { p_tenant_id: T, p_alcance: "clientas" }))).toMatch(/Sin acceso excepcional/);
    expect(sql(`select count(*)::int n from admin_acciones_log where tenant_id='${T}' and tabla='plataforma_acceso_excepcional' and operacion in ('otorgar','lectura')`)[0].n).toBe(2);
    // la dueña del estudio puede ver quién accedió a sus datos
    const aviso = await selectFrom(tok.duena, "acceso_excepcional_tenant", `?select=motivo,alcance&tenant_id=eq.${T}`);
    expect((aviso.body as unknown[]).length).toBe(1);
    // revocar corta el acceso al instante
    expect((await rpc(tok.soporte, "acceso_excepcional_revocar", { p_id: id })).status).toBe(204);
    expect(msg(await rpc(tok.soporte, "owner_tenant_datos_sensibles", { p_tenant_id: T, p_alcance: "clientas" }))).toMatch(/Sin acceso excepcional/);
  });
  it("el acceso caduca solo", async () => {
    const o = await rpc(tok.operador, "acceso_excepcional_otorgar", { p_tenant_id: T, p_ticket_id: TICKET, p_motivo: "Revisión de finanzas por reclamo del estudio", p_alcance: ["finanzas"], p_horas: 1 });
    expect(o.status).toBe(200);
    expect((await rpc(tok.operador, "owner_tenant_datos_sensibles", { p_tenant_id: T, p_alcance: "finanzas" })).status).toBe(200);
    sql(`update acceso_excepcional_tenant set expira_at = now() - interval '1 minute' where id='${o.body}'`);
    expect(msg(await rpc(tok.operador, "owner_tenant_datos_sensibles", { p_tenant_id: T, p_alcance: "finanzas" }))).toMatch(/Sin acceso excepcional/);
  });
  it("un visitante sin sesión no puede ejecutar ninguna de las funciones nuevas", async () => {
    for (const f of ["owner_tenant_detalle", "owner_tenant_datos_sensibles", "acceso_excepcional_otorgar", "cambiar_estado_tenant_plataforma", "listar_tenants_plataforma", "tenant_estado_historial_listar"]) {
      const r = await rpc(null, f, { p_tenant_id: T, p_alcance: "clientas", p_status: "activo" });
      expect([401, 403, 404], `${f} → ${r.status}`).toContain(r.status);
    }
  });
});

describe("O-06 y O-11 · pruebas fuera de los conteos y métricas rotuladas", () => {
  it("la lista trae tipo y las dos métricas de clientas, consistentes con la base", async () => {
    const r = await rpc(tok.operador, "listar_tenants_plataforma");
    expect(r.status).toBe(200);
    const fila = (r.body as any[]).find((x) => x.id === T);
    expect(fila).toMatchObject({ tipo: "interno", clientas_registradas: 4, clientas_con_acceso: 1 });
    const demo = (r.body as any[]).find((x) => x.slug === "demo");
    expect(demo.tipo).toBe("demo");
    for (const x of r.body as any[]) expect(x.clientas_registradas).toBeGreaterThanOrEqual(x.clientas_con_acceso);
  });
  it("estudios activos del resumen y de Dirección cuentan solo clientes reales", async () => {
    const real = sql(`select count(*)::int n from tenants where status='activo' and tipo='cliente'`)[0].n;
    expect(((await rpc(tok.operador, "plataforma_resumen")).body as any).estudios_activos).toBe(real);
    expect(((await rpc(tok.operador, "plataforma_direccion")).body as any).estudios_activos).toBe(real);
    // un estudio interno/demo activo no suma; al volverlo cliente, sí
    sql(`update tenants set tipo='cliente' where id='${T}'`);
    expect(((await rpc(tok.operador, "plataforma_resumen")).body as any).estudios_activos).toBe(real + 1);
    sql(`update tenants set tipo='interno' where id='${T}'`);
  });
  it("el MRR no suma suscripciones de estudios demo o internos", async () => {
    const esperado = sql(`select coalesce(sum(s.precio_mensual),0)::float m from plataforma_suscripciones s join tenants t on t.id=s.tenant_id where s.estado='activa' and t.tipo='cliente'`)[0].m;
    expect(Number(((await rpc(tok.operador, "plataforma_resumen")).body as any).mrr)).toBe(esperado);
  });
});
