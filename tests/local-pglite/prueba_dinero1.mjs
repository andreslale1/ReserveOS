import { fileURLToPath } from "node:url";
import { crearDb } from "./cargar.mjs";
const MIG = fileURLToPath(new URL("../../supabase/migrations/", import.meta.url));
const U = (n) => `00000000-0000-4000-8000-0000000000${String(n).padStart(2, "0")}`;
async function como(db, uid, fn) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${uid}',false); select set_config('request.jwt.claim.role','authenticated',false)`);
  try { return await fn(); } finally { await db.exec("reset role"); }
}
const intenta = async (f) => { try { return { ok: true, v: await f() }; } catch (e) { return { ok: false, e: String(e.message).slice(0, 110) }; } };

async function escenarios(db) {
  const out = {};
  await db.exec(`
    insert into auth.users(id,email) values ('${U(1)}','duena@t.test'),('${U(2)}','c1@t.test'),('${U(3)}','c2@t.test'),('${U(4)}','c3@t.test');
    insert into tenants(id,slug,name) values ('${U(10)}','t','Estudio T');
    insert into tenant_entitlements(tenant_id,module_key,enabled,reason,effective_at) select '${U(10)}', key, true, 'test', now() from module_catalog on conflict (tenant_id,module_key) do update set enabled=true, effective_at=now();
    insert into sedes(id,tenant_id,name) values ('${U(11)}','${U(10)}','Centro');
    insert into tenant_memberships(tenant_id,user_id,role,nombre) values ('${U(10)}','${U(1)}','duena','Dueña');
    insert into clientes(id,tenant_id,nombre,telefono,user_id,sede_habitual_id) values
      ('${U(21)}','${U(10)}','C1','5551','${U(2)}','${U(11)}'),('${U(22)}','${U(10)}','C2','5552','${U(3)}','${U(11)}'),('${U(23)}','${U(10)}','C3','5553','${U(4)}','${U(11)}');
    insert into paquetes(id,tenant_id,nombre,precio,num_clases,vigencia_dias,cobertura) values ('${U(31)}','${U(10)}','8 clases',700,8,30,'todas'),('${U(32)}','${U(10)}','4 clases',380,4,30,'todas');
    insert into horarios(id,tenant_id,sede_id,dia_semana,hora_inicio,hora_fin,nombre_clase,cupo_maximo) values ('${U(41)}','${U(10)}','${U(11)}',1,'07:00','08:00','Clase',8);
  `);
  // RES-01: dos solicitudes pendientes de la misma persona
  const s1 = await intenta(() => como(db, U(2), () => db.query(`select solicitar_membresia('${U(31)}','REF-111111') r`)));
  const s2 = await intenta(() => como(db, U(2), () => db.query(`select solicitar_membresia('${U(32)}','REF-222222') r`)));
  out["RES-01 segunda solicitud con una pendiente"] = s2.ok ? "PERMITIDA (regala otra clase)" : "bloqueada: " + s2.e;
  const m1 = (await db.query(`select id from membresias where cliente_id='${U(21)}' order by created_at limit 1`)).rows[0]?.id;
  // PAG-01: confirmar dos veces
  const c1 = await intenta(() => como(db, U(1), () => db.query(`select confirmar_pago_membresia('${m1}') r`)));
  await db.exec(`update membresias set fecha_vencimiento = current_date + 3 where id='${m1}'`);
  const c2 = await intenta(() => como(db, U(1), () => db.query(`select confirmar_pago_membresia('${m1}') r`)));
  const venc = (await db.query(`select (fecha_vencimiento - current_date) d from membresias where id='${m1}'`)).rows[0].d;
  out["PAG-01 reconfirmar un pago (vigencia restante: antes 3 días)"] = `${venc} días` + (venc > 3 ? "  ← EXTENDIÓ sin dinero" : "  ← intacta");
  // anulada no se reactiva
  await db.exec(`update membresias set estado='anulada', anulada_at=now() where id='${m1}'`);
  const c3 = await intenta(() => como(db, U(1), () => db.query(`select confirmar_pago_membresia('${m1}') r`)));
  const est = (await db.query(`select estado from membresias where id='${m1}'`)).rows[0].estado;
  out["PAG-01 confirmar una compra anulada"] = est === "activa" ? "REACTIVADA" : "sigue " + est + (c3.ok ? "" : " (" + c3.e.slice(0, 50) + ")");
  // RES-02: rechazar
  await como(db, U(3), () => db.query(`select solicitar_membresia('${U(31)}','REF-333333')`)).catch(() => {});
  const m2 = (await db.query(`select id from membresias where cliente_id='${U(22)}' limit 1`)).rows[0]?.id;
  const r2 = await intenta(() => como(db, U(1), () => db.query(`select rechazar_membresia_pendiente('${m2}','prueba') r`)));
  out["RES-02 rechazar una transferencia"] = r2.ok ? "funciona" : "FALLA: " + r2.e;
  // MEM-01: eliminar un pendiente NO debe cancelar la reserva de otra compra
  await db.exec(`insert into membresias(id,tenant_id,cliente_id,paquete_id,sede_venta_id,cobertura_tipo,estado,clases_totales,clases_usadas,fecha_inicio,fecha_vencimiento,pagada,precio_final,confirmado_at,metodo_pago)
    values ('${U(51)}','${U(10)}','${U(23)}','${U(31)}','${U(11)}','todas','activa',8,1,current_date,current_date+30,true,700,now(),'efectivo');`);
  await como(db, U(4), () => db.query(`select solicitar_membresia('${U(32)}','REF-444444')`)).catch(() => {});
  const pend = (await db.query(`select id from membresias where cliente_id='${U(23)}' and pagada=false limit 1`)).rows[0]?.id;
  await db.exec(`update membresias set clases_usadas=1 where id='${pend}'`);
  await db.exec(`insert into reservas(id,tenant_id,sede_id,horario_id,cliente_id,fecha,tipo,estado,membresia_id) values ('${U(61)}','${U(10)}','${U(11)}','${U(41)}','${U(23)}', current_date+14,'regular','confirmada','${U(51)}')`);
  const e = await intenta(() => como(db, U(1), () => db.query(`select eliminar_membresia_pendiente('${pend}') r`)));
  const rs = (await db.query(`select estado from reservas where id='${U(61)}'`)).rows[0].estado;
  out["MEM-01 eliminar un pendiente: reserva de OTRA compra pagada"] = rs === "cancelada" ? "CANCELADA por error" : "intacta" + (e.ok ? "" : " (eliminar: " + e.e.slice(0, 50) + ")");
  // FIN-01 / FIN-02
  const bruto0 = Number((await db.query(`select _ingreso_confirmado('${U(10)}', current_date - 1, current_date + 1) r`)).rows[0].r.bruto);
  await db.exec(`insert into pedidos(id,tenant_id,sede_entrega_id,cliente_id,estado,metodo_pago,total,pagado_at) values ('${U(71)}','${U(10)}','${U(11)}','${U(21)}','pagado','tarjeta',1000, now());
    insert into pedido_items(tenant_id,pedido_id,tipo,paquete_id,nombre,cantidad,precio_unitario) values ('${U(10)}','${U(71)}','paquete','${U(31)}','8 clases',1,700);
    insert into pedido_items(tenant_id,pedido_id,tipo,nombre,cantidad,precio_unitario) values ('${U(10)}','${U(71)}','producto','Botella',1,300);
    insert into membresias(tenant_id,cliente_id,paquete_id,sede_venta_id,cobertura_tipo,estado,clases_totales,clases_usadas,fecha_inicio,fecha_vencimiento,pagada,precio_final,confirmado_at,metodo_pago,origen)
      values ('${U(10)}','${U(21)}','${U(31)}','${U(11)}','todas','activa',8,0,current_date,current_date+30,true,700,now(),'tarjeta','compra');`);
  const ing = (await db.query(`select _ingreso_confirmado('${U(10)}', current_date - 1, current_date + 1) r`)).rows[0].r;
  // excluir la membresía pagada de C3 (51) y la confirmada de C1 del conteo: se compara solo el pedido
  const delta = Number(ing.bruto) - bruto0;
  out["FIN-01 venta de Q1,000 en la tienda (paquete Q700 + producto Q300): ingreso que suma"] = `Q${delta}` + (delta === 1000 ? "  ← correcto" : "  ← DOBLE CONTEO");
  await db.exec(`insert into cobros_personalizados(tenant_id,sede_id,cliente_id,concepto,monto,metodo_pago,confirmado_at) values ('${U(10)}','${U(11)}','${U(21)}','x',100,'efectivo','2026-11-19 02:00:00+00')`);
  const noche = (await db.query(`select _ingreso_confirmado('${U(10)}','2026-11-18','2026-11-18') r`)).rows[0].r;
  out["FIN-02 cobro de Q100 a las 20:00 del 18/11 (Guatemala)"] = Number(noche.otros) === 100 ? "aparece el 18/11" : "NO aparece el 18/11 (cae en el 19)";
  // ESP-02
  await db.exec(`insert into lista_espera(tenant_id,horario_id,cliente_id,fecha) values ('${U(10)}','${U(41)}','${U(21)}', current_date+7)`);
  const d = await intenta(() => db.exec(`insert into lista_espera(tenant_id,horario_id,cliente_id,fecha) values ('${U(10)}','${U(41)}','${U(21)}', current_date+7)`));
  out["ESP-02 misma persona dos veces en la espera"] = d.ok ? "DUPLICADA" : "rechazada";
  return out;
}

for (const [titulo, extra] of [["ANTES (sin el arreglo)", []], ["DESPUÉS (con la migración)", [{ ruta: MIG + "20261018050000_dinero_y_creditos_1.sql" }]]]) {
  const { db, fallos } = await crearDb(extra, ["20261018050000"]);
  if (fallos.length) console.log("  (avisos de carga:", fallos.slice(0, 3).join(" | "), ")");
  console.log(`\n=== ${titulo}`);
  const r = await escenarios(db);
  for (const [k, v] of Object.entries(r)) console.log(`  ${k}: ${v}`);
  await db.close();
}
