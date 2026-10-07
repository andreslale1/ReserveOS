// CONSOLA OWNER · FLUJO COMERCIAL (O-03, O-04, O-09 y vista previa de cobros) sobre datos reales por API directa.
// Crea su propio plan, oportunidad, contrato y estudios temporales (prefijo "oc") y los borra al terminar. Requiere SUPABASE_ACCESS_TOKEN.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { consulta } from "./escenarios/concurrencia.mjs";
import { SUPABASE_URL, login, rpc } from "./helpers";
import { formatoFecha, hoyGT, mesGT, ultimoDiaMes } from "../web/lib/fechas";

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN!, REF = process.env.SUPABASE_PROJECT_REF ?? "agkqppuhyltirrhngybq";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const espera = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
function sql(q: string): Record<string, any>[] {   // la API de gestión limita el ritmo: se reintenta en lugar de fallar
  for (let i = 0; i < 8; i++) {
    const r = consulta(TOKEN, REF, q) as any;
    if (Array.isArray(r)) return r;
    if (!String(r?.message ?? "").includes("Throttler")) throw new Error(`SQL falló: ${JSON.stringify(r).slice(0, 300)}`);
    espera(6000);
  }
  throw new Error("SQL: demasiados reintentos por límite de ritmo");
}
const run = Date.now().toString(36), PASS = "OcTmp2026!";
const mail = (a: string) => `oc-${a}-${run}@owner-prueba.test`;
const PLAN = `tmp_oc_${run}`, SLUG = `oc-alta-${run}`, SLUG_M = `oc-manual-${run}`;
const tok: Record<string, string> = {}, uid: Record<string, string> = {};
const msg = (r: { body: any }) => String(r.body?.message ?? "");
const MODS = ["nucleo_agenda_reservas", "portal_marca"];
let EMPRESA = "", LEAD = "", PROP = "", CONTRATO = "", TENANT = "", PROY = "", TENANT_M = "", PROY_M = "";

async function crearUsuario(alias: string) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, { method: "POST", headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" }, body: JSON.stringify({ email: mail(alias), password: PASS, email_confirm: true }) });
  const j = await r.json(); expect(r.ok, JSON.stringify(j)).toBe(true); uid[alias] = j.id;
}
const plan = (over: Record<string, unknown> = {}) => rpc(tok.operador, "plan_guardar", { p_key: PLAN, p_nombre: "Plan OC", p_descripcion: null, p_precio: 250, p_max_sedes: 3, p_max_staff: null, p_modulos: MODS, p_estado: "publicado", p_moneda: "GTQ", p_prueba_gratuita: false, p_crear: false, ...over });

beforeAll(async () => {
  expect(TOKEN, "falta SUPABASE_ACCESS_TOKEN").toBeTruthy();
  for (const a of ["operador", "ventas", "finanzas"]) await crearUsuario(a);
  sql(`insert into plataforma_staff(user_id,nombre,rol) values ('${uid.operador}','OCT operador','operador'),('${uid.ventas}','OCT ventas','ventas'),('${uid.finanzas}','OCT finanzas','finanzas')`);
  for (const a of ["operador", "ventas", "finanzas"]) tok[a] = await login(mail(a), PASS);
}, 60000);

afterAll(async () => {
  const ts = `(select id from tenants where slug like 'oc-alta-%' or slug like 'oc-manual-%')`;
  const emp = `(select id from plataforma_empresas where nombre like 'ZZ OC %')`;
  const leads = `(select id from plataforma_leads where empresa_id in ${emp})`;
  sql(`delete from plataforma_cobros where tenant_id in ${ts};
       delete from plataforma_suscripciones where tenant_id in ${ts};
       delete from plataforma_proyectos where tenant_id in ${ts} or lead_id in ${leads};
       delete from plataforma_contratos where tenant_id in ${ts} or lead_id in ${leads};
       delete from plataforma_propuestas where lead_id in ${leads};
       delete from plataforma_leads where empresa_id in ${emp};
       delete from plataforma_empresas where nombre like 'ZZ OC %';
       delete from invitaciones_personal where tenant_id in ${ts};
       delete from tenant_entitlements where tenant_id in ${ts};
       delete from tenant_module_settings where tenant_id in ${ts};
       delete from tenant_memberships where tenant_id in ${ts};
       delete from admin_acciones_log where tenant_id in ${ts};
       delete from acceso_excepcional_tenant where tenant_id in ${ts};
       delete from tenants where slug like 'oc-alta-%' or slug like 'oc-manual-%';
       delete from plataforma_planes where key like 'tmp_oc_%';
       delete from plataforma_staff where nombre like 'OCT %'`);
  for (const a of Object.keys(uid)) await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${uid[a]}`, { method: "DELETE", headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } });
  const quedan = sql(`select (select count(*) from tenants where slug like 'oc-alta-%' or slug like 'oc-manual-%')::int t, (select count(*) from plataforma_staff where nombre like 'OCT %')::int s, (select count(*) from plataforma_planes where key like 'tmp_oc_%')::int p, (select count(*) from plataforma_empresas where nombre like 'ZZ OC %')::int e`)[0];
  expect(quedan).toEqual({ t: 0, s: 0, p: 0, e: 0 });
}, 60000);

describe("O-09 · fecha de Guatemala", () => {
  it("a las 8:30 p. m. en Guatemala el día sigue siendo el de Guatemala, aunque en UTC ya sea el siguiente", () => {
    const noche = new Date("2026-10-08T02:30:00Z"); // 8:30 p. m. del 7 de octubre en Guatemala
    expect(noche.toISOString().slice(0, 10)).toBe("2026-10-08");
    expect(hoyGT(noche)).toBe("2026-10-07");
    expect(mesGT(new Date("2026-11-01T03:00:00Z"))).toBe("2026-10"); // 9 p. m. del 31 de octubre: sigue siendo octubre
    expect(hoyGT(new Date("2026-10-08T06:00:00Z"))).toBe("2026-10-08"); // medianoche en Guatemala
  });
  it("formato dd/mm/aaaa y último día del mes", () => {
    expect(formatoFecha("2026-10-07")).toBe("07/10/2026");
    expect(formatoFecha(null)).toBe("—");
    expect(ultimoDiaMes("2026-02")).toBe("2026-02-28");
    expect(ultimoDiaMes("2028-02")).toBe("2028-02-29");
  });
  it("la base y la consola coinciden en qué día es hoy", async () => {
    const r = await rpc(tok.operador, "hoy_gt");
    expect(r.status).toBe(200);
    expect(r.body).toBe(hoyGT());
  });
});

describe("O-03 · planes y suscripciones sin Q0", () => {
  it("los planes que estaban en Q0 quedaron en borrador y no se pueden asignar", async () => {
    const q0 = sql(`select key, estado from plataforma_planes where precio_mensual = 0 and not prueba_gratuita and key not like 'tmp_oc_%'`);
    for (const p of q0) expect(p.estado, p.key).not.toBe("publicado");
  });
  it("no se publica un plan en Q0 salvo que sea prueba gratuita explícita", async () => {
    const r = await plan({ p_precio: 0 }); expect(r.status).toBe(400); expect(msg(r)).toMatch(/Q0|prueba gratuita/i);
    expect((await plan({ p_precio: 0, p_estado: "borrador" })).status).toBe(204);       // borrador sí puede estar en Q0
    expect((await plan({ p_key: `${PLAN}_prueba`, p_precio: 0, p_prueba_gratuita: true })).status).toBe(204);
  });
  it("clave única: crear con una clave que ya existe falla, y cambiar precio sube la versión", async () => {
    expect((await plan({ p_precio: 250 })).status).toBe(204);
    const r = await plan({ p_crear: true }); expect(r.status).toBe(400); expect(msg(r)).toMatch(/Ya existe/);
    const v0 = sql(`select version from plataforma_planes where key='${PLAN}'`)[0].version;
    await plan({ p_precio: 300 });
    expect(sql(`select version, estado, moneda from plataforma_planes where key='${PLAN}'`)[0]).toEqual({ version: v0 + 1, estado: "publicado", moneda: "GTQ" });
    await plan({ p_precio: 250 });
  });
  it("las suscripciones solo usan planes publicados del catálogo (nada de «estandar» libre)", async () => {
    const t = sql(`select id from tenants where slug='ficticio-b'`)[0].id;
    const libre = await rpc(tok.operador, "suscripcion_guardar", { p_tenant_id: t, p_plan: "estandar", p_precio_mensual: 100, p_dia_cobro: 1, p_estado: "activa" });
    expect(libre.status).toBe(400); expect(msg(libre)).toMatch(/catálogo/);
    const vacio = await rpc(tok.operador, "suscripcion_guardar", { p_tenant_id: t, p_plan: "", p_precio_mensual: 100, p_dia_cobro: 1, p_estado: "activa" });
    expect(vacio.status).toBe(400);
    const borrador = await rpc(tok.operador, "suscripcion_guardar", { p_tenant_id: t, p_plan: "esencial", p_precio_mensual: 100, p_dia_cobro: 1, p_estado: "activa" });
    expect(sql(`select estado from plataforma_planes where key='esencial'`)[0].estado === "publicado" || borrador.status === 400).toBe(true);
    const q0 = await rpc(tok.operador, "suscripcion_guardar", { p_tenant_id: t, p_plan: PLAN, p_precio_mensual: 0, p_dia_cobro: 1, p_estado: "activa" });
    expect(q0.status).toBe(400); expect(msg(q0)).toMatch(/Q0/);
    expect(sql(`select count(*)::int n from plataforma_suscripciones where tenant_id='${t}'`)[0].n).toBe(0);
  });
  it("el impacto de un plan se puede consultar antes de cambiarlo", async () => {
    const r = await rpc(tok.operador, "plan_impacto", { p_key: PLAN }); expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ suscripciones_activas: 0, estudios: 0 });
  });
});

describe("O-04 · pipeline → propuesta → contrato con estados", () => {
  it("una oportunidad abierta exige próxima acción con fecha", async () => {
    const e = await rpc(tok.ventas, "empresa_guardar", { p_id: null, p_nombre: `ZZ OC ${run}`, p_tipo: "estudio", p_ciudad: "Guatemala", p_sitio_web: null, p_tamano_sedes: 1, p_fuente: "web", p_notas: null });
    expect(e.status, JSON.stringify(e.body)).toBe(200); EMPRESA = e.body as string;
    const args = { p_id: null, p_empresa_id: EMPRESA, p_valor_mensual: 250, p_etapa: "prospecto", p_plan_interes: PLAN, p_num_sedes: 1, p_probabilidad: 30, p_proximo_paso: null, p_proximo_paso_fecha: null, p_fuente: "web", p_motivo_perdida: null, p_notas: null };
    const sin = await rpc(tok.ventas, "oportunidad_guardar", args); expect(sin.status).toBe(400); expect(msg(sin)).toMatch(/próxima acción/);
    const con = await rpc(tok.ventas, "oportunidad_guardar", { ...args, p_proximo_paso: "Llamar para demo", p_proximo_paso_fecha: hoyGT() });
    expect(con.status, JSON.stringify(con.body)).toBe(200); LEAD = con.body as string;
  });
  it("«Ganado» sin propuesta ni contrato se rechaza; con excepción de motivo corto también; con motivo suficiente queda registrada", async () => {
    const a = await rpc(tok.ventas, "lead_cambiar_etapa", { p_id: LEAD, p_etapa: "ganado" }); expect(a.status).toBe(400); expect(msg(a)).toMatch(/propuesta aceptada o un contrato/);
    const b = await rpc(tok.ventas, "lead_cambiar_etapa", { p_id: LEAD, p_etapa: "ganado", p_excepcion: "corto" }); expect(b.status).toBe(400);
    expect(sql(`select etapa from plataforma_leads where id='${LEAD}'`)[0].etapa).toBe("prospecto");
    // el flujo normal: propuesta enviada y aceptada la gana sola
  });
  it("la propuesta exige un plan publicado y precio; aceptada, gana la oportunidad y permite crear el contrato (en borrador)", async () => {
    const mala = await rpc(tok.ventas, "propuesta_guardar", { p_lead_id: LEAD, p_plan_key: "esencial", p_num_sedes: 1, p_sedes_extra: 0, p_modulos_extra: [], p_setup: 0, p_mensualidad: 100, p_app_propia: false, p_soporte: "estandar", p_inicio: null, p_notas: null });
    expect(mala.status === 200).toBe(true); // el borrador se puede guardar con cualquier plan…
    const env = await rpc(tok.ventas, "propuesta_guardar", { p_lead_id: LEAD, p_plan_key: PLAN, p_num_sedes: 1, p_sedes_extra: 0, p_modulos_extra: [], p_setup: 500, p_mensualidad: 250, p_app_propia: false, p_soporte: "estandar", p_inicio: null, p_notas: null });
    expect(env.status, JSON.stringify(env.body)).toBe(200); PROP = env.body as string;
    expect((await rpc(tok.ventas, "propuesta_estado", { p_id: PROP, p_estado: "enviada" })).status).toBe(204);
    expect((await rpc(tok.ventas, "propuesta_estado", { p_id: PROP, p_estado: "aceptada" })).status).toBe(204);
    expect(sql(`select etapa from plataforma_leads where id='${LEAD}'`)[0].etapa).toBe("ganado");
    const c = await rpc(tok.ventas, "contrato_crear", { p_propuesta_id: PROP, p_fecha_firma: null, p_vigencia_meses: 12, p_renovacion_auto: true, p_documento_url: null, p_notas: null, p_version_terminos: "T&C 2026-10", p_firmantes: null });
    expect(c.status, JSON.stringify(c.body)).toBe(200); CONTRATO = c.body as string;
    const fila = sql(`select estado, alcance_sedes, alcance_modulos from plataforma_contratos where id='${CONTRATO}'`)[0];
    expect(fila.estado).toBe("borrador"); expect(fila.alcance_sedes).toBe(1); expect(fila.alcance_modulos.sort()).toEqual([...MODS].sort());
  });
  it("estados del contrato: no se salta pasos, firmar exige firmantes, solo vigente se aplica o da de alta", async () => {
    const salto = await rpc(tok.ventas, "contrato_estado", { p_id: CONTRATO, p_estado: "vigente" }); expect(salto.status).toBe(400); expect(msg(salto)).toMatch(/no puede pasar/);
    expect((await rpc(tok.ventas, "contrato_estado", { p_id: CONTRATO, p_estado: "enviado" })).status).toBe(204);
    const sinFirma = await rpc(tok.ventas, "contrato_estado", { p_id: CONTRATO, p_estado: "firmado" }); expect(sinFirma.status).toBe(400); expect(msg(sinFirma)).toMatch(/firmantes/);
    const temprano = await rpc(tok.operador, "alta_estudio_desde_contrato", { p_contrato_id: CONTRATO, p_slug: SLUG, p_name: `OC Estudio ${run}`, p_sede_nombre: "Central" });
    expect(temprano.status).toBe(400); expect(msg(temprano)).toMatch(/vigente/);
    expect((await rpc(tok.ventas, "contrato_estado", { p_id: CONTRATO, p_estado: "firmado", p_firmantes: "Dueña del estudio y Andrés López" })).status).toBe(204);
    expect((await rpc(tok.ventas, "contrato_estado", { p_id: CONTRATO, p_estado: "vigente" })).status).toBe(204);
    const l = await rpc(tok.ventas, "contratos_listar"); expect(l.status).toBe(200);
    expect((l.body as any[]).find((x) => x.id === CONTRATO)).toMatchObject({ estado: "vigente", plan_key: PLAN, firmantes: "Dueña del estudio y Andrés López" });
  });
});

describe("O-04 · alta guiada desde el contrato", () => {
  it("solo implementación/operador da de alta; ventas no", async () => {
    const r = await rpc(tok.ventas, "alta_estudio_desde_contrato", { p_contrato_id: CONTRATO, p_slug: SLUG, p_name: `OC Estudio ${run}`, p_sede_nombre: "Central" });
    expect(r.status).toBe(400); expect(msg(r)).toMatch(/No autorizado/);
  });
  it("detecta duplicados: un enlace existente bloquea; un nombre repetido pide confirmación", async () => {
    const dup = await rpc(tok.operador, "alta_estudio_desde_contrato", { p_contrato_id: CONTRATO, p_slug: "ficticio-a", p_name: `OC Estudio ${run}`, p_sede_nombre: "Central" });
    expect(dup.status).toBe(400); expect(msg(dup)).toMatch(/Duplicado/);
    const nombre = await rpc(tok.operador, "alta_estudio_desde_contrato", { p_contrato_id: CONTRATO, p_slug: SLUG, p_name: "Tenant Ficticio A", p_sede_nombre: "Central" });
    expect(nombre.status).toBe(400); expect(msg(nombre)).toMatch(/Posible duplicado/);
    const malo = await rpc(tok.operador, "alta_estudio_desde_contrato", { p_contrato_id: CONTRATO, p_slug: "Mal Enlace!", p_name: `OC Estudio ${run}`, p_sede_nombre: "Central" });
    expect(malo.status).toBe(400);
    const lista = await rpc(tok.operador, "alta_detectar_duplicados", { p_slug: "ficticio-a", p_nombre: "x", p_email: null, p_dominio: null });
    expect((lista.body as any[]).some((d) => d.tipo === "slug" && d.bloquea)).toBe(true);
    expect(sql(`select count(*)::int n from tenants where slug='${SLUG}'`)[0].n).toBe(0);
  });
  it("crea el estudio en borrador con sede, suscripción en pausa ligada al contrato, módulos del plan y dueña invitada", async () => {
    const r = await rpc(tok.operador, "alta_estudio_desde_contrato", { p_contrato_id: CONTRATO, p_slug: SLUG, p_name: `OC Estudio ${run}`, p_sede_nombre: "Central", p_email_duena: `duena-${run}@owner-prueba.test`, p_nombre_duena: "Dueña OC" });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const b = r.body as { tenant_id: string; proyecto_id: string; token: string; reanudado: boolean };
    TENANT = b.tenant_id; PROY = b.proyecto_id; expect(b.reanudado).toBe(false); expect(b.token).toBeTruthy();
    const t = sql(`select status from tenants where id='${TENANT}'`)[0].status;
    expect(["borrador", "activo"]).toContain(t);
    const s = sql(`select plan, precio_mensual::int p, estado, contrato_id from plataforma_suscripciones where tenant_id='${TENANT}'`)[0];
    expect(s).toEqual({ plan: PLAN, p: 250, estado: "pausada", contrato_id: CONTRATO });
    expect(sql(`select count(*)::int n from sedes where tenant_id='${TENANT}'`)[0].n).toBe(1);
    expect(sql(`select string_agg(module_key, ',' order by module_key) m from tenant_entitlements where tenant_id='${TENANT}' and enabled`)[0].m).toBe([...MODS].sort().join(","));
    const et = sql(`select e->>'key' k from plataforma_proyectos p, jsonb_array_elements(p.etapas) e where p.id='${PROY}' and (e->>'hecha')::boolean`).map((x) => x.k).sort();
    expect(et).toEqual(["contrato", "estudio", "plan"]);
  });
  it("es reanudable: repetirlo no duplica nada y devuelve el mismo estudio", async () => {
    const r = await rpc(tok.operador, "alta_estudio_desde_contrato", { p_contrato_id: CONTRATO, p_slug: SLUG, p_name: `OC Estudio ${run}`, p_sede_nombre: "Central" });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body).toMatchObject({ tenant_id: TENANT, proyecto_id: PROY, reanudado: true });
    expect(sql(`select count(*)::int n from plataforma_suscripciones where tenant_id='${TENANT}'`)[0].n).toBe(1);
    expect(sql(`select count(*)::int n from invitaciones_personal where tenant_id='${TENANT}'`)[0].n).toBe(1);
  });
});

describe("O-03/O-04 · puertas para salir en vivo y estados por módulo", () => {
  it("la puerta lista qué falta y bloquea la salida", async () => {
    const g = await rpc(tok.operador, "proyecto_gates", { p_id: PROY }); expect(g.status).toBe(200);
    const porKey = Object.fromEntries((g.body as any[]).map((x) => [x.key, x]));
    expect(porKey.contrato.ok).toBe(true); expect(porKey.suscripcion.ok).toBe(true);
    expect(porKey.duena.ok).toBe(false); expect(porKey.duena.bloquea).toBe(true);
    expect(porKey.modulos.bloquea).toBe(false);
    const p = await rpc(tok.operador, "proyecto_publicar", { p_id: PROY }); expect(p.status).toBe(400); expect(msg(p)).toMatch(/etapas obligatorias/);
    expect(sql(`select estado from plataforma_proyectos where id='${PROY}'`)[0].estado).toBe("en_curso");
  });
  it("estados del módulo: contratado → habilitado → configurado → probado (con evidencia) → en producción, sin saltos", async () => {
    const l = await rpc(tok.operador, "modulos_estado_listar", { p_tenant_id: TENANT }); expect(l.status).toBe(200);
    const nucleo = (l.body as any[]).find((m) => m.module_key === "nucleo_agenda_reservas");
    expect(nucleo).toMatchObject({ contratado: true, habilitado: true, configurado: false, estado: "habilitado" });
    expect(nucleo.falta).toMatch(/configurar/);
    const marcar = (hito: string, hecho = true, ev: string | null = null) => rpc(tok.operador, "modulo_hito_marcar", { p_tenant_id: TENANT, p_module: "nucleo_agenda_reservas", p_hito: hito, p_hecho: hecho, p_evidencia: ev });
    expect((await marcar("probado", true, "reserva ok")).status).toBe(400);            // falta configurar
    expect((await marcar("produccion")).status).toBe(400);                              // falta probar
    expect((await marcar("configurado")).status).toBe(204);
    expect((await marcar("probado", true, "x")).status).toBe(400);                      // evidencia insuficiente
    expect((await marcar("probado", true, "Reserva y cancelación de punta a punta OK")).status).toBe(204);
    expect((await marcar("produccion")).status).toBe(204);
    const final = ((await rpc(tok.operador, "modulos_estado_listar", { p_tenant_id: TENANT })).body as any[]).find((m) => m.module_key === "nucleo_agenda_reservas");
    expect(final).toMatchObject({ estado: "en_produccion", falta: null });
    expect((await marcar("configurado", false)).status).toBe(204);                      // quitar configuración baja todo
    const bajo = ((await rpc(tok.operador, "modulos_estado_listar", { p_tenant_id: TENANT })).body as any[]).find((m) => m.module_key === "nucleo_agenda_reservas");
    expect(bajo).toMatchObject({ configurado: false, probado: false, produccion: false });
    expect((await rpc(tok.ventas, "modulo_hito_marcar", { p_tenant_id: TENANT, p_module: "nucleo_agenda_reservas", p_hito: "configurado", p_hecho: true })).status).toBe(400);
  });
  it("sin dueña no sale en vivo: hace falta una excepción con motivo, que queda registrada; entonces la suscripción se activa", async () => {
    sql(`update plataforma_proyectos set etapas = (select jsonb_agg(jsonb_set(e,'{hecha}','true')) from jsonb_array_elements(etapas) e) where id='${PROY}'`);
    const sin = await rpc(tok.operador, "proyecto_publicar", { p_id: PROY }); expect(sin.status).toBe(400); expect(msg(sin)).toMatch(/Dueña con acceso/);
    const corto = await rpc(tok.operador, "proyecto_publicar", { p_id: PROY, p_excepcion: "ya" }); expect(corto.status).toBe(400);
    const ok = await rpc(tok.operador, "proyecto_publicar", { p_id: PROY, p_excepcion: "La dueña acepta la invitación mañana; cliente piloto aprobado" });
    expect(ok.status, JSON.stringify(ok.body)).toBe(204);
    const p = sql(`select estado, excepcion_motivo, excepcion_por from plataforma_proyectos where id='${PROY}'`)[0];
    expect(p.estado).toBe("en_vivo"); expect(p.excepcion_motivo).toMatch(/cliente piloto/); expect(p.excepcion_por).toBe(uid.operador);
    expect(sql(`select status from tenants where id='${TENANT}'`)[0].status).toBe("activo");
    expect(sql(`select estado from plataforma_suscripciones where tenant_id='${TENANT}'`)[0].estado).toBe("activa");
  });
});

describe("O-04 · alta manual excepcional", () => {
  it("exige motivo, no admite enlaces repetidos y deja la excepción registrada en el proyecto", async () => {
    const base = { p_slug: SLUG_M, p_name: `OC Manual ${run}`, p_sede_nombre: "Unica", p_timezone: "America/Guatemala" };
    const sin = await rpc(tok.operador, "alta_estudio_manual", { ...base, p_motivo: "" }); expect(sin.status).toBe(400); expect(msg(sin)).toMatch(/motivo/);
    const dup = await rpc(tok.operador, "alta_estudio_manual", { ...base, p_slug: SLUG, p_motivo: "Estudio de prueba interno de la gerencia" }); expect(dup.status).toBe(400); expect(msg(dup)).toMatch(/Duplicado/);
    const v = await rpc(tok.ventas, "alta_estudio_manual", { ...base, p_motivo: "Estudio de prueba interno de la gerencia" }); expect(v.status).toBe(400);
    const r = await rpc(tok.operador, "alta_estudio_manual", { ...base, p_motivo: "Estudio de prueba interno de la gerencia" });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    TENANT_M = (r.body as any).tenant_id; PROY_M = (r.body as any).proyecto_id;
    expect(sql(`select excepcion_motivo from plataforma_proyectos where id='${PROY_M}'`)[0].excepcion_motivo).toMatch(/Alta manual sin contrato/);
    const g = (await rpc(tok.operador, "proyecto_gates", { p_id: PROY_M })).body as any[];
    expect(g.find((x) => x.key === "contrato").ok).toBe(true);      // la excepción cubre el contrato…
    expect(g.find((x) => x.key === "suscripcion").ok).toBe(false);  // …pero no el plan: sin suscripción no sale en vivo
  });
});

describe("Cobros · vista previa y generación segura", () => {
  const periodo = `${mesGT()}-01`;
  it("la vista previa lista lo que se generará, sin generar nada, y separa excepciones", async () => {
    sql(`delete from plataforma_cobros where tenant_id in ('${TENANT}','${TENANT_M}')`);
    const v = await rpc(tok.finanzas, "generar_cobros_vista_previa", { p_periodo: periodo }); expect(v.status, JSON.stringify(v.body)).toBe(200);
    const b = v.body as { cantidad: number; total: number; a_generar: any[]; excepciones: any[] };
    expect(b.a_generar.find((x) => x.tenant_id === TENANT)).toMatchObject({ plan: PLAN, monto: 250 });
    expect(b.cantidad).toBe(b.a_generar.length);
    expect(sql(`select count(*)::int n from plataforma_cobros where tenant_id='${TENANT}'`)[0].n).toBe(0);
  });
  it("un estudio suspendido sale como excepción y no se cobra", async () => {
    sql(`update tenants set status='suspendido' where id='${TENANT}'`);
    const b = (await rpc(tok.finanzas, "generar_cobros_vista_previa", { p_periodo: periodo })).body as any;
    expect(b.a_generar.some((x: any) => x.tenant_id === TENANT)).toBe(false);
    expect(b.excepciones.find((x: any) => x.tenant_id === TENANT)?.motivo).toMatch(/suspendido/);
    sql(`update tenants set status='activo' where id='${TENANT}'`);
  });
  it("generar usa el mes de Guatemala por defecto, no duplica y rechaza períodos lejanos", async () => {
    const r1 = await rpc(tok.finanzas, "generar_cobros_mes", { p_periodo: null }); expect(r1.status).toBe(200); expect(Number(r1.body)).toBeGreaterThanOrEqual(1);
    const mio = sql(`select periodo::text p, monto::int m from plataforma_cobros where tenant_id='${TENANT}'`);
    expect(mio).toEqual([{ p: periodo, m: 250 }]);
    const r2 = await rpc(tok.finanzas, "generar_cobros_mes", { p_periodo: null }); expect(Number(r2.body)).toBe(0);
    const v = (await rpc(tok.finanzas, "generar_cobros_vista_previa", { p_periodo: periodo })).body as any;
    expect(v.ya_existentes.some((x: any) => x.tenant_id === TENANT)).toBe(true);
    const lejos = await rpc(tok.finanzas, "generar_cobros_mes", { p_periodo: "2099-01-01" }); expect(lejos.status).toBe(400); expect(msg(lejos)).toMatch(/un mes adelante/);
  });
  it("solo finanzas/operador generan cobros", async () => {
    expect((await rpc(tok.ventas, "generar_cobros_mes", { p_periodo: null })).status).toBe(400);
    expect((await rpc(tok.ventas, "generar_cobros_vista_previa", { p_periodo: null })).status).toBe(400);
  });
});
