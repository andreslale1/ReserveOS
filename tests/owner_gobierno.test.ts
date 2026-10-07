// GOBIERNO DE LA CONSOLA DE OPERADOR (O-12 a O-15), por API directa con sesión real de cada rol de plataforma:
// equipo e invitaciones, auditoría accionable, salud honesta y dominios verificables.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { login, rpc } from "./helpers";
// @ts-expect-error módulo .mjs sin tipos
import { consulta } from "./escenarios/concurrencia.mjs";

const MGMT = process.env.SUPABASE_ACCESS_TOKEN ?? "";
const REF = process.env.SUPABASE_PROJECT_REF ?? "agkqppuhyltirrhngybq";
const env = Object.fromEntries(readFileSync(resolve(process.cwd(), "web/.env.local"), "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY, URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const PASS = "GobiernoPrueba2026!";
const DOM = "gobierno-prueba.test";
const sql = (q: string) => { const r = consulta(MGMT, REF, q); if (r && !Array.isArray(r) && r.message) throw new Error(String(r.message).slice(0, 300)); return r as Record<string, unknown>[]; };
const aliases = ["op", "op2", "ventas", "soporte", "auditor", "nuevo", "otro"] as const;
const ROL: Record<string, string> = { op: "operador", op2: "operador", ventas: "ventas", soporte: "soporte", auditor: "auditor" };
const uid: Record<string, string> = {};
const tok: Record<string, string> = {};
const em = (a: string) => `tmpgob-${a}@${DOM}`;
const dominioTmp = "tmpgob-dominio.example.test";
let tenantId = "";

async function crearUsuario(email: string) {
  const r = await fetch(`${URL_}/auth/v1/admin/users`, { method: "POST", headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" }, body: JSON.stringify({ email, password: PASS, email_confirm: true }) });
  if (!r.ok && !/already|registered|exists/i.test(await r.text())) throw new Error(`no se pudo crear ${email}`);
}
function limpiar() {
  sql(`update tenant_entitlements set reason='Plan inicial Esencial' where reason like 'tmpgob lote%'`);
  sql(`delete from admin_acciones_log where tabla='tenant_entitlements' and (detalle->>'reason' like 'tmpgob lote%' or detalle->'despues'->>'reason' like 'tmpgob lote%' or detalle->'antes'->>'reason' like 'tmpgob lote%')`);
  sql(`delete from tenant_domains where domain='${dominioTmp}'`);
  sql(`delete from plataforma_invitaciones where email like 'tmpgob-%@${DOM}'`);
  sql(`delete from plataforma_staff where user_id in (select id from auth.users where email like 'tmpgob-%@${DOM}') and rol <> 'operador'`);
  sql(`delete from plataforma_staff where user_id in (select id from auth.users where email like 'tmpgob-%@${DOM}')`);
  sql(`delete from admin_acciones_log where actor_id in (select id from auth.users where email like 'tmpgob-%@${DOM}') or detalle->>'email' like 'tmpgob-%@${DOM}' or detalle->>'razon' like 'tmpgob-%'`);
}

beforeAll(async () => {
  if (!MGMT) throw new Error("Falta SUPABASE_ACCESS_TOKEN");
  limpiar();
  for (const a of aliases) { await crearUsuario(em(a)); uid[a] = String(sql(`select id from auth.users where email='${em(a)}'`)[0].id); }
  for (const [a, rol] of Object.entries(ROL)) sql(`insert into plataforma_staff(user_id,nombre,rol) values ('${uid[a]}','TMP ${a}','${rol}') on conflict (user_id) do update set rol=excluded.rol`);
  for (const a of aliases) tok[a] = await login(em(a), PASS);
  tenantId = String(sql("select id from tenants where slug='vim-prueba'")[0].id);
}, 120_000);
afterAll(async () => {
  limpiar();
  for (const a of aliases) await fetch(`${URL_}/auth/v1/admin/users/${uid[a]}`, { method: "DELETE", headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } });
});

const ok = (s: number) => s === 200 || s === 204;

describe("permisos por rol de plataforma, en la base", () => {
  it("ventas no entra a equipo, auditoría, salud ni dominios", async () => {
    for (const [fn, args] of [["equipo_listar", {}], ["equipo_invitaciones_listar", {}], ["equipo_invitar", { p_email: em("x"), p_nombre: "x", p_rol: "ventas" }], ["plataforma_auditoria_buscar", {}], ["plataforma_auditoria_estudios", {}],
      ["plataforma_salud", {}], ["salud_verificar", {}], ["salud_historial", {}], ["dominios_plataforma", {}]] as [string, Record<string, unknown>][]) {
      const r = await rpc(tok.ventas, fn, args);
      expect(r.status, fn).toBe(400);
      expect(JSON.stringify(r.body), fn).toMatch(/No autorizado|Solo el operador/);
    }
  });
  it("auditor lee equipo y auditoría, pero no invita, no ve salud ni dominios", async () => {
    expect((await rpc(tok.auditor, "equipo_listar")).status).toBe(200);
    expect((await rpc(tok.auditor, "plataforma_auditoria_buscar", {})).status).toBe(200);
    const inv = await rpc(tok.auditor, "equipo_invitar", { p_email: em("nuevo"), p_nombre: "x", p_rol: "ventas" });
    expect(inv.status).toBe(400);
    expect((await rpc(tok.auditor, "plataforma_salud")).status).toBe(400);
    expect((await rpc(tok.auditor, "dominios_plataforma")).status).toBe(400);
    const lista = await rpc(tok.auditor, "equipo_invitaciones_listar");
    expect((lista.body as { token: string | null }[]).every((i) => i.token === null)).toBe(true);
  });
  it("soporte ve salud y dominios, pero no equipo ni auditoría, y no activa dominios", async () => {
    expect((await rpc(tok.soporte, "plataforma_salud")).status).toBe(200);
    expect((await rpc(tok.soporte, "dominios_plataforma")).status).toBe(200);
    expect((await rpc(tok.soporte, "equipo_listar")).status).toBe(400);
    expect((await rpc(tok.soporte, "plataforma_auditoria_buscar", {})).status).toBe(400);
    expect((await rpc(tok.soporte, "dominio_verificar", { p_id: "00000000-0000-0000-0000-000000000000", p_verificado: true })).status).toBe(400);
  });
  it("un visitante sin sesión no puede ejecutar ninguna de las funciones nuevas", async () => {
    for (const fn of ["equipo_listar", "equipo_invitar", "equipo_invitacion_por_token", "equipo_invitacion_aceptar", "plataforma_auditoria_buscar", "plataforma_salud", "salud_verificar", "dominios_plataforma", "dominio_registrar_comprobacion"]) {
      expect([401, 403, 404].includes((await rpc(null, fn, {})).status), fn).toBe(true);
    }
  });
});

describe("equipo e invitaciones (O-12)", () => {
  let token = "", invId = "";
  it("el operador invita a alguien sin cuenta previa: queda pendiente con vencimiento a 7 días", async () => {
    const r = await rpc(tok.op, "equipo_invitar", { p_email: em("nuevo").toUpperCase(), p_nombre: "TMP Nuevo", p_rol: "finanzas" });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const b = r.body as { id: string; token: string; expira_at: string };
    token = b.token; invId = b.id;
    expect(token.length).toBeGreaterThanOrEqual(48);
    const dias = (new Date(b.expira_at).getTime() - Date.now()) / 86_400_000;
    expect(dias).toBeGreaterThan(6.9); expect(dias).toBeLessThan(7.1);
    const lista = (await rpc(tok.op, "equipo_invitaciones_listar")).body as { id: string; estado: string; token: string | null; email: string }[];
    const mia = lista.find((i) => i.id === invId)!;
    expect(mia.estado).toBe("pendiente"); expect(mia.token).toBe(token); expect(mia.email).toBe(em("nuevo"));
  });
  it("rechaza correo inválido, rol inexistente y a alguien que ya es del equipo", async () => {
    expect((await rpc(tok.op, "equipo_invitar", { p_email: "no-es-correo", p_nombre: "", p_rol: "ventas" })).status).toBe(400);
    expect((await rpc(tok.op, "equipo_invitar", { p_email: em("x"), p_nombre: "", p_rol: "superadmin" })).status).toBe(400);
    const ya = await rpc(tok.op, "equipo_invitar", { p_email: em("ventas"), p_nombre: "", p_rol: "ventas" });
    expect(ya.status).toBe(400); expect(JSON.stringify(ya.body)).toContain("ya es parte");
  });
  it("un correo distinto no puede aceptar ni ver el detalle de la invitación", async () => {
    const info = await rpc(tok.otro, "equipo_invitacion_por_token", { p_token: token });
    expect(info.body).toEqual({ estado: "pendiente", coincide: false });
    const acep = await rpc(tok.otro, "equipo_invitacion_aceptar", { p_token: token });
    expect(acep.status).toBe(400); expect(JSON.stringify(acep.body)).toContain("otro correo");
    expect(sql(`select 1 from plataforma_staff where user_id='${uid.otro}'`).length).toBe(0);
  });
  it("una invitación vencida no se puede aceptar", async () => {
    sql(`update plataforma_invitaciones set expira_at = now() - interval '1 minute' where id='${invId}'`);
    const lista = (await rpc(tok.op, "equipo_invitaciones_listar")).body as { id: string; estado: string; token: string | null }[];
    const v = lista.find((i) => i.id === invId)!;
    expect(v.estado).toBe("vencida"); expect(v.token).toBeNull();
    const r = await rpc(tok.nuevo, "equipo_invitacion_aceptar", { p_token: token });
    expect(r.status).toBe(400); expect(JSON.stringify(r.body)).toContain("venci");
    sql(`update plataforma_invitaciones set expira_at = now() + interval '7 days' where id='${invId}'`);
  });
  it("la persona invitada acepta con su correo y entra al equipo con el rol invitado", async () => {
    expect((await rpc(tok.nuevo, "mi_rol_plataforma")).body).toBeNull();
    const r = await rpc(tok.nuevo, "equipo_invitacion_aceptar", { p_token: token });
    expect(r.status, JSON.stringify(r.body)).toBe(200); expect(r.body).toBe("finanzas");
    expect((await rpc(tok.nuevo, "mi_rol_plataforma")).body).toBe("finanzas");
    const otra = await rpc(tok.nuevo, "equipo_invitacion_aceptar", { p_token: token });
    expect(otra.status).toBe(400);
    const eq = (await rpc(tok.op, "equipo_listar")).body as { email: string; rol: string; ultimo_acceso: string | null; ultimo_cambio_por: string | null }[];
    const yo = eq.find((m) => m.email === em("nuevo"))!;
    expect(yo.rol).toBe("finanzas"); expect(yo.ultimo_cambio_por).toBe("TMP op"); expect("ultimo_acceso" in yo).toBe(true);
  });
  it("una invitación pendiente se puede revocar y deja de servir", async () => {
    const n = (await rpc(tok.op, "equipo_invitar", { p_email: em("otro"), p_nombre: "TMP Otro", p_rol: "soporte" })).body as { id: string; token: string };
    expect(ok((await rpc(tok.op, "equipo_invitacion_revocar", { p_id: n.id })).status)).toBe(true);
    const r = await rpc(tok.otro, "equipo_invitacion_aceptar", { p_token: n.token });
    expect(r.status).toBe(400); expect(JSON.stringify(r.body)).toContain("vigente");
    expect((await rpc(tok.op, "equipo_invitacion_revocar", { p_id: n.id })).status).toBe(400);
  });
  it("solo el operador cambia roles y quita gente; nadie puede quitarse a sí mismo", async () => {
    expect((await rpc(tok.ventas, "equipo_guardar", { p_email: em("soporte"), p_nombre: "", p_rol: "operador" })).status).toBe(400);
    expect((await rpc(tok.auditor, "equipo_quitar", { p_user_id: uid.soporte })).status).toBe(400);
    expect((await rpc(tok.op, "equipo_quitar", { p_user_id: uid.op })).status).toBe(400);
    expect(ok((await rpc(tok.op, "equipo_guardar", { p_email: em("nuevo"), p_nombre: "", p_rol: "ventas" })).status)).toBe(true);
    expect(sql(`select rol from plataforma_staff where user_id='${uid.nuevo}'`)[0].rol).toBe("ventas");
    expect(ok((await rpc(tok.op, "equipo_quitar", { p_user_id: uid.nuevo })).status)).toBe(true);
    expect(sql(`select 1 from plataforma_staff where user_id='${uid.nuevo}'`).length).toBe(0);
  });
  it("la base nunca deja sin operador: ni borrando ni degradando al último", () => {
    const r = consulta(MGMT, REF, `do $$ declare e text := ''; begin
      begin delete from plataforma_staff where rol='operador'; e := e || 'borró;'; exception when others then e := e || 'bloqueó borrar;'; end;
      begin update plataforma_staff set rol='auditor' where rol='operador'; e := e || 'degradó;'; exception when others then e := e || 'bloqueó degradar;'; end;
      raise exception 'RESULTADO: %', e; end $$`) as { message?: string };
    expect(r.message).toContain("RESULTADO: bloqueó borrar;bloqueó degradar;");
    expect(sql(`select count(*)::int n from plataforma_staff where rol='operador'`)[0].n).toBeGreaterThanOrEqual(2);
  });
});

describe("auditoría accionable (O-13)", () => {
  type Fila = { created_at: string; actor: string; tabla: string; operacion: string; estudio: string | null; n: number; items: { registro: string; cambios: { campo: string; antes: unknown; despues: unknown }[] }[] };
  const buscar = async (a: Record<string, unknown>) => { const r = await rpc(tok.auditor, "plataforma_auditoria_buscar", a); expect(r.status, JSON.stringify(r.body)).toBe(200); return r.body as { total: number; filas: Fila[] }; };

  it("registra al actor y el diff antes/después de un cambio de rol, con filtros por módulo, actor y acción", async () => {
    await rpc(tok.op, "equipo_guardar", { p_email: em("ventas"), p_nombre: "", p_rol: "marketing" });
    await rpc(tok.op, "equipo_guardar", { p_email: em("ventas"), p_nombre: "", p_rol: "ventas" });
    const r = await buscar({ p_tabla: "plataforma_staff", p_actor: "TMP op", p_operacion: "update", p_limite: 10 });
    expect(r.total).toBeGreaterThanOrEqual(2);
    const f = r.filas[0];
    expect(f.actor).toBe("TMP op"); expect(f.tabla).toBe("plataforma_staff"); expect(f.operacion).toBe("update");
    const rol = f.items[0].cambios.find((c) => c.campo === "rol")!;
    expect(rol).toBeTruthy(); expect(["marketing", "ventas"]).toContain(rol.antes); expect(["marketing", "ventas"]).toContain(rol.despues); expect(rol.antes).not.toBe(rol.despues);
    expect(f.items[0].cambios.find((c) => c.campo === "updated_at")).toBeUndefined();
    expect((await buscar({ p_actor: "no-existe-este-actor" })).total).toBe(0);
    expect((await buscar({ p_tabla: "plataforma_staff", p_operacion: "delete", p_actor: "TMP op", p_q: "zzzz" })).total).toBe(0);
  });
  it("agrupa un cambio de módulos en lote y muestra cada uno con antes y después", async () => {
    const motivo = `tmpgob lote ${Date.now()}`;
    sql(`update tenant_entitlements set reason='${motivo}' where tenant_id='${tenantId}' and module_key in (select module_key from tenant_entitlements where tenant_id='${tenantId}' order by module_key limit 3)`);
    const r = await buscar({ p_tabla: "tenant_entitlements", p_tenant_id: tenantId, p_limite: 5 });
    const lote = r.filas.find((f) => f.n >= 3)!;
    expect(lote, JSON.stringify(r.filas.map((f) => f.n))).toBeTruthy();
    expect(lote.items.length).toBeGreaterThanOrEqual(3);
    const c = lote.items[0].cambios.find((x) => x.campo === "reason")!;
    expect(c.despues).toBe(motivo); expect(c.antes).not.toBe(motivo);
    expect(lote.items[0].registro).toMatch(/^[a-z_]+/);
  });
  it("el período se interpreta en hora de Guatemala y la paginación respeta límite y desplazamiento", async () => {
    const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Guatemala" });
    expect((await buscar({ p_desde: hoy, p_hasta: hoy })).total).toBeGreaterThan(0);
    expect((await buscar({ p_desde: "2000-01-01", p_hasta: "2000-01-02" })).total).toBe(0);
    const todo = await buscar({ p_limite: 2, p_offset: 0 }); const sig = await buscar({ p_limite: 2, p_offset: 2 });
    expect(todo.filas.length).toBeLessThanOrEqual(2);
    if (todo.total > 2) expect(sig.filas[0]?.created_at <= todo.filas[1].created_at).toBe(true);
    expect((await buscar({ p_limite: 9999 })).filas.length).toBeLessThanOrEqual(200);
  });
  it("oculta secretos y datos personales en el diff, y nunca expone el token de una invitación", async () => {
    const x = sql(`select public._audit_redactar('api_secret','"abc"') s, public._audit_redactar('email','"maria@correo.com"') e, public._audit_redactar('telefono','"50212345678"') t, public._audit_redactar('webhook_token','"zz"') w, public._audit_redactar('nombre','"Ana"') n`)[0];
    expect(x).toEqual({ s: "[oculto]", e: "m***@correo.com", t: "***78", w: "[oculto]", n: "Ana" });
    await rpc(tok.op, "equipo_invitar", { p_email: em("otro"), p_nombre: "TMP", p_rol: "auditor" });
    const inv = await buscar({ p_tabla: "plataforma_invitaciones", p_limite: 10 });
    expect(inv.total).toBeGreaterThan(0);
    const texto = JSON.stringify(inv.filas);
    expect(texto).not.toMatch(/[0-9a-f]{48,}/);
    const tokenReal = String(sql(`select token from plataforma_invitaciones where email='${em("otro")}' and estado='pendiente'`)[0]?.token);
    expect(texto).not.toContain(tokenReal);
  });
  it("la lista de estudios para filtrar está disponible para el auditor", async () => {
    const r = await rpc(tok.auditor, "plataforma_auditoria_estudios");
    expect(r.status).toBe(200); expect((r.body as unknown[]).length).toBeGreaterThan(0);
  });
});

describe("salud honesta (O-14)", () => {
  type S = { cron: { jobname: string; estado: string; ultima_ejecucion: string | null; umbral: string }[]; checks: { clave: string; estado: string }[];
    estudios: { estudio: string; estado: string; motivo: string; status: string; orden: number; ultima_reserva: string | null; errores_24h: number }[]; ultima_verificacion: string | null };
  const ESTADOS = ["sano", "degradado", "caido", "sin_evidencia"];
  it("cada tarea, servicio y estudio trae un estado de los cuatro permitidos, con motivo", async () => {
    const r = await rpc(tok.soporte, "plataforma_salud"); expect(r.status).toBe(200);
    const s = r.body as S;
    expect(s.cron.length).toBeGreaterThan(0);
    for (const c of s.cron) { expect(ESTADOS).toContain(c.estado); expect(c.umbral).toMatch(/min/); }
    for (const c of s.checks) expect(ESTADOS).toContain(c.estado);
    for (const e of s.estudios) { expect(ESTADOS).toContain(e.estado); expect(e.motivo.length).toBeGreaterThan(3); }
  });
  it("sin datos no es sano: una tarea que nunca corrió y un estudio sin reservas recientes son «sin evidencia»", async () => {
    const s = (await rpc(tok.soporte, "plataforma_salud")).body as S;
    for (const c of s.cron) if (!c.ultima_ejecucion) expect(c.estado).toBe("sin_evidencia");
    for (const e of s.estudios) {
      if (e.status !== "activo") expect(e.estado).toBe("sin_evidencia");
      else if (e.estado === "sano") expect(new Date(e.ultima_reserva!).getTime()).toBeGreaterThan(Date.now() - 7 * 86_400_000);
    }
  });
  it("un error sin resolver o un incidente crítico degradan o tumban al estudio; resolverlo lo recupera", async () => {
    const f = (b: unknown) => (b as S).estudios.find((e) => e.estudio.toLowerCase().includes("vim"))!;
    // Salud ignora estudios demo/internos (O-06): el fixture se trata como cliente mientras dura esta prueba.
    const tipoOriginal = sql(`select tipo from tenants where id='${tenantId}'`)[0].tipo as string;
    sql(`update tenants set tipo='cliente' where id='${tenantId}'`);
    try {
    sql(`insert into error_logs(tenant_id,firma,mensaje,nivel,veces,ultima_vez,resuelto) values ('${tenantId}','tmpgob-firma','tmpgob error','error',1,now(),false)`);
    expect(f((await rpc(tok.soporte, "plataforma_salud")).body).estado).toBe("degradado");
    sql(`update error_logs set veces=12 where firma='tmpgob-firma'`);
    expect(f((await rpc(tok.soporte, "plataforma_salud")).body).estado).toBe("caido");
    sql(`delete from error_logs where firma='tmpgob-firma'`);
    sql(`insert into plataforma_incidentes(titulo,severidad,estado,tenant_id) values ('tmpgob incidente','critico','investigando','${tenantId}')`);
    const e = f((await rpc(tok.soporte, "plataforma_salud")).body);
    expect(e.estado).toBe("caido"); expect(e.motivo).toContain("crítico");
    sql(`delete from plataforma_incidentes where titulo='tmpgob incidente'`);
    expect(f((await rpc(tok.soporte, "plataforma_salud")).body).estado).not.toBe("caido");
    } finally { sql(`update tenants set tipo='${tipoOriginal}' where id='${tenantId}'`); }
  });
  it("una tarea atrasada según su calendario se marca caída; el cálculo del intervalo entiende los calendarios usados", () => {
    const x = sql(`select public._cron_intervalo_min('*/10 * * * *') a, public._cron_intervalo_min('0 14 * * *') b, public._cron_intervalo_min('15 * * * *') c, public._cron_intervalo_min('raro') d`)[0];
    expect(x).toEqual({ a: 10, b: 1440, c: 60, d: 1440 });
  });
  it("«Verificar ahora» guarda la verificación con su autor y queda en el historial", async () => {
    const antes = ((await rpc(tok.soporte, "salud_historial")).body as unknown[]).length;
    const r = await rpc(tok.soporte, "salud_verificar"); expect(r.status).toBe(200);
    const h = (await rpc(tok.soporte, "salud_historial")).body as { por: string; resumen: Record<string, number> }[];
    expect(h.length).toBeGreaterThanOrEqual(Math.min(antes + 1, 20)); expect(h[0].por).toBe("TMP soporte");
    expect(typeof h[0].resumen.estudios_sanos).toBe("number");
    expect(((await rpc(tok.soporte, "plataforma_salud")).body as S).ultima_verificacion).not.toBeNull();
  });
});

describe("dominios verificables (O-15)", () => {
  type D = { id: string; domain: string; verified: boolean; token_verificacion: string; dns_estado: string; tls_estado: string; txt_estado: string };
  let id = "";
  const dom = async () => ((await rpc(tok.op, "dominios_plataforma")).body as D[]).find((d) => d.id === id)!;
  it("un dominio nuevo nace pendiente, con su token de propiedad", async () => {
    id = String(sql(`insert into tenant_domains(tenant_id,domain,verified) values ('${tenantId}','${dominioTmp}',false) returning id`)[0].id);
    const d = await dom();
    expect(d.verified).toBe(false); expect(d.dns_estado).toBe("pendiente"); expect(d.tls_estado).toBe("pendiente"); expect(d.token_verificacion.length).toBeGreaterThanOrEqual(32);
  });
  it("no se publica sin comprobar DNS y HTTPS, ni con una comprobación con error", async () => {
    const sin = await rpc(tok.op, "dominio_verificar", { p_id: id, p_verificado: true });
    expect(sin.status).toBe(400); expect(JSON.stringify(sin.body)).toContain("Comprueba DNS y HTTPS");
    await rpc(tok.soporte, "dominio_registrar_comprobacion", { p_id: id, p_dns: "ok", p_dns_detalle: "CNAME", p_txt: "pendiente", p_tls: "error", p_tls_detalle: "HTTPS 404" });
    expect((await rpc(tok.op, "dominio_verificar", { p_id: id, p_verificado: true })).status).toBe(400);
    expect((await dom()).verified).toBe(false);
  });
  it("quien no tiene permiso no registra comprobaciones", async () => {
    expect((await rpc(tok.ventas, "dominio_registrar_comprobacion", { p_id: id, p_dns: "ok", p_dns_detalle: "", p_txt: "ok", p_tls: "ok", p_tls_detalle: "" })).status).toBe(400);
    expect((await rpc(tok.op, "dominio_registrar_comprobacion", { p_id: id, p_dns: "quizá", p_dns_detalle: "", p_txt: "ok", p_tls: "ok", p_tls_detalle: "" })).status).toBe(400);
  });
  it("con DNS y HTTPS correctos el operador lo publica, el visitante lo resuelve, y al despublicar deja de resolver", async () => {
    await rpc(tok.soporte, "dominio_registrar_comprobacion", { p_id: id, p_dns: "ok", p_dns_detalle: "CNAME → cname.vercel-dns.com", p_txt: "ok", p_tls: "ok", p_tls_detalle: "200" });
    expect(ok((await rpc(tok.op, "dominio_verificar", { p_id: id, p_verificado: true })).status)).toBe(true);
    const pub = await rpc(null, "tenant_por_dominio", { p_host: dominioTmp });
    expect(pub.status).toBe(200); expect((pub.body as { tenant_id: string }).tenant_id).toBe(tenantId);
    expect(ok((await rpc(tok.op, "dominio_verificar", { p_id: id, p_verificado: false })).status)).toBe(true);
    expect((await rpc(null, "tenant_por_dominio", { p_host: dominioTmp })).body).toBeNull();
  });
  it("una comprobación vieja (más de 24 horas) ya no alcanza para publicar", async () => {
    sql(`update tenant_domains set dns_comprobado_at = now() - interval '25 hours', tls_comprobado_at = now() - interval '25 hours' where id='${id}'`);
    expect((await rpc(tok.op, "dominio_verificar", { p_id: id, p_verificado: true })).status).toBe(400);
  });
});
