// MATRIZ DE PERMISOS SOBRE DATOS REALES, por API directa (sin pantallas). Cada rol entra con su sesión real y se comprueba lo que
// la base le entrega o le deniega. Estudios: VIM (3 sedes: Centro, Norte, Sur), un estudio de una sede y un estudio ajeno.
import { beforeAll, describe, expect, it } from "vitest";
import roles from "./fixtures/roles.json";
import { login, rpc, selectFrom } from "./helpers";
import { TEST_PASSWORD, USER_B_EMAIL } from "./fixtures";

const T: Record<string, string> = {};
const SEDE: Record<string, string> = {};     // "vim:Centro" -> id
const tok: Record<string, string> = {};
let tokB = "";
const email = (a: string) => `${a}@${roles.dominio}`;
const nombres = (b: unknown) => ((b as { nombre: string }[]) ?? []).map((r) => r.nombre).sort();
const fx = (b: unknown) => nombres(b).filter((n) => n.startsWith("FX"));

async function filas(token: string, tabla: string, q: string) {
  const r = await selectFrom(token, tabla, q);
  expect(r.status, `${tabla}: ${JSON.stringify(r.body).slice(0, 200)}`).toBe(200);
  return r.body as Record<string, unknown>[];
}
const idDe = async (alias: string, tk: "vim" | "una" = "vim") => (await filas(tok.duena, "tenant_memberships", `?select=id,user_id&tenant_id=eq.${T[tk]}&nombre=eq.FX ${alias}`))[0]?.id as string;

beforeAll(async () => {
  for (const u of roles.usuarios) tok[u.alias] = await login(email(u.alias), roles.password);
  for (const a of ["cli1", "cli2"]) tok[a] = await login(email(a), roles.password);
  tokB = await login(USER_B_EMAIL, TEST_PASSWORD);
  for (const [k, t] of Object.entries(roles.tenants)) {
    const tk = k === "vim" ? tok.duena : tok["duena-una"];
    T[k] = (await filas(tk, "tenants", `?select=id&slug=eq.${t.slug}`))[0].id as string;
    for (const s of await filas(tk, "sedes", `?select=id,name&tenant_id=eq.${T[k]}`)) SEDE[`${k}:${s.name}`] = s.id as string;
  }
});

describe("clientas: cada rol ve solo las que atiende", () => {
  const esperado: Record<string, string[]> = {
    duena: ["FX Clienta Centro", "FX Clienta Norte", "FX Clienta Sur", "FX Clienta Visita"],
    regional: ["FX Clienta Centro", "FX Clienta Norte", "FX Clienta Visita"],
    admin1: ["FX Clienta Centro", "FX Clienta Visita"],
    admin2: ["FX Clienta Norte", "FX Clienta Visita"],
    recep1: ["FX Clienta Centro", "FX Clienta Visita"],
    recep3: ["FX Clienta Sur"],
    instr12: [], instr3: [], contadora: [], marketing: [],
    multi: ["FX Clienta Centro", "FX Clienta Visita"],
  };
  for (const [alias, lista] of Object.entries(esperado)) {
    it(`${alias} ve exactamente ${lista.length} clienta(s) de VIM`, async () => {
      expect(fx(await filas(tok[alias], "clientes", `?select=nombre&tenant_id=eq.${T.vim}`))).toEqual(lista);
    });
  }
  it("el personal de otro estudio no ve ninguna clienta de VIM", async () => {
    expect(await filas(tok["duena-una"], "clientes", `?select=nombre&tenant_id=eq.${T.vim}`)).toEqual([]);
    expect(await filas(tokB, "clientes", `?select=nombre&tenant_id=eq.${T.vim}`)).toEqual([]);
  });
  it("una clienta solo se ve a sí misma", async () => {
    expect(nombres(await filas(tok.cli1, "clientes", `?select=nombre&tenant_id=eq.${T.vim}`))).toEqual(["FX Clienta Centro"]);
  });
  it("la recepción de Centro no puede abrir la ficha de una clienta de Sur ni por su id", async () => {
    const id = (await filas(tok.duena, "clientes", `?select=id&nombre=eq.FX Clienta Sur`))[0].id as string;
    expect(await filas(tok.recep1, "clientes", `?select=id,telefono&id=eq.${id}`)).toEqual([]);
  });
});

describe("reservas, paquetes, pagos y caja: alcance por sede", () => {
  const cuenta = async (alias: string, tabla: string, q: string) => (await filas(tok[alias], tabla, `?select=tenant_id&tenant_id=eq.${T.vim}${q}`)).length;
  const casos: [string, number, number, number, number][] = [
    // alias, reservas, membresías (efectivo), cierres de caja, cobros personalizados
    ["duena", 4, 4, 2, 2], ["contadora", 0, 4, 2, 2], ["regional", 3, 3, 1, 1], ["admin1", 1, 2, 1, 1], ["admin2", 2, 2, 0, 0],
    ["recep1", 1, 2, 1, 1], ["recep3", 1, 1, 1, 1], ["instr12", 3, 0, 0, 0], ["instr3", 1, 0, 0, 0], ["marketing", 0, 0, 0, 0],
  ];
  for (const [alias, r, m, c, k] of casos) {
    it(`${alias}: reservas=${r} paquetes=${m} cierres=${c} cobros=${k}`, async () => {
      expect(await cuenta(alias, "reservas", "&tipo=eq.prueba")).toBe(r);
      expect(await cuenta(alias, "membresias", "&metodo_pago=eq.efectivo&origen=eq.compra&precio_final=in.(100,160,220)")).toBe(m);
      expect(await cuenta(alias, "cierre_caja", "")).toBe(c);
      expect(await cuenta(alias, "cobros_personalizados", "&concepto=like.FX*")).toBe(k);
    });
  }
  it("la instructora ve el roster mínimo: nombre y asistencia, sin teléfono ni id de clienta", async () => {
    const hs = (await filas(tok.duena, "horarios", `?select=id,nombre_clase&tenant_id=eq.${T.vim}&nombre_clase=like.FX*`));
    const r = await rpc(tok.instr12, "roster_horarios", { p_horario_ids: hs.map((h) => h.id), p_fecha: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10) });
    expect(r.status).toBe(200);
    for (const f of r.body as { telefono: unknown; cliente_id: unknown }[]) { expect(f.telefono).toBeNull(); expect(f.cliente_id).toBeNull(); }
  });
  it("la instructora de Sur no recibe el roster de las clases de Centro", async () => {
    const h = (await filas(tok.duena, "horarios", `?select=id&tenant_id=eq.${T.vim}&nombre_clase=eq.FX Clase Centro`))[0].id;
    const fechas = [28, 29, 30, 31, 32].map((d) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10));
    let total = 0;
    for (const f of fechas) total += ((await rpc(tok.instr3, "roster_horarios", { p_horario_ids: [h], p_fecha: f })).body as unknown[]).length;
    expect(total).toBe(0);
  });
});

describe("finanzas por sede: la dueña ve las tres sedes por separado y consolidadas", () => {
  const hoy = new Date().toISOString().slice(0, 10);
  const ini = new Date(Date.now() - 400 * 864e5).toISOString().slice(0, 10);
  const atr = async (alias: string, tk: "vim" | "una" = "vim") => (await rpc(tok[alias], "finanzas_atribucion", { p_tenant_id: T[tk], p_desde: ini, p_hasta: hoy }));
  it("la dueña recibe 3 sedes y el consolidado cuadra con la suma de las sedes", async () => {
    const r = await atr("duena"); expect(r.status).toBe(200);
    const b = r.body as { sedes: { sede: string }[]; cuadra: boolean; consolidado: number };
    expect(b.sedes.map((s) => s.sede).sort()).toEqual(["Centro", "Norte", "Sur"]);
    expect(b.cuadra).toBe(true);
    expect(Number(b.consolidado)).toBeGreaterThan(0);
  });
  it("la contabilidad ve el mismo consolidado", async () => {
    const a = (await atr("duena")).body as { consolidado: number }, b = (await atr("contadora")).body as { consolidado: number };
    expect(b.consolidado).toBe(a.consolidado);
  });
  it("la gerencia regional ve solo Centro y Norte y NO recibe el consolidado del estudio", async () => {
    const b = (await atr("regional")).body as { sedes: { sede: string }[]; consolidado: number | null };
    expect(b.sedes.map((s) => s.sede).sort()).toEqual(["Centro", "Norte"]); expect(b.consolidado).toBeNull();
  });
  it("admin de Centro y recepción de Sur ven únicamente su sede", async () => {
    expect(((await atr("admin1")).body as { sedes: { sede: string }[] }).sedes.map((s) => s.sede)).toEqual(["Centro"]);
    expect(((await atr("recep3")).body as { sedes: { sede: string }[] }).sedes.map((s) => s.sede)).toEqual(["Sur"]);
  });
  it("la instructora y marketing no pueden pedir finanzas; el estudio ajeno tampoco", async () => {
    for (const a of ["instr12", "marketing"]) expect((await atr(a)).status).toBe(400);
    expect((await atr("duena-una")).status).toBe(400);
    const r = await rpc(tok["duena-una"], "finanzas_atribucion", { p_tenant_id: T.vim, p_desde: ini, p_hasta: hoy });
    expect(r.status).toBe(400);
  });
  it("la recepción de Sur no puede ver ni cerrar la caja de Centro", async () => {
    expect((await rpc(tok.recep3, "caja_esperado_del_dia", { p_tenant_id: T.vim, p_sede_id: SEDE["vim:Centro"], p_fecha: hoy })).status).toBe(400);
    expect((await rpc(tok.recep3, "cerrar_caja", { p_tenant_id: T.vim, p_sede_id: SEDE["vim:Centro"], p_fecha: hoy, p_efectivo_contado: 0, p_tarjeta_contado: 0, p_transferencia_contado: 0 })).status).toBe(400);
    expect((await rpc(tok.recep1, "caja_esperado_del_dia", { p_tenant_id: T.vim, p_sede_id: SEDE["vim:Centro"], p_fecha: hoy })).status).toBe(200);
  });
  it("gastos: cada sede ve solo los suyos", async () => {
    const r = await rpc(tok.duena, "registrar_gasto", { p_tenant_id: T.vim, p_sede_id: SEDE["vim:Norte"], p_fecha: hoy, p_categoria: "FX prueba", p_descripcion: "alcance", p_monto: 10, p_tipo: "variable", p_metodo_pago: null });
    expect(r.status).toBe(200);
    expect((await filas(tok.admin1, "gastos", `?select=id&categoria=eq.FX prueba`)).length).toBe(0);
    expect((await filas(tok.admin2, "gastos", `?select=id&categoria=eq.FX prueba`)).length).toBe(1);
    expect((await filas(tok.contadora, "gastos", `?select=id&categoria=eq.FX prueba`)).length).toBe(1);
    await rpc(tok.duena, "eliminar_gasto", { p_gasto_id: r.body });
  });
});

describe("estudios: personal en más de un estudio y estudio ajeno", () => {
  it("una persona de personal en dos estudios tiene dos membresías separadas y ve cada estudio con su rol", async () => {
    expect((await filas(tok.multi, "tenant_memberships", `?select=tenant_id,role&user_id=not.is.null`)).filter((m) => [T.vim, T.una].includes(m.tenant_id as string)).length).toBeGreaterThanOrEqual(2);
    expect(fx(await filas(tok.multi, "clientes", `?select=nombre`))).toEqual(["FX Clienta Centro", "FX Clienta Visita"]);
    const ra = (await rpc(tok.multi, "finanzas_atribucion", { p_tenant_id: T.una, p_desde: "2026-01-01", p_hasta: "2026-12-31" }));
    expect(ra.status).toBe(200);
    expect(((ra.body as { sedes: { sede: string }[] }).sedes).map((s) => s.sede)).toEqual(["Unica"]);
  });
  it("el estudio ajeno no puede leer ni ejecutar nada de VIM", async () => {
    for (const t of ["reservas", "membresias", "cierre_caja", "pedidos", "pago_transacciones", "gastos"])
      expect(await filas(tokB, t, `?select=tenant_id&tenant_id=eq.${T.vim}`)).toEqual([]);
    for (const [fn, args] of [["crear_sede", { p_tenant_id: T.vim, p_nombre: "X" }], ["delegacion_crear", { p_tenant_id: T.vim, p_membership_id: null, p_rol: "recepcion", p_action: "P35", p_sede_ids: null, p_vence: null, p_motivo: "x" }]] as [string, Record<string, unknown>][])
      expect((await rpc(tokB, fn, args)).status).toBe(400);
  });
});

describe("estudio de una sola sede", () => {
  it("su dueña ve una sola sede, el consolidado cuadra y la recepción de VIM no ve nada de él", async () => {
    const r = await rpc(tok["duena-una"], "finanzas_atribucion", { p_tenant_id: T.una, p_desde: "2026-01-01", p_hasta: "2026-12-31" });
    expect(r.status).toBe(200);
    const b = r.body as { sedes: { sede: string }[]; cuadra: boolean };
    expect(b.sedes.map((x) => x.sede)).toEqual(["Unica"]); expect(b.cuadra).toBe(true);
    expect((await rpc(tok.recep1, "finanzas_atribucion", { p_tenant_id: T.una, p_desde: "2026-01-01", p_hasta: "2026-12-31" })).status).toBe(400);
  });
  it("su recepción no ve clientas de VIM y viceversa", async () => {
    expect(await filas(tok["recep-una"], "clientes", `?select=nombre&tenant_id=eq.${T.vim}`)).toEqual([]);
    expect(await filas(tok.recep1, "clientes", `?select=nombre&tenant_id=eq.${T.una}`)).toEqual([]);
  });
});
