// SITIO PÚBLICO + REGISTRO AUTÓNOMO + SEGUIMIENTO DE PRUEBA + AVISOS + REFERIDOS, por API directa con sesión real.
// Estudios: VIM (3 sedes), estudio de una sede y estudio ajeno (user B). Todo lo que se crea aquí se borra al terminar.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import roles from "./fixtures/roles.json";
import { login, rpc, selectFrom } from "./helpers";
import { TEST_PASSWORD, USER_B_EMAIL } from "./fixtures";
import { destinoSeguro, slugSeguro } from "../web/lib/destino";
import nextConfig from "../web/next.config";
// @ts-expect-error módulo .mjs sin tipos
import { consulta } from "./escenarios/concurrencia.mjs";

const MGMT = process.env.SUPABASE_ACCESS_TOKEN ?? "";
const REF = process.env.SUPABASE_PROJECT_REF ?? "agkqppuhyltirrhngybq";
const env = Object.fromEntries(readFileSync(resolve(process.cwd(), "web/.env.local"), "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY, URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const sql = (q: string) => { const r = consulta(MGMT, REF, q); if (r && !Array.isArray(r) && r.message) throw new Error(String(r.message).slice(0, 300)); return r as Record<string, unknown>[]; };
const email = (a: string) => `${a}@${roles.dominio}`;
// Las clientas del fixture no tienen correo en la ficha: se identifican por la cuenta de acceso.
const CLI1 = `(select c.id from clientes c join auth.users u on u.id = c.user_id where u.email = '${"cli1@" + roles.dominio}')`;
const DOM = "publico-prueba.test", PASS = "PublicoPrueba2026!";
const tok: Record<string, string> = {};
let tokB = "", tVim = "", tUna = "";
const nuevos: string[] = [];   // ids de usuarios creados

async function crearUsuario(correo: string) {
  const r = await fetch(`${URL_}/auth/v1/admin/users`, { method: "POST", headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" }, body: JSON.stringify({ email: correo, password: PASS, email_confirm: true }) });
  const j = await r.json(); if (!j.id) throw new Error(`no se pudo crear ${correo}: ${JSON.stringify(j)}`);
  nuevos.push(j.id as string); return j.id as string;
}

beforeAll(async () => {
  if (!MGMT) throw new Error("Falta SUPABASE_ACCESS_TOKEN");
  for (const a of ["duena", "recep1", "recep3", "admin1", "instr12", "duena-una", "cli1", "cli2"]) tok[a] = await login(email(a), roles.password);
  tokB = await login(USER_B_EMAIL, TEST_PASSWORD);
  tVim = String(sql(`select id from tenants where slug='${roles.tenants.vim.slug}'`)[0].id);
  tUna = String(sql(`select id from tenants where slug='${roles.tenants.una.slug}'`)[0].id);
  sql(`delete from clientes where email like 'tmppub-%@${DOM}'`);
}, 120_000);

afterAll(async () => {
  const ids = sql(`select id from clientes where email like 'tmppub-%@${DOM}'`).map((r) => String(r.id));
  if (ids.length) {
    const l = ids.map((i) => `'${i}'`).join(",");
    sql(`delete from reservas where cliente_id in (${l})`);
    sql(`delete from membresia_sedes where membresia_id in (select id from membresias where cliente_id in (${l}))`);
    sql(`delete from membresias where cliente_id in (${l})`);
  }
  // bonos de referido que recibió la clienta 1 durante la prueba
  sql(`delete from membresia_sedes where membresia_id in (select id from membresias where origen='bono_referido' and cliente_id=${CLI1})`);
  sql(`delete from membresias where origen='bono_referido' and cliente_id=${CLI1}`);
  sql(`update clientes set credito_referido_otorgado=false where email like 'tmppub-%@${DOM}'`);
  sql(`delete from clientes where email like 'tmppub-%@${DOM}'`);
  sql(`delete from comunicados where titulo like 'TMP pub%'`);
  sql(`update contenido_sitio set hero_titulo_linea1=null, filosofia_visible=true where tenant_id='${tVim}' and hero_titulo_linea1 like 'TMP pub%'`);
  sql(`delete from configuracion_contacto where tenant_id='${tVim}' and whatsapp_numero='50255550000'`);
  for (const id of nuevos) await fetch(`${URL_}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } });
});

describe("página pública: lo que ve un visitante sin cuenta", () => {
  it("devuelve horarios, sedes, paquetes con precio y cobertura, y no filtra datos de clientas", async () => {
    const r = await rpc(null, "horarios_publicos", { p_slug: roles.tenants.vim.slug });
    expect(r.status).toBe(200);
    const b = r.body as { sedes: unknown[]; clases: unknown[]; paquetes: { nombre: string; precio: number; cobertura: string | null }[]; id: string };
    expect(b.sedes.length).toBe(3); expect(Array.isArray(b.paquetes)).toBe(true); expect(b.id).toBe(tVim);
    for (const p of b.paquetes) { expect(typeof p.precio).toBe("number"); expect(p.cobertura).not.toBeUndefined(); }
    const txt = JSON.stringify(r.body);
    expect(txt).not.toMatch(/FX Clienta|@vim-prueba\.test|5560010/);
  });
  it("un estudio inexistente o no activo responde vacío, no error con datos", async () => {
    expect((await rpc(null, "horarios_publicos", { p_slug: "no-existe-zzz" })).body).toBeNull();
  });
  it("cada estudio solo muestra lo suyo (aislamiento entre estudios)", async () => {
    const vim = JSON.stringify((await rpc(null, "horarios_publicos", { p_slug: roles.tenants.vim.slug })).body);
    const una = (await rpc(null, "horarios_publicos", { p_slug: roles.tenants.una.slug })).body as { sedes: { nombre: string }[]; paquetes: { id: string }[] };
    expect(una.sedes.map((s) => s.nombre)).toEqual(["Unica"]);
    for (const p of una.paquetes) expect(vim).not.toContain(p.id);
  });
  it("las funciones de gestión nuevas NO están abiertas al visitante sin cuenta", async () => {
    const z = "00000000-0000-0000-0000-000000000000";
    for (const [fn, args] of [["guardar_contenido_sitio", { p_tenant_id: z, p_datos: {} }], ["guardar_contacto_estudio", { p_tenant_id: z, p_whatsapp: "", p_instagram: "", p_facebook: "" }], ["leads_prueba_listar", { p_tenant_id: z }],
      ["lead_prueba_estado", { p_reserva_id: z, p_estado: "contactada" }], ["mis_comunicados", { p_tenant_id: z }], ["comunicado_marcar_visto", { p_comunicado_id: z }], ["comunicado_crear", { p_tenant_id: z, p_titulo: "x", p_mensaje: "y", p_audiencias: ["clientas"] }],
      ["mi_codigo_referido", { p_tenant_id: z }], ["registrar_clienta", { p_tenant_id: z, p_nombre: "x", p_telefono: "55555555" }], ["agendar_clase_prueba_propia", { p_horario_id: z, p_fecha: "2030-01-01" }]] as [string, Record<string, unknown>][]) {
      const r = await rpc(null, fn, args);
      expect([401, 403], `${fn}: ${JSON.stringify(r.body).slice(0, 120)}`).toContain(r.status);
    }
  });
});

describe("el estudio edita su página: solo dueña/gerencia, con límites", () => {
  it("la dueña guarda título y se ve en la página pública; apagar un bloque queda guardado", async () => {
    const r = await rpc(tok.duena, "guardar_contenido_sitio", { p_tenant_id: tVim, p_datos: { hero_titulo_linea1: "TMP pub título", filosofia_visible: false } });
    expect([200, 204]).toContain(r.status);
    const c = ((await rpc(null, "horarios_publicos", { p_slug: roles.tenants.vim.slug })).body as { contenido: Record<string, unknown> }).contenido;
    expect(c.hero_titulo_linea1).toBe("TMP pub título"); expect(c.filosofia_visible).toBe(false);
    await rpc(tok.duena, "guardar_contenido_sitio", { p_tenant_id: tVim, p_datos: { hero_titulo_linea1: "", filosofia_visible: true } });
  });
  it("recepción, instructora y la dueña de OTRO estudio no pueden editarla", async () => {
    for (const a of ["recep1", "admin1", "instr12", "duena-una"]) {
      const r = await rpc(tok[a], "guardar_contenido_sitio", { p_tenant_id: tVim, p_datos: { hero_lede: "x" } });
      expect(r.status, a).toBe(400);
    }
  });
  it("rechaza campos inexistentes, imágenes que no son https y textos gigantes", async () => {
    for (const d of [{ tenant_id: "x" }, { hero_imagen_url: "http://x.com/a.png" }, { hero_imagen_url: "javascript:alert(1)" }, { hero_lede: "x".repeat(2001) }]) {
      expect((await rpc(tok.duena, "guardar_contenido_sitio", { p_tenant_id: tVim, p_datos: d })).status).toBe(400);
    }
  });
  it("contacto: valida el número, solo la dueña lo cambia, y aparece en la página", async () => {
    expect((await rpc(tok.duena, "guardar_contacto_estudio", { p_tenant_id: tVim, p_whatsapp: "123", p_instagram: "", p_facebook: "" })).status).toBe(400);
    expect((await rpc(tok.duena, "guardar_contacto_estudio", { p_tenant_id: tVim, p_whatsapp: "x", p_instagram: "http://insta", p_facebook: "" })).status).toBe(400);
    expect((await rpc(tok.recep1, "guardar_contacto_estudio", { p_tenant_id: tVim, p_whatsapp: "50255550000", p_instagram: "", p_facebook: "" })).status).toBe(400);
    expect([200, 204]).toContain((await rpc(tok.duena, "guardar_contacto_estudio", { p_tenant_id: tVim, p_whatsapp: "+502 5555-0000", p_instagram: "", p_facebook: "" })).status);
    const b = (await rpc(null, "horarios_publicos", { p_slug: roles.tenants.vim.slug })).body as { contacto: { whatsapp: string } };
    expect(b.contacto.whatsapp).toBe("50255550000");
  });
});

describe("registro autónomo: ficha de clienta sin pedir datos innecesarios", () => {
  it("una persona nueva se registra sin género ni «cómo te enteraste», y queda ligada solo a ESE estudio", async () => {
    const correo = `tmppub-nueva@${DOM}`; await crearUsuario(correo); const t = await login(correo, PASS);
    const r = await rpc(t, "registrar_clienta", { p_tenant_id: tVim, p_nombre: "TMP Nueva", p_telefono: "55501001" });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const f = sql(`select genero, como_se_entero, tenant_id from clientes where email='${correo}'`);
    expect(f.length).toBe(1); expect(f[0].genero).toBeNull(); expect(f[0].como_se_entero).toBeNull(); expect(f[0].tenant_id).toBe(tVim);
    const ctx = (await rpc(t, "mis_contextos")).body as { tenant_id: string; es_clienta: boolean }[];
    expect(ctx.filter((c) => c.es_clienta).map((c) => c.tenant_id)).toEqual([tVim]);
  });
  it("si recepción ya había creado su ficha con ese correo, se FUSIONA (no se duplica)", async () => {
    const correo = `tmppub-fusion@${DOM}`;
    sql(`insert into clientes (tenant_id, nombre, email, telefono) values ('${tVim}', 'TMP Mostrador', '${correo}', '55501002')`);
    const antes = String(sql(`select id from clientes where email='${correo}'`)[0].id);
    await crearUsuario(correo); const t = await login(correo, PASS);
    expect((await rpc(t, "registrar_clienta", { p_tenant_id: tVim, p_nombre: "TMP Fusionada", p_telefono: "55501002" })).status).toBe(200);
    const filas = sql(`select id, nombre, user_id from clientes where email='${correo}'`);
    expect(filas.length).toBe(1); expect(filas[0].id).toBe(antes); expect(filas[0].user_id).not.toBeNull();
  });
  it("un teléfono ya usado por otra cuenta del mismo estudio se rechaza", async () => {
    const correo = `tmppub-dup@${DOM}`; await crearUsuario(correo); const t = await login(correo, PASS);
    const r = await rpc(t, "registrar_clienta", { p_tenant_id: tVim, p_nombre: "TMP Dup", p_telefono: "55501001" });
    expect(r.status).toBe(400); expect(JSON.stringify(r.body)).toMatch(/Ya existe una cuenta/);
  });
  it("el código de referido se guarda y el bono llega a quien invitó al pagarse el primer paquete (con cobertura de sedes)", async () => {
    const codigo = String((await rpc(tok.cli1, "mi_codigo_referido", { p_tenant_id: tVim })).body);
    expect(codigo).toMatch(/\w{4,}/);
    const correo = `tmppub-ref@${DOM}`; await crearUsuario(correo); const t = await login(correo, PASS);
    expect((await rpc(t, "registrar_clienta", { p_tenant_id: tVim, p_nombre: "TMP Referida", p_telefono: "55501003", p_codigo_referido: codigo })).status).toBe(200);
    const cli1 = String(sql(`select ${CLI1} as id`)[0].id);
    const ref = String(sql(`select id from clientes where email='${correo}'`)[0].id);
    expect(String(sql(`select referido_por from clientes where id='${ref}'`)[0].referido_por)).toBe(cli1);
    const pq = String(sql(`select id from paquetes where tenant_id='${tVim}' and activo order by precio limit 1`)[0].id);
    const bonosAntes = Number(sql(`select count(*) n from membresias where cliente_id='${cli1}' and origen='bono_referido'`)[0].n);
    const ins = () => sql(`insert into membresias (tenant_id, cliente_id, paquete_id, cobertura_tipo, clases_totales, clases_usadas, fecha_inicio, fecha_vencimiento, estado, metodo_pago, precio_final, pagada)
      select tenant_id, '${ref}', id, cobertura, num_clases, 0, current_date, current_date + 30, 'activa', 'efectivo', precio, true from paquetes where id='${pq}'`);
    ins();
    const bonos = sql(`select m.id, (select count(*) from membresia_sedes ms where ms.membresia_id = m.id) sedes from membresias m where m.cliente_id='${cli1}' and m.origen='bono_referido'`);
    expect(bonos.length).toBe(bonosAntes + 1); expect(Number(bonos[bonos.length - 1].sedes)).toBeGreaterThan(0);
    ins();   // una segunda compra de la referida no da otro bono
    expect(Number(sql(`select count(*) n from membresias where cliente_id='${cli1}' and origen='bono_referido'`)[0].n)).toBe(bonosAntes + 1);
    expect(Number((await rpc(tok.cli1, "contar_mis_referidos", { p_tenant_id: tVim })).body)).toBeGreaterThanOrEqual(1);
  });
  it("el código de referido es solo de quien lo pide, y otro estudio no lo obtiene", async () => {
    const a = String((await rpc(tok.cli1, "mi_codigo_referido", { p_tenant_id: tVim })).body), b = String((await rpc(tok.cli2, "mi_codigo_referido", { p_tenant_id: tVim })).body);
    expect(a).not.toBe(b);
    expect((await rpc(tokB, "mi_codigo_referido", { p_tenant_id: tVim })).body).toBeNull();
  });
});

describe("clase de prueba: reserva y seguimiento (sin contactar → contactada → convertida)", () => {
  let reserva = "", horario = "";
  it("la persona nueva reserva su clase de prueba y queda como «sin contactar»", async () => {
    const h = sql(`select h.id, h.dia_semana from horarios h join sedes s on s.id=h.sede_id where h.tenant_id='${tVim}' and s.name='Centro' and h.activo and h.categoria='regular' and h.fecha_especifica is null limit 1`)[0];
    expect(h, "el fixture necesita una clase regular en Centro").toBeTruthy(); horario = String(h.id);
    const hoy = new Date(Date.now() - 6 * 3600_000); let fecha = "";
    for (let i = 2; i < 12; i++) { const d = new Date(hoy.getTime() + i * 86_400_000); if (d.getUTCDay() === Number(h.dia_semana)) { fecha = d.toISOString().slice(0, 10); break; } }
    const correo = `tmppub-prueba@${DOM}`; await crearUsuario(correo); const t = await login(correo, PASS);
    expect((await rpc(t, "registrar_clienta", { p_tenant_id: tVim, p_nombre: "TMP Prueba", p_telefono: "55501004" })).status).toBe(200);
    const r = await rpc(t, "agendar_clase_prueba_propia", { p_horario_id: horario, p_fecha: fecha, p_cliente_id: null });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const f = sql(`select id, estado_lead, tipo from reservas where horario_id='${horario}' and cliente_id=(select id from clientes where email='${correo}')`)[0];
    expect(f.tipo).toBe("prueba"); expect(f.estado_lead).toBe("sin_contactar"); reserva = String(f.id);
  });
  it("la recepción de ESA sede la ve y la marca como contactada; la de otra sede no la ve ni la toca", async () => {
    const ver = async (a: string) => ((await rpc(tok[a], "leads_prueba_listar", { p_tenant_id: tVim })).body as { reserva_id: string }[] ?? []).map((x) => x.reserva_id);
    expect(await ver("recep1")).toContain(reserva); expect(await ver("duena")).toContain(reserva);
    expect(await ver("recep3")).not.toContain(reserva); expect(await ver("instr12")).not.toContain(reserva);
    expect((await rpc(tok.recep3, "lead_prueba_estado", { p_reserva_id: reserva, p_estado: "contactada" })).status).toBe(400);
    expect([200, 204]).toContain((await rpc(tok.recep1, "lead_prueba_estado", { p_reserva_id: reserva, p_estado: "contactada" })).status);
    expect(sql(`select estado_lead from reservas where id='${reserva}'`)[0].estado_lead).toBe("contactada");
  });
  it("«convertida» no se pone a mano: la pone sola la primera compra pagada", async () => {
    expect((await rpc(tok.duena, "lead_prueba_estado", { p_reserva_id: reserva, p_estado: "convertida" })).status).toBe(400);
    const cli = String(sql(`select cliente_id from reservas where id='${reserva}'`)[0].cliente_id);
    const pq = String(sql(`select id from paquetes where tenant_id='${tVim}' and activo order by precio limit 1`)[0].id);
    sql(`insert into membresias (tenant_id, cliente_id, paquete_id, cobertura_tipo, clases_totales, clases_usadas, fecha_inicio, fecha_vencimiento, estado, metodo_pago, precio_final, pagada)
      select tenant_id, '${cli}', id, cobertura, num_clases, 0, current_date, current_date + 30, 'activa', 'efectivo', precio, true from paquetes where id='${pq}'`);
    expect(sql(`select estado_lead from reservas where id='${reserva}'`)[0].estado_lead).toBe("convertida");
    expect((await rpc(tok.recep1, "lead_prueba_estado", { p_reserva_id: reserva, p_estado: "sin_contactar" })).status).toBe(400);
  });
  it("una clienta no puede hacer una segunda clase de prueba", async () => {
    const t = await login(`tmppub-prueba@${DOM}`, PASS);
    const r = await rpc(t, "agendar_clase_prueba_propia", { p_horario_id: horario, p_fecha: "2030-01-07", p_cliente_id: null });
    expect(r.status).toBe(400);
  });
});

describe("comunicados para la clienta", () => {
  let id = "";
  it("la dueña publica; la clienta del estudio lo ve y lo marca leído; la de otro estudio no lo ve", async () => {
    const c = await rpc(tok.duena, "comunicado_crear", { p_tenant_id: tVim, p_titulo: "TMP pub aviso", p_mensaje: "Mañana abrimos más tarde", p_audiencias: ["clientas"] });
    expect(c.status, JSON.stringify(c.body)).toBe(200); id = String(c.body);
    const mios = async (tk: string, t: string) => ((await rpc(tk, "mis_comunicados", { p_tenant_id: t })).body as { id: string; visto: boolean }[]) ?? [];
    const antes = (await mios(tok.cli1, tVim)).find((x) => x.id === id);
    expect(antes).toBeTruthy(); expect(antes!.visto).toBe(false);
    expect([200, 204]).toContain((await rpc(tok.cli1, "comunicado_marcar_visto", { p_comunicado_id: id })).status);
    expect((await mios(tok.cli1, tVim)).find((x) => x.id === id)!.visto).toBe(true);
    expect((await mios(tok.cli2, tVim)).find((x) => x.id === id)!.visto).toBe(false);   // lo suyo es suyo
    expect(await mios(tokB, tVim)).toEqual([]);
    expect((await rpc(tokB, "comunicado_marcar_visto", { p_comunicado_id: id })).status).toBe(400);
  });
  it("solo la dueña/gerencia publica, y solo para audiencias válidas; un aviso para instructoras no llega a clientas", async () => {
    for (const a of ["recep1", "admin1", "instr12", "cli1"]) expect((await rpc(tok[a], "comunicado_crear", { p_tenant_id: tVim, p_titulo: "TMP pub x", p_mensaje: "yyy", p_audiencias: ["clientas"] })).status, a).toBe(400);
    expect((await rpc(tok.duena, "comunicado_crear", { p_tenant_id: tVim, p_titulo: "TMP pub x", p_mensaje: "yyy", p_audiencias: ["todos-los-del-mundo"] })).status).toBe(400);
    const solo = await rpc(tok.duena, "comunicado_crear", { p_tenant_id: tVim, p_titulo: "TMP pub instructoras", p_mensaje: "Reunión", p_audiencias: ["instructoras"] });
    const vistos = ((await rpc(tok.cli1, "mis_comunicados", { p_tenant_id: tVim })).body as { id: string }[]).map((x) => x.id);
    expect(vistos).not.toContain(String(solo.body));
  });
});

describe("destinos seguros y cabeceras de incrustación", () => {
  it("el destino tras entrar/registrarse solo puede ser una ruta interna", () => {
    expect(destinoSeguro("/cuenta/clases?horario=1")).toBe("/cuenta/clases?horario=1");
    for (const malo of ["https://malo.com", "//malo.com", "/\\malo.com", "javascript:alert(1)", "", null, undefined, "/a\nb"]) expect(destinoSeguro(malo as string, "/cuenta")).toBe("/cuenta");
    expect(slugSeguro("vim-prueba")).toBe("vim-prueba"); expect(slugSeguro("../x")).toBeNull(); expect(slugSeguro("a b")).toBeNull();
  });
  it("solo /e/{slug} se puede incrustar; login, cuenta, panel, consola y API lo prohíben", async () => {
    const reglas = await (nextConfig.headers as () => Promise<{ source: string; headers: { key: string; value: string }[] }[]>)();
    const csp = (r: { headers: { key: string; value: string }[] }) => r.headers.find((h) => h.key === "Content-Security-Policy")?.value;
    const abierta = reglas.find((r) => r.source === "/e/:slug")!; expect(csp(abierta)).toBe("frame-ancestors *");
    expect(abierta.headers.find((h) => h.key === "X-Frame-Options")).toBeUndefined();
    const cerradas = reglas.filter((r) => r.source !== "/e/:slug"); expect(cerradas.length).toBeGreaterThanOrEqual(2);
    for (const r of cerradas) { expect(csp(r)).toBe("frame-ancestors 'none'"); expect(r.headers.find((h) => h.key === "X-Frame-Options")?.value).toBe("DENY"); }
    // la regla general excluye /e/ y cubre todo lo demás (login, cuenta, panel, owner, api)
    const general = new RegExp(`^${reglas.find((r) => r.source.startsWith("/(("))!.source.replace("/((?!e/).*)", "/((?!e/).*)")}$`);
    for (const ruta of ["/login", "/cuenta/clases", "/panel/hoy", "/owner/direccion", "/api/pagos/x/y", "/registro/vim-prueba", "/"]) expect(general.test(ruta), ruta).toBe(true);
    expect(general.test("/e/vim-prueba")).toBe(false);
  });
});
