// CENTRO DE MANDO, FINANZAS CON UNA SOLA REGLA, ANULACIÓN, EXPORTES Y FICHA DE CLIENTA, por API directa con sesión real de cada rol.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import roles from "./fixtures/roles.json";
import { login, rpc, selectFrom, SUPABASE_URL, ANON_KEY } from "./helpers";
// @ts-expect-error módulo .mjs sin tipos
import { consulta } from "./escenarios/concurrencia.mjs";
import { createClient } from "../web/node_modules/@supabase/supabase-js";
import { REPORTES, aCsv, reportePorId } from "../web/lib/reportes-catalogo";

const MGMT = process.env.SUPABASE_ACCESS_TOKEN ?? "";
const REF = process.env.SUPABASE_PROJECT_REF ?? "agkqppuhyltirrhngybq";
const sql = (q: string) => { const r = consulta(MGMT, REF, q); if (r && !Array.isArray(r) && r.message) throw new Error(String(r.message).slice(0, 300)); return r as Record<string, any>[]; };
const email = (a: string) => `${a}@${roles.dominio}`;
const tok: Record<string, string> = {};
let T = "", T_UNA = "";
const SEDE: Record<string, string> = {};
const msg = (r: { body: any }) => String(r.body?.message ?? "");
const ok = (s: number) => s === 200 || s === 204;
const num = (x: unknown) => Number(x ?? 0);
const hasta = "2026-12-31", desde = "2026-01-01";
const cliente = (alias: string) => createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${tok[alias]}` } }, auth: { persistSession: false } });

const temp = { membresia: "", codigo: "", clienta: "", carrito: "" };

beforeAll(async () => {
  if (!MGMT) throw new Error("Falta SUPABASE_ACCESS_TOKEN");
  for (const u of roles.usuarios) tok[u.alias] = await login(email(u.alias), roles.password);
  T = sql(`select id from tenants where slug='${roles.tenants.vim.slug}'`)[0].id;
  T_UNA = sql(`select id from tenants where slug='${roles.tenants.una.slug}'`)[0].id;
  for (const s of sql(`select id,name from sedes where tenant_id='${T}'`)) SEDE[s.name] = s.id;
  // limpieza de corridas anteriores interrumpidas
  sql(`delete from clientes where tenant_id='${T}' and nombre like 'TMP Neg%'`);
  sql(`delete from membresias where codigo_descuento_id in (select id from codigos_descuento where codigo like 'TMPNEG%')`);
  sql(`delete from codigos_descuento where tenant_id='${T}' and codigo like 'TMPNEG%'`);
  sql(`delete from metas_mensuales where tenant_id='${T}' and tipo in ('reservas')`);
}, 120_000);
afterAll(() => {
  sql(`delete from cola_mensajes where tenant_id='${T}' and tipo in ('consentimiento_pendiente','carrito_abandonado') and clave_unica like any (array['consent-%','carrito-%'])`);
  sql(`delete from carritos where tenant_id='${T}' and cliente_id in (select id from clientes where nombre like 'TMP Neg%')`);
  sql(`delete from membresias where tenant_id='${T}' and cliente_id in (select id from clientes where nombre like 'TMP Neg%')`);
  sql(`delete from membresias where codigo_descuento_id in (select id from codigos_descuento where codigo like 'TMPNEG%')`);
  sql(`delete from clientes where tenant_id='${T}' and nombre like 'TMP Neg%'`);
  sql(`delete from codigos_descuento where tenant_id='${T}' and codigo like 'TMPNEG%'`);
  sql(`delete from metas_mensuales where tenant_id='${T}' and tipo='reservas'`);
  sql(`delete from admin_acciones_log where tenant_id='${T}' and tabla='clientes' and detalle->>'nombre' like 'TMP Neg%'`);
});

describe("centro de mando: cada rol ve su parte, por sede", () => {
  it("la dueña recibe las siete secciones y las alertas", async () => {
    const r = await rpc(tok.duena, "centro_mando", { p_tenant_id: T }); expect(r.status, JSON.stringify(r.body)).toBe(200);
    for (const k of ["alertas", "clientas", "operacion", "finanzas", "metas", "retencion", "adquisicion", "encuestas"]) expect(r.body, k).toHaveProperty(k);
    for (const k of ["leads_sin_contactar", "cuentas_sin_acceso", "consentimientos_pendientes", "paquetes_por_vencer"]) expect(r.body.alertas, k).toHaveProperty(k);
  });
  it("la dueña puede filtrar por sede y la cifra de la sede es menor o igual al total", async () => {
    const total = num((await rpc(tok.duena, "centro_mando", { p_tenant_id: T })).body.finanzas.neto);
    let suma = 0;
    for (const s of ["Centro", "Norte", "Sur"]) { const r = await rpc(tok.duena, "centro_mando", { p_tenant_id: T, p_sede_id: SEDE[s] }); expect(r.status).toBe(200); suma += num(r.body.finanzas.neto); }
    expect(suma).toBeLessThanOrEqual(total + 0.001);
  });
  it("la admin de Centro ve solo lo suyo: sin metas, retención, adquisición ni encuestas", async () => {
    const r = await rpc(tok.admin1, "centro_mando", { p_tenant_id: T }); expect(r.status).toBe(200);
    for (const k of ["metas", "retencion", "adquisicion", "encuestas"]) expect(r.body, k).not.toHaveProperty(k);
    const centro = (await rpc(tok.duena, "centro_mando", { p_tenant_id: T, p_sede_id: SEDE.Centro })).body;
    expect(num(r.body.finanzas.neto)).toBe(num(centro.finanzas.neto));
    expect(r.body.clientas.total).toBe(centro.clientas.total);
  });
  it("la admin de Centro y la gerencia regional no pueden pedir una sede que no es suya", async () => {
    expect((await rpc(tok.admin1, "centro_mando", { p_tenant_id: T, p_sede_id: SEDE.Norte })).status).toBe(400);
    expect((await rpc(tok.regional, "centro_mando", { p_tenant_id: T, p_sede_id: SEDE.Sur })).status).toBe(400);
    expect((await rpc(tok.regional, "centro_mando", { p_tenant_id: T, p_sede_id: SEDE.Norte })).status).toBe(200);
  });
  it("la contadora solo recibe finanzas agregadas, sin datos de clientas", async () => {
    const r = await rpc(tok.contadora, "centro_mando", { p_tenant_id: T }); expect(r.status).toBe(200);
    expect(Object.keys(r.body).sort()).toEqual(["finanzas", "hoy", "mes", "rol", "sede_id"]);
  });
  it("recepción, instructora y marketing no entran; tampoco una dueña de otro estudio", async () => {
    for (const a of ["recep1", "instr12", "marketing"]) expect((await rpc(tok[a], "centro_mando", { p_tenant_id: T })).status, a).toBe(400);
    expect((await rpc(tok["duena-una"], "centro_mando", { p_tenant_id: T })).status).toBe(400);
  });
});

describe("una sola regla de ingreso confirmado", () => {
  it("resumen financiero, IVA, atribución por sede y centro de mando dan la misma cifra", async () => {
    const a = (await rpc(tok.duena, "finanzas_atribucion", { p_tenant_id: T, p_desde: desde, p_hasta: hasta })).body;
    const fin = (await rpc(tok.duena, "kpi_finanzas_resumen", { p_tenant_id: T, p_desde: desde, p_hasta: hasta })).body;
    const iva = (await rpc(tok.duena, "kpi_iva_resumen", { p_tenant_id: T, p_desde: desde, p_hasta: hasta })).body;
    expect(num(fin.ingresos)).toBe(num(a.consolidado)); expect(num(iva.ingresos)).toBe(num(a.consolidado));
    expect(a.cuadra).toBe(true);
  });
  it("la contadora ve exactamente las mismas cifras que la dueña", async () => {
    const f = (al: string) => rpc(tok[al], "kpi_finanzas_resumen", { p_tenant_id: T, p_desde: desde, p_hasta: hasta });
    expect(num((await f("contadora")).body.ingresos)).toBe(num((await f("duena")).body.ingresos));
    expect((await f("recep1")).body).toBeNull();
  });
  it("la utilidad acumulada del balance es ingreso confirmado menos gastos operativos", async () => {
    const bal = (await rpc(tok.duena, "kpi_balance_general", { p_tenant_id: T })).body;
    const ic = num((await rpc(tok.duena, "kpi_finanzas_resumen", { p_tenant_id: T, p_desde: "2000-01-01", p_hasta: "2099-12-31" })).body.ingresos);
    const gastos = num(sql(`select coalesce(sum(monto),0) m from gastos where tenant_id='${T}' and etapa='operativo' and tipo in ('fijo','variable')`)[0].m);
    expect(num(bal.utilidad_acumulada)).toBeCloseTo(ic - gastos, 2);
  });
  it("los gastos de preinversión no entran en el IVA ni en la utilidad", async () => {
    const antes = (await rpc(tok.duena, "kpi_iva_resumen", { p_tenant_id: T, p_desde: desde, p_hasta: hasta })).body;
    const g = await rpc(tok.duena, "registrar_gasto", { p_tenant_id: T, p_sede_id: null, p_fecha: "2026-10-05", p_categoria: "TMP Neg preinversion", p_descripcion: "prueba", p_monto: 1000, p_tipo: "fijo", p_etapa: "preinversion" });
    expect(g.status, JSON.stringify(g.body)).toBe(200);
    const desp = (await rpc(tok.duena, "kpi_iva_resumen", { p_tenant_id: T, p_desde: desde, p_hasta: hasta })).body;
    sql(`delete from gastos where id='${g.body}'`);
    expect(num(desp.gastos_operativos)).toBe(num(antes.gastos_operativos));
    expect((await rpc(tok.duena, "registrar_gasto", { p_tenant_id: T, p_sede_id: null, p_fecha: "2026-10-05", p_categoria: "x", p_descripcion: "", p_monto: 1, p_tipo: "fijo", p_etapa: "otra" })).status).toBe(400);
  });
  it("la serie mensual usa la misma regla y respeta el alcance", async () => {
    const s = (await rpc(tok.duena, "finanzas_serie_confirmada", { p_tenant_id: T, p_meses: 3 })).body as { mes: string; neto: number }[];
    const mes = s[s.length - 1];
    const cm = (await rpc(tok.duena, "centro_mando", { p_tenant_id: T })).body;
    expect(num(mes.neto)).toBe(num(cm.finanzas.neto));
    expect((await rpc(tok.recep1, "finanzas_serie_confirmada", { p_tenant_id: T })).status).toBe(400);
    expect((await rpc(tok.admin1, "finanzas_serie_confirmada", { p_tenant_id: T, p_sede_id: SEDE.Norte })).status).toBe(400);
  });
});

describe("anulación de cobros: sale de todos los reportes y devuelve el código de descuento", () => {
  it("anular lo saca del ingreso, devuelve el uso del código y solo la dueña puede", async () => {
    const cl = sql(`select id from clientes where tenant_id='${T}' and nombre='FX Clienta Centro'`)[0].id;
    const paq = sql(`select id from paquetes where tenant_id='${T}' and nombre='FX Solo sede'`)[0].id;
    temp.codigo = sql(`insert into codigos_descuento(tenant_id,codigo,descuento_pct,aplica_a,activo,usos_maximos,usos_actuales) values ('${T}','TMPNEG10',10,'paquetes',true,5,1) returning id`)[0].id;
    const base = num((await rpc(tok.duena, "kpi_finanzas_resumen", { p_tenant_id: T, p_desde: desde, p_hasta: hasta })).body.ingresos);
    temp.membresia = sql(`insert into membresias(tenant_id,cliente_id,paquete_id,sede_venta_id,cobertura_tipo,clases_totales,clases_usadas,fecha_inicio,fecha_vencimiento,estado,pagada,precio_final,metodo_pago,confirmado_at,codigo_descuento_id)
      values ('${T}','${cl}','${paq}','${SEDE.Centro}','sede',4,0,current_date,current_date+30,'activa',true,90,'efectivo',now(),'${temp.codigo}') returning id`)[0].id;
    const con = num((await rpc(tok.duena, "kpi_finanzas_resumen", { p_tenant_id: T, p_desde: desde, p_hasta: hasta })).body.ingresos);
    expect(con).toBe(base + 90);
    for (const a of ["admin1", "recep1", "contadora"]) expect((await rpc(tok[a], "anular_cobro_membresia", { p_membresia_id: temp.membresia, p_motivo: "prueba" })).status, a).toBe(400);
    const r = await rpc(tok.duena, "anular_cobro_membresia", { p_membresia_id: temp.membresia, p_motivo: "Prueba de anulación" });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(num(sql(`select usos_actuales u from codigos_descuento where id='${temp.codigo}'`)[0].u)).toBe(0);
    const desp = num((await rpc(tok.duena, "kpi_finanzas_resumen", { p_tenant_id: T, p_desde: desde, p_hasta: hasta })).body.ingresos);
    expect(desp).toBe(base);                                                   // el cobro y su devolución se anulan entre sí
    const atr = (await rpc(tok.duena, "finanzas_atribucion", { p_tenant_id: T, p_desde: desde, p_hasta: hasta })).body;
    expect(num(atr.consolidado)).toBe(base); expect(atr.cuadra).toBe(true);
    expect((await rpc(tok.duena, "anular_cobro_membresia", { p_membresia_id: temp.membresia })).status).toBe(400);   // no se anula dos veces
  });
  it("en el reporte «Ingresos confirmados» lo anulado cuenta 0 y la suma de la columna es el ingreso confirmado", async () => {
    const db = cliente("duena");
    const t = await reportePorId("ingresos")!.ejecutar(db, { tenantId: T, desde, hasta, sedeId: null });
    const iCuenta = t.cabeceras.indexOf("Monto que cuenta"), iEstado = t.cabeceras.indexOf("Estado");
    const anul = t.filas.filter((f) => f[iEstado] === "Anulado"); expect(anul.length).toBeGreaterThan(0);
    for (const f of anul) expect(f[iCuenta]).toBe(0);
    const suma = t.filas.reduce((a, f) => a + num(f[iCuenta]), 0);
    const ic = num((await rpc(tok.duena, "finanzas_atribucion", { p_tenant_id: T, p_desde: desde, p_hasta: hasta })).body.consolidado);
    expect(suma).toBeCloseTo(ic, 2);
  });
});

describe("metas con avance real y proyección", () => {
  it("la dueña define metas, ve el avance y la proyección; nadie más puede", async () => {
    expect((await rpc(tok.admin1, "definir_meta", { p_tenant_id: T, p_mes: "2026-10-01", p_tipo: "reservas", p_meta: 100 })).status).toBe(400);
    expect(ok((await rpc(tok.duena, "definir_meta", { p_tenant_id: T, p_mes: "2026-10-15", p_tipo: "reservas", p_meta: 100 })).status)).toBe(true);
    expect((await rpc(tok.duena, "definir_meta", { p_tenant_id: T, p_mes: "2026-10-01", p_tipo: "inventada", p_meta: 1 })).status).toBe(400);
    expect((await rpc(tok.duena, "definir_meta", { p_tenant_id: T, p_mes: "2026-10-01", p_tipo: "reservas", p_meta: -5 })).status).toBe(400);
    const m = (await rpc(tok.duena, "metas_avance", { p_tenant_id: T, p_mes: "2026-10-20" })).body;
    const r = m.metas.find((x: any) => x.tipo === "reservas");
    expect(num(r.meta)).toBe(100); expect(r.proyeccion).toBeGreaterThanOrEqual(num(r.real));
    expect(m.dias_mes).toBe(31);
    expect((await rpc(tok.admin1, "metas_avance", { p_tenant_id: T })).status).toBe(400);
  });
});

describe("retención: lista de clientas para contactar", () => {
  it("responde para la dueña y la admin de sede con sus clientas; contadora, instructora y marketing no ven clientas", async () => {
    for (const a of ["duena", "admin1", "recep1"]) expect((await rpc(tok[a], "clientas_riesgo_fuga_lista", { p_tenant_id: T, p_dias: 1 })).status, a).toBe(200);
    for (const a of ["contadora", "instr12", "marketing"]) expect((await rpc(tok[a], "clientas_riesgo_fuga_lista", { p_tenant_id: T, p_dias: 1 })).body, a).toEqual([]);
    const norte = (await rpc(tok.admin2, "clientas_riesgo_fuga_lista", { p_tenant_id: T, p_dias: 1 })).body as { sede: string | null }[];
    for (const f of norte) expect(f.sede === null || f.sede === "Norte").toBe(true);
  });
});

describe("ficha de clienta: detalle, acceso, consentimiento y eliminación", () => {
  it("el detalle lo ve quien atiende a la clienta, no otra sede", async () => {
    const cl = sql(`select id from clientes where tenant_id='${T}' and nombre='FX Clienta Centro'`)[0].id;
    const r = await rpc(tok.duena, "cliente_detalle", { p_cliente_id: cl }); expect(r.status, JSON.stringify(r.body)).toBe(200);
    for (const k of ["pct_asistencia", "gasto_total", "dia_mas_concurrido", "tiene_acceso", "proximas"]) expect(r.body, k).toHaveProperty(k);
    expect((await rpc(tok.admin1, "cliente_detalle", { p_cliente_id: cl })).status).toBe(200);
    expect((await rpc(tok.recep3, "cliente_detalle", { p_cliente_id: cl })).status).toBe(400);
    expect((await rpc(tok["duena-una"], "cliente_detalle", { p_cliente_id: cl })).status).toBe(400);
  });
  it("reenviar el acceso y recordar el consentimiento: solo dueña o gerencia general, y no se envía nada real", async () => {
    temp.clienta = (await rpc(tok.recep1, "crear_cliente", { p_tenant_id: T, p_nombre: "TMP Neg Ficha", p_telefono: "5559990001", p_email: "tmp-neg-ficha@vim-prueba.test", p_sede_habitual_id: SEDE.Centro })).body;
    const id = String(sql(`select id from clientes where tenant_id='${T}' and nombre='TMP Neg Ficha'`)[0].id);
    expect((await rpc(tok.admin1, "reenviar_acceso_clienta", { p_cliente_id: id })).status).toBe(400);
    const a = await rpc(tok.duena, "reenviar_acceso_clienta", { p_cliente_id: id }); expect(a.status, JSON.stringify(a.body)).toBe(200);
    const b = await rpc(tok.duena, "reenviar_acceso_clienta", { p_cliente_id: id });
    expect(b.body).not.toBe(a.body);
    expect(num(sql(`select count(*) n from invitaciones_clienta where cliente_id='${id}' and not usado`)[0].n)).toBe(1);   // el enlace anterior queda invalidado
    expect((await rpc(tok.recep1, "recordar_consentimiento", { p_cliente_id: id })).status).toBe(400);
    expect(ok((await rpc(tok.duena, "recordar_consentimiento", { p_cliente_id: id })).status)).toBe(true);
    expect(ok((await rpc(tok.duena, "recordar_consentimiento", { p_cliente_id: id })).status)).toBe(true);
    const cola = sql(`select estado, canal from cola_mensajes where cliente_id='${id}' and tipo='consentimiento_pendiente'`);
    expect(cola.length).toBe(1); expect(cola[0].estado).toBe("pendiente");
  });
  it("eliminar la cuenta: solo la dueña, con el nombre exacto, deja auditoría y se frena si hay pagos", async () => {
    const id = String(sql(`select id from clientes where tenant_id='${T}' and nombre='TMP Neg Ficha'`)[0].id);
    expect((await rpc(tok.admin1, "eliminar_cliente", { p_cliente_id: id, p_confirmar_nombre: "TMP Neg Ficha" })).status).toBe(400);
    expect(msg(await rpc(tok.duena, "eliminar_cliente", { p_cliente_id: id, p_confirmar_nombre: "otro nombre" }))).toMatch(/nombre exacto/);
    const paq = sql(`select id from paquetes where tenant_id='${T}' and nombre='FX Solo sede'`)[0].id;
    const mem = sql(`insert into membresias(tenant_id,cliente_id,paquete_id,sede_venta_id,cobertura_tipo,clases_totales,fecha_inicio,fecha_vencimiento,estado,pagada,precio_final,confirmado_at) values ('${T}','${id}','${paq}','${SEDE.Centro}','sede',4,current_date,current_date+30,'activa',true,50,now()) returning id`)[0].id;
    expect(msg(await rpc(tok.duena, "eliminar_cliente", { p_cliente_id: id, p_confirmar_nombre: "TMP Neg Ficha" }))).toMatch(/pago/i);
    sql(`delete from membresias where id='${mem}'`);
    const r = await rpc(tok.duena, "eliminar_cliente", { p_cliente_id: id, p_confirmar_nombre: "tmp neg ficha" }); expect(ok(r.status), JSON.stringify(r.body)).toBe(true);
    expect(sql(`select 1 from clientes where id='${id}'`).length).toBe(0);
    expect(sql(`select 1 from admin_acciones_log where tenant_id='${T}' and tabla='clientes' and operacion='delete' and registro_id='${id}'`).length).toBe(1);
  });
});

describe("carritos abandonados: recordar solo encola", () => {
  it("la dueña recuerda un carrito activo; las demás no; no se duplica el mismo día", async () => {
    const cl = String((await (async () => { await rpc(tok.recep1, "crear_cliente", { p_tenant_id: T, p_nombre: "TMP Neg Carrito", p_telefono: "5559990002", p_email: null, p_sede_habitual_id: SEDE.Centro }); return sql(`select id from clientes where tenant_id='${T}' and nombre='TMP Neg Carrito'`)[0]; })()).id);
    temp.carrito = sql(`insert into carritos(tenant_id,cliente_id,estado) values ('${T}','${cl}','activo') returning id`)[0].id;
    for (const a of ["admin1", "recep1", "contadora"]) expect((await rpc(tok[a], "carrito_recordar", { p_carrito_id: temp.carrito })).status, a).toBe(400);
    expect(ok((await rpc(tok.duena, "carrito_recordar", { p_carrito_id: temp.carrito })).status)).toBe(true);
    expect(ok((await rpc(tok.duena, "carrito_recordar", { p_carrito_id: temp.carrito })).status)).toBe(true);
    expect(num(sql(`select count(*) n from cola_mensajes where cliente_id='${cl}' and tipo='carrito_abandonado'`)[0].n)).toBe(1);
    expect(sql(`select 1 from cola_mensajes where cliente_id='${cl}' and sent_at is not null`).length).toBe(0);
  });
});

describe("exportaciones: cada rol recibe lo suyo", () => {
  it("la dueña ejecuta los reportes del catálogo sin errores", async () => {
    const db = cliente("duena");
    for (const r of REPORTES) { const t = await r.ejecutar(db, { tenantId: T, desde, hasta, sedeId: null }); expect(t.cabeceras.length, r.id).toBeGreaterThan(0); for (const f of t.filas) expect(f.length, r.id).toBe(t.cabeceras.length); }
    expect(REPORTES.length).toBeGreaterThanOrEqual(25);
  });
  it("la contadora puede los financieros y no los nominales; recepción e instructora ninguno", () => {
    const de = (rol: string) => REPORTES.filter((r) => r.roles.includes(rol)).map((r) => r.id);
    for (const id of ["ingresos", "gastos", "iva", "balance", "resumen-financiero"]) expect(de("contadora")).toContain(id);
    for (const id of ["clientas", "riesgo-de-fuga", "leads", "ranking-clientas", "encuestas", "actividad"]) expect(de("contadora")).not.toContain(id);
    for (const rol of ["recepcion", "instructora", "marketing"]) expect(de(rol)).toEqual([]);
  });
  it("la admin de sede recibe cierres y ventas solo de su sede, y los reportes financieros globales no son suyos", async () => {
    const db = cliente("admin1");
    const t = await reportePorId("cierre-de-caja")!.ejecutar(db, { tenantId: T, desde, hasta, sedeId: null });
    const iS = t.cabeceras.indexOf("Sede"); for (const f of t.filas) expect(f[iS]).toBe("Centro");
    const v = await reportePorId("ingresos-por-sede")!.ejecutar(db, { tenantId: T, desde, hasta, sedeId: null });
    expect(v.filas.map((f) => f[0])).toEqual(["Centro"]);
    expect(reportePorId("ingresos")!.roles).not.toContain("admin_sede");
  });
  it("un reporte pedido por API directa sin permiso de base de datos tampoco devuelve datos", async () => {
    expect((await rpc(tok.recep1, "kpi_iva_resumen", { p_tenant_id: T, p_desde: desde, p_hasta: hasta })).body).toBeNull();
    expect((await rpc(tok.admin1, "kpi_balance_general", { p_tenant_id: T })).body).toBeNull();
    expect((await selectFrom(tok.instr12, "gastos", `?select=monto&tenant_id=eq.${T}`)).body).toEqual([]);
  });
  it("el CSV neutraliza fórmulas y conserva acentos", () => {
    const csv = aCsv({ cabeceras: ["Nombre"], filas: [["=SUMA(A1)"], ["María"], [-5]] });
    expect(csv).toContain("'=SUMA(A1)"); expect(csv).toContain("María"); expect(csv).toContain("-5"); expect(csv.charCodeAt(0)).toBe(0xfeff);
  });
});

describe("aislamiento entre estudios", () => {
  it("la dueña de otro estudio no obtiene nada de este con las funciones nuevas", async () => {
    for (const [fn, a] of [["metas_avance", { p_tenant_id: T }], ["finanzas_serie_confirmada", { p_tenant_id: T }], ["clientas_riesgo_fuga_lista", { p_tenant_id: T }], ["registrar_gasto_marketing", { p_tenant_id: T, p_mes: "2026-10-01", p_canal: "x", p_monto: 1 }]] as const) {
      const r = await rpc(tok["duena-una"], fn, a as Record<string, unknown>); expect(r.status === 400 || (Array.isArray(r.body) && r.body.length === 0), fn).toBe(true);
    }
    expect(T_UNA).not.toBe(T);
  });
});
