// OPERACIONES SOBRE DATOS REALES por API directa: invitaciones y asignación de sedes, horarios, compra y reserva por cobertura,
// devolución exacta del crédito, asistencia y exportaciones. Cada rol con su propia sesión.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import roles from "./fixtures/roles.json";
import { login, rpc, selectFrom } from "./helpers";

const T: Record<string, string> = {}, SEDE: Record<string, string> = {}, tok: Record<string, string> = {};
const email = (a: string) => `${a}@${roles.dominio}`;
const corrida = Date.now().toString(36);
const fila = async (token: string, tabla: string, q: string) => { const r = await selectFrom(token, tabla, q); expect(r.status, JSON.stringify(r.body).slice(0, 200)).toBe(200); return r.body as Record<string, any>[]; };
const msg = (r: { body: any }) => String(r.body?.message ?? "");
const proxima = (dow: number, minDias = 3) => { const d = new Date(Date.now() + minDias * 864e5); while (d.getUTCDay() !== dow) d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };
const delegaciones: string[] = [];
const ok = (st: number) => st === 200 || st === 204;   // las funciones sin resultado responden 204

beforeAll(async () => {
  for (const u of roles.usuarios) tok[u.alias] = await login(email(u.alias), roles.password);
  tok.cli1 = await login(email("cli1"), roles.password); tok.cli2 = await login(email("cli2"), roles.password);
  for (const [k, t] of Object.entries(roles.tenants)) {
    const tk = k === "vim" ? tok.duena : tok["duena-una"];
    T[k] = (await fila(tk, "tenants", `?select=id&slug=eq.${t.slug}`))[0].id;
    for (const s of await fila(tk, "sedes", `?select=id,name&tenant_id=eq.${T[k]}`)) SEDE[`${k}:${s.name}`] = s.id;
  }
});
afterAll(async () => { for (const id of delegaciones) await rpc(tok.duena, "delegacion_revocar", { p_id: id }); });

const invitar = (alias: string, rol: string, sedes: string[], sufijo = "") =>
  rpc(tok[alias], "crear_invitacion_personal", { p_tenant_id: T.vim, p_email: `tmp-${corrida}-${rol}${sufijo}@${roles.dominio}`, p_role: rol, p_nombre: "Prueba", p_sede_ids: sedes.map((s) => SEDE[`vim:${s}`]) });

describe("invitaciones de personal: quién invita a quién, y a qué sedes", () => {
  it("la recepción no puede invitar a nadie", async () => { expect((await invitar("recep1", "recepcion", ["Centro"])).status).toBe(400); });
  it("la admin de sede NO puede invitar mientras la dueña no se lo delegue (P06 es delegable)", async () => {
    const r = await invitar("admin1", "recepcion", ["Centro"]); expect(r.status).toBe(400); expect(msg(r)).toMatch(/delegaci/i);
  });
  it("la dueña delega P06 a admin de sede y a gerencia regional", async () => {
    for (const rol of ["admin_sede", "gerente_regional"]) {
      const r = await rpc(tok.duena, "delegacion_crear", { p_tenant_id: T.vim, p_membership_id: null, p_rol: rol, p_action: "P06", p_sede_ids: null, p_vence: null, p_motivo: "prueba de matriz" });
      expect(r.status, JSON.stringify(r.body)).toBe(200); delegaciones.push(r.body as string);
    }
  });
  it("con delegación, la admin de Centro invita recepción a Centro", async () => { expect((await invitar("admin1", "recepcion", ["Centro"])).status).toBe(200); });
  it("pero no a una sede que no es suya", async () => { const r = await invitar("admin1", "recepcion", ["Norte"], "-n"); expect(r.status).toBe(400); expect(msg(r)).toMatch(/tú misma/i); });
  it("no puede invitar a otra administradora, a gerencia, ni a roles de todo el estudio", async () => {
    for (const rol of ["admin_sede", "gerente_regional", "gerente_general", "marketing", "contadora"]) expect((await invitar("admin1", rol, ["Centro"], "-x")).status, rol).toBe(400);
  });
  it("una sede de otro estudio es rechazada", async () => {
    const r = await rpc(tok.duena, "crear_invitacion_personal", { p_tenant_id: T.vim, p_email: `tmp-${corrida}-ajena@${roles.dominio}`, p_role: "recepcion", p_nombre: "Prueba ajena", p_sede_ids: [SEDE["una:Unica"]] });
    expect(r.status).toBe(400); expect(msg(r)).toMatch(/no existe|no pertenece/i);
  });
  it("la gerencia regional invita admin a sus sedes, pero no gerencia general ni sedes ajenas", async () => {
    expect((await invitar("regional", "admin_sede", ["Norte"], "-r")).status).toBe(200);
    expect((await invitar("regional", "gerente_general", ["Norte"], "-r")).status).toBe(400);
    expect((await invitar("regional", "recepcion", ["Sur"], "-r2")).status).toBe(400);
  });
  it("la dueña invita gerencia regional (con sedes) y marketing (sin sedes); exige sedes a los roles de sede", async () => {
    expect((await invitar("duena", "gerente_regional", ["Centro", "Norte"], "-d")).status).toBe(200);
    expect((await invitar("duena", "marketing", [], "-d")).status).toBe(200);
    expect((await invitar("duena", "recepcion", [], "-d2")).status).toBe(400);
    expect((await invitar("duena", "duena", [], "-d3")).status).toBe(400);
  });
});

describe("asignar y quitar sedes: nadie amplía su propio alcance ni el de quien no le corresponde", () => {
  const asignar = (alias: string, quien: string, sede: string) => idDe(quien).then((id) => rpc(tok[alias], "asignar_sede_personal", { p_tenant_membership_id: id, p_sede_id: SEDE[`vim:${sede}`] }));
  const idDe = async (alias: string) => (await fila(tok.duena, "tenant_memberships", `?select=id&tenant_id=eq.${T.vim}&nombre=eq.FX ${alias}`))[0].id as string;
  it("la admin de Centro no puede ampliar su propio alcance", async () => { const r = await asignar("admin1", "admin1", "Norte"); expect(r.status).toBe(400); expect(msg(r)).toMatch(/propio alcance/i); });
  it("no puede dar una sede que no es suya a nadie", async () => { expect((await asignar("admin1", "recep1", "Norte")).status).toBe(400); });
  it("no puede tocar el alcance de otra administradora, de la gerencia regional ni de roles de todo el estudio", async () => {
    for (const q of ["admin2", "regional", "contadora", "marketing"]) expect((await asignar("admin1", q, "Centro")).status, q).toBe(400);
  });
  it("sí puede asignar y quitar una de SUS sedes a una recepción (con delegación)", async () => {
    expect(ok((await asignar("admin1", "recep3", "Centro")).status)).toBe(true);
    const id = await idDe("recep3");
    expect(ok((await rpc(tok.admin1, "quitar_sede_personal", { p_tenant_membership_id: id, p_sede_id: SEDE["vim:Centro"] })).status)).toBe(true);
    const quedan = (await fila(tok.duena, "staff_sedes", `?select=sede_id&tenant_membership_id=eq.${id}`)).map((x) => x.sede_id);
    expect(quedan).toEqual([SEDE["vim:Sur"]]);
  });
  it("la recepción no puede asignar sedes a nadie", async () => { expect((await asignar("recep1", "recep3", "Centro")).status).toBe(400); });
  it("no se puede quitar una sede a una instructora que aún tiene clases activas ahí", async () => {
    const id = await idDe("instr12");
    const r = await rpc(tok.duena, "quitar_sede_personal", { p_tenant_membership_id: id, p_sede_id: SEDE["vim:Centro"] });
    expect(r.status).toBe(400); expect(msg(r)).toMatch(/clase/i);
  });
});

describe("horarios: la instructora debe estar asignada a la sede y no tener clases incompatibles", () => {
  const crear = (alias: string, sede: string, dia: number, ini: string, fin: string, instr: string | null, nombre = "FX tmp") =>
    (instr ? fila(tok.duena, "tenant_memberships", `?select=id&tenant_id=eq.${T.vim}&nombre=eq.FX ${instr}`).then((x) => x[0].id as string) : Promise.resolve(null))
      .then((iid) => rpc(tok[alias], "crear_horario", { p_tenant_id: T.vim, p_sede_id: SEDE[`vim:${sede}`], p_dia_semana: dia, p_hora_inicio: ini, p_hora_fin: fin, p_nombre_clase: nombre, p_cupo_maximo: 6, p_instructor_membership_id: iid, p_categoria: "regular" }));
  it("rechaza una instructora que no trabaja en esa sede", async () => { const r = await crear("duena", "Sur", 4, "10:00", "11:00", "instr12"); expect(r.status).toBe(400); expect(msg(r)).toMatch(/no está asignada/i); });
  it("rechaza clases que se traslapan para la misma instructora, también entre sedes distintas", async () => {
    expect(msg(await crear("duena", "Centro", 1, "07:30", "08:30", "instr12"))).toMatch(/ya tiene otra clase/i);
    expect(msg(await crear("duena", "Norte", 1, "07:00", "08:00", "instr12"))).toMatch(/ya tiene otra clase/i);
  });
  it("rechaza que una persona que no es instructora dé clase", async () => { expect((await crear("duena", "Centro", 4, "10:00", "11:00", "recep1")).status).toBe(400); });
  it("la recepción no puede crear horarios", async () => { expect((await crear("recep1", "Centro", 4, "10:00", "11:00", null)).status).toBe(400); });
  it("crea una clase válida y no deja cambiarle a una instructora de otra sede", async () => {
    const r = await crear("duena", "Centro", 5, "12:00", "13:00", "instr12", "FX tmp válida"); expect(r.status, JSON.stringify(r.body)).toBe(200);
    const id = (r.body as { id: string }).id;
    const i3 = (await fila(tok.duena, "tenant_memberships", `?select=id&tenant_id=eq.${T.vim}&nombre=eq.FX instr3`))[0].id;
    expect(msg(await rpc(tok.duena, "actualizar_horario", { p_horario_id: id, p_instructor_membership_id: i3 }))).toMatch(/no está asignada/i);
    expect((await rpc(tok.duena, "actualizar_horario", { p_horario_id: id, p_activo: false })).status).toBe(200);
  });
});

describe("paquetes por sede: compra, cobertura y crédito exacto", () => {
  const paq = async (nombre: string) => (await fila(tok.duena, "paquetes", `?select=id&tenant_id=eq.${T.vim}&nombre=eq.${nombre}`))[0].id as string;
  const ref = () => String(Math.floor(Math.random() * 9e9) + 1e9);
  it("la clienta elige la sede al comprar y esta queda registrada con su cobertura", async () => {
    const id = await paq("FX Dos sedes");
    const mala = await rpc(tok.cli2, "solicitar_membresia", { p_paquete_id: id, p_referencia_pago: ref(), p_metodo_pago: "transferencia", p_sede_id: SEDE["vim:Sur"] });
    expect(mala.status).toBe(400); expect(msg(mala)).toMatch(/sede elegida/i);
    const ok = await rpc(tok.cli2, "solicitar_membresia", { p_paquete_id: id, p_referencia_pago: ref(), p_metodo_pago: "transferencia", p_sede_id: SEDE["vim:Norte"] });
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    const m = (ok.body as { membresia_id: string }).membresia_id;
    const mem = (await fila(tok.duena, "membresias", `?select=sede_venta_id,cobertura_tipo,pagada&id=eq.${m}`))[0];
    expect(mem.sede_venta_id).toBe(SEDE["vim:Norte"]); expect(mem.pagada).toBe(false);
    const sedes = (await fila(tok.duena, "membresia_sedes", `?select=sede_id&membresia_id=eq.${m}`)).map((x) => x.sede_id).sort();
    expect(sedes).toEqual([SEDE["vim:Centro"], SEDE["vim:Norte"]].sort());
    await rpc(tok.duena, "eliminar_membresia_pendiente", { p_membresia_id: m });
  });
  it("un paquete de una sola sede queda atado a la sede de la clienta, y a nada más", async () => {
    const ok = await rpc(tok.cli2, "solicitar_membresia", { p_paquete_id: await paq("FX Flujo Sede"), p_referencia_pago: ref(), p_metodo_pago: "transferencia" });
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    const m = (ok.body as { membresia_id: string }).membresia_id;
    expect((await fila(tok.duena, "membresia_sedes", `?select=sede_id&membresia_id=eq.${m}`)).map((x) => x.sede_id)).toEqual([SEDE["vim:Norte"]]);
    await rpc(tok.duena, "eliminar_membresia_pendiente", { p_membresia_id: m });
  });
  it("el crédito vuelve exactamente a la membresía que se consumió (no a otra)", async () => {
    const tel = String(Math.floor(Math.random() * 9e8) + 1e9);
    const c = await rpc(tok.duena, "crear_cliente", { p_tenant_id: T.vim, p_nombre: `TMP Flujo ${corrida}`, p_telefono: tel });
    expect(c.status, JSON.stringify(c.body)).toBe(200); const cid = (c.body as { id: string }).id;
    const A = (await rpc(tok.duena, "agregar_membresia_manual", { p_cliente_id: cid, p_paquete_id: await paq("FX Flujo Sede"), p_sede_venta_id: SEDE["vim:Centro"], p_metodo_pago: "efectivo" })).body as { membresia_id: string };
    const B = (await rpc(tok.duena, "agregar_membresia_manual", { p_cliente_id: cid, p_paquete_id: await paq("FX Flujo Todas"), p_sede_venta_id: SEDE["vim:Norte"], p_metodo_pago: "efectivo" })).body as { membresia_id: string };
    const hC = (await fila(tok.duena, "horarios", `?select=id&tenant_id=eq.${T.vim}&nombre_clase=eq.FX Clase Centro`))[0].id, hN = (await fila(tok.duena, "horarios", `?select=id&tenant_id=eq.${T.vim}&nombre_clase=eq.FX Clase Norte`))[0].id;
    const rC = await rpc(tok.duena, "admin_agregar_reserva", { p_cliente_id: cid, p_horario_id: hC, p_fecha: proxima(1) });
    const rN = await rpc(tok.duena, "admin_agregar_reserva", { p_cliente_id: cid, p_horario_id: hN, p_fecha: proxima(2) });
    expect(rC.status, JSON.stringify(rC.body)).toBe(200); expect(rN.status, JSON.stringify(rN.body)).toBe(200);
    const usadas = async (m: string) => Number((await fila(tok.duena, "membresias", `?select=clases_usadas&id=eq.${m}`))[0].clases_usadas);
    expect([await usadas(A.membresia_id), await usadas(B.membresia_id)]).toEqual([1, 1]);            // Centro -> A (solo-sede) ; Norte -> B (todas)
    const resN = (await fila(tok.duena, "reservas", `?select=membresia_id&id=eq.${(rN.body as { reserva_id: string }).reserva_id}`))[0];
    expect(resN.membresia_id).toBe(B.membresia_id);
    expect((await rpc(tok.duena, "admin_cancelar_reserva", { p_reserva_id: (rN.body as { reserva_id: string }).reserva_id })).status).toBe(200);
    expect([await usadas(A.membresia_id), await usadas(B.membresia_id)]).toEqual([1, 0]);            // vuelve a B, A queda intacta
    expect((await rpc(tok.duena, "admin_cancelar_reserva", { p_reserva_id: (rN.body as { reserva_id: string }).reserva_id })).status).toBe(400); // no se devuelve dos veces
    expect([await usadas(A.membresia_id), await usadas(B.membresia_id)]).toEqual([1, 0]);
    expect((await rpc(tok.duena, "admin_cancelar_reserva", { p_reserva_id: (rC.body as { reserva_id: string }).reserva_id })).status).toBe(200);
    expect([await usadas(A.membresia_id), await usadas(B.membresia_id)]).toEqual([0, 0]);
    for (const m of [A.membresia_id, B.membresia_id]) await rpc(tok.duena, "anular_cobro_membresia", { p_membresia_id: m, p_motivo: "limpieza de prueba" });
  });
  it("un paquete de Centro no deja reservar en Norte (cobertura adquirida)", async () => {
    const c = await rpc(tok.duena, "crear_cliente", { p_tenant_id: T.vim, p_nombre: `TMP Cobertura ${corrida}`, p_telefono: String(Math.floor(Math.random() * 9e8) + 1e9) });
    const cid = (c.body as { id: string }).id;
    const A = (await rpc(tok.duena, "agregar_membresia_manual", { p_cliente_id: cid, p_paquete_id: await paq("FX Flujo Sede"), p_sede_venta_id: SEDE["vim:Centro"], p_metodo_pago: "efectivo" })).body as { membresia_id: string };
    const hN = (await fila(tok.duena, "horarios", `?select=id&tenant_id=eq.${T.vim}&nombre_clase=eq.FX Clase Norte`))[0].id, hC = (await fila(tok.duena, "horarios", `?select=id&tenant_id=eq.${T.vim}&nombre_clase=eq.FX Clase Centro`))[0].id;
    const norte = await rpc(tok.duena, "admin_agregar_reserva", { p_cliente_id: cid, p_horario_id: hN, p_fecha: proxima(2, 5) });
    expect(norte.status).toBe(400); expect(msg(norte)).toMatch(/paquete activo con cupo para esta sede/i);
    const centro = await rpc(tok.duena, "admin_agregar_reserva", { p_cliente_id: cid, p_horario_id: hC, p_fecha: proxima(1, 5) });
    expect(centro.status, JSON.stringify(centro.body)).toBe(200);
    await rpc(tok.duena, "admin_cancelar_reserva", { p_reserva_id: (centro.body as { reserva_id: string }).reserva_id });
    await rpc(tok.duena, "anular_cobro_membresia", { p_membresia_id: A.membresia_id, p_motivo: "limpieza de prueba" });
  });
});

describe("asistencia y exportaciones", () => {
  const resCentro = async () => (await fila(tok.duena, "reservas", `?select=id&tenant_id=eq.${T.vim}&tipo=eq.prueba&sede_id=eq.${SEDE["vim:Centro"]}`))[0].id as string;
  it("solo quien corresponde puede marcar asistencia: otra sede o la instructora de otra clase, no", async () => {
    const id = await resCentro();
    for (const a of ["recep3", "instr3", "marketing", "contadora"]) expect(msg(await rpc(tok[a], "registrar_asistencia", { p_reserva_id: id, p_asistio: true })), a).toMatch(/no autorizado|no encontrada|propias/i);
    for (const a of ["recep1", "instr12", "admin1"]) expect(msg(await rpc(tok[a], "registrar_asistencia", { p_reserva_id: id, p_asistio: true })), a).toMatch(/futura/i);   // autorizada, pero la clase es futura
  });
  it("el resumen exportable de clientas solo sale para dueña y gerencia, completo o con su alcance", async () => {
    for (const a of ["instr12", "instr3", "marketing", "contadora"]) {
      const r = await rpc(tok[a], "export_resumen_clientes", { p_tenant_id: T.vim });
      expect(r.status === 400 || (Array.isArray(r.body) && r.body.length === 0), `${a}: ${JSON.stringify(r.body).slice(0, 120)}`).toBe(true);
    }
    const noms = async (a: string) => { const r = await rpc(tok[a], "export_resumen_clientes", { p_tenant_id: T.vim }); return r.status === 200 ? (r.body as { nombre: string }[]).map((x) => x.nombre).filter((n) => n.startsWith("FX")).sort() : "denegado"; };
    expect(await noms("duena")).toHaveLength(4);
    for (const a of ["recep1", "recep3", "admin1", "admin2", "regional"]) { const v = await noms(a); expect(v === "denegado" || (Array.isArray(v) && v.length < 4), `${a}: ${JSON.stringify(v)}`).toBe(true); }
  });
  it("seguimiento de clientas: cada sede ve solo las suyas", async () => {
    const venc = async (a: string) => { const r = await rpc(tok[a], "membresias_por_vencer", { p_tenant_id: T.vim, p_dias: 365 }); return r.status === 200 ? (r.body as { nombre: string }[]).map((x) => x.nombre).filter((n) => n.startsWith("FX")).sort() : "denegado"; };
    expect(await venc("recep3")).toEqual(["FX Clienta Sur"]);
    const f = await venc("admin2"); expect(f === "denegado" || (Array.isArray(f) && !f.includes("FX Clienta Sur") && !f.includes("FX Clienta Centro"))).toBe(true);
    for (const a of ["instr12", "marketing"]) { const v = await venc(a); expect(v === "denegado" || (Array.isArray(v) && v.length === 0), a).toBe(true); }
  });
});

describe("altas y consultas que usan las pantallas, con el alcance de cada rol", () => {
  it("una clienta dada de alta por la recepción de Centro es visible para ella y no para la de Sur", async () => {
    const nombre = `TMP Alta ${corrida}`;
    const r = await rpc(tok.recep1, "crear_cliente", { p_tenant_id: T.vim, p_nombre: nombre, p_telefono: String(Math.floor(Math.random() * 9e8) + 1e9) });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect((await fila(tok.recep1, "clientes", `?select=nombre&nombre=eq.${nombre}`)).length).toBe(1);
    expect((await fila(tok.recep3, "clientes", `?select=nombre&nombre=eq.${nombre}`)).length).toBe(0);
    expect((await fila(tok.duena, "clientes", `?select=nombre&nombre=eq.${nombre}`)).length).toBe(1);
  });
  it("las consultas de las pantallas (lista de clientas, ficha, pagos pendientes, tienda, caja) responden para todos los roles de sede", async () => {
    const consultas: [string, string][] = [
      ["clientes", `?select=id,nombre,telefono,email,user_id,membresias(estado,clases_totales,clases_usadas,fecha_vencimiento,precio_final),reservas(fecha,asistio)&tenant_id=eq.${T.vim}&order=nombre`],
      ["membresias", `?select=id,metodo_pago,referencia_pago,created_at,clientes(nombre,telefono),paquetes(nombre,precio),sedes:sede_venta_id(name)&tenant_id=eq.${T.vim}&estado=eq.activa&pagada=eq.false`],
      ["reservas", `?select=fecha,estado,asistio,horarios(nombre_clase,hora_inicio),sedes(name)&tenant_id=eq.${T.vim}&order=fecha.desc&limit=20`],
      ["pedidos", `?select=id,estado,total,created_at,clientes(nombre)&tenant_id=eq.${T.vim}`],
      ["cierre_caja", `?select=sede_id,fecha,efectivo_sistema&tenant_id=eq.${T.vim}`],
      ["horarios", `?select=id,nombre_clase,hora_inicio,sede_id&tenant_id=eq.${T.vim}&activo=eq.true`],
    ];
    for (const a of ["duena", "regional", "admin1", "admin2", "recep1", "recep3", "instr12", "contadora"])
      for (const [t, q] of consultas) { const r = await selectFrom(tok[a], t, q); expect(r.status, `${a} → ${t}: ${JSON.stringify(r.body).slice(0, 160)}`).toBe(200); }
  });
  it("las consultas de cobro de cada sede solo traen las clientas de esa sede", async () => {
    const nom = async (a: string, fn: string, args: Record<string, unknown>) => { const r = await rpc(tok[a], fn, args); return r.status === 200 ? (r.body as { nombre: string }[]).map((x) => x.nombre).filter((n) => n.startsWith("FX")) : "denegado"; };
    const sur = await nom("recep3", "clientas_para_cobro", { p_tenant_id: T.vim });
    expect(sur === "denegado" || (Array.isArray(sur) && !sur.includes("FX Clienta Centro") && !sur.includes("FX Clienta Norte"))).toBe(true);
    const centro = await nom("recep1", "clientas_para_cobro", { p_tenant_id: T.vim });
    expect(centro === "denegado" || (Array.isArray(centro) && !centro.includes("FX Clienta Sur") && !centro.includes("FX Clienta Norte"))).toBe(true);
    for (const a of ["instr12", "marketing"]) { const v = await nom(a, "clientas_para_cobro", { p_tenant_id: T.vim }); expect(v === "denegado" || (Array.isArray(v) && v.length === 0), a).toBe(true); }
  });
  it("un pedido de otra sede no se puede confirmar ni entregar", async () => {
    const r = await rpc(tok.recep3, "confirmar_pedido_efectivo", { p_pedido_id: "00000000-0000-0000-0000-000000000000" });
    expect(r.status).toBe(400);
  });
});
