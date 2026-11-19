import { fileURLToPath } from "node:url";
import { createHmac } from "node:crypto";
import { crearDb } from "./cargar.mjs";
const MIG = fileURLToPath(new URL("../../supabase/migrations/", import.meta.url));
const U = (n) => `00000000-0000-4000-8000-0000000000${String(n).padStart(2, "0")}`;
const sumar = (n) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const F = sumar(5), DOW = new Date(F + "T00:00:00Z").getUTCDay();
async function como(db, uid, fn) { await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${uid}',false); select set_config('request.jwt.claim.role','authenticated',false)`); try { return await fn(); } finally { await db.exec("reset role"); } }
const intenta = async (f) => { try { return { ok: true, v: await f() }; } catch (e) { return { ok: false, e: String(e.message).slice(0, 100) }; } };
async function escenarios(db) {
  const out = {};
  await db.exec(`
    insert into auth.users(id,email) values ('${U(1)}','d@t.test'),('${U(2)}','c@t.test');
    insert into tenants(id,slug,name) values ('${U(10)}','t','T');
    insert into tenant_entitlements(tenant_id,module_key,enabled,reason,effective_at) select '${U(10)}', key, true, 't', now() from module_catalog on conflict (tenant_id,module_key) do update set enabled=true, effective_at=now();
    insert into sedes(id,tenant_id,name) values ('${U(11)}','${U(10)}','Centro');
    insert into tenant_memberships(tenant_id,user_id,role,nombre) values ('${U(10)}','${U(1)}','duena','D');
    insert into configuracion_reservas(tenant_id,anticipacion_maxima_dias,max_reservas_dia_por_clienta) values ('${U(10)}',60,5) on conflict (tenant_id) do update set anticipacion_maxima_dias=60;
    insert into paquetes(id,tenant_id,nombre,precio,num_clases,vigencia_dias,cobertura) values ('${U(31)}','${U(10)}','8',1000,8,30,'todas');
    insert into clientes(id,tenant_id,nombre,telefono,user_id,sede_habitual_id) values ('${U(21)}','${U(10)}','Cli','1','${U(2)}','${U(11)}'),('${U(22)}','${U(10)}','Otra','2',null,'${U(11)}'),('${U(23)}','${U(10)}','Otra2','3',null,'${U(11)}');
    insert into horarios(id,tenant_id,sede_id,dia_semana,hora_inicio,hora_fin,nombre_clase,cupo_maximo) values ('${U(41)}','${U(10)}','${U(11)}',${DOW},'07:00','08:00','A',5);`);
  // PAG-03 / PAG-04 con un proveedor firmado
  const secreto = "secreto-de-prueba";
  await db.exec(`insert into vault.secrets(id,name,secret) values ('${U(90)}','s','${secreto}'); insert into integracion_pagos(tenant_id,proveedor,activo,secret_id) values ('${U(10)}','recurrente',true,'${U(90)}');`);
  const hook = async (obj) => { const cuerpo = JSON.stringify({ ts: Math.floor(Date.now() / 1000), ...obj }); const firma = createHmac("sha256", secreto).update(cuerpo).digest("hex");
    return intenta(() => db.query(`select pago_webhook('t','recurrente','${firma}', $1::text) r`, [cuerpo])); };
  const nuevaTx = async (id, mem) => db.exec(`insert into membresias(id,tenant_id,cliente_id,paquete_id,sede_venta_id,cobertura_tipo,estado,clases_totales,clases_usadas,fecha_inicio,fecha_vencimiento,pagada,precio_final,metodo_pago) values ('${mem}','${U(10)}','${U(21)}','${U(31)}','${U(11)}','todas','activa',1,0,current_date,current_date+30,false,1000,'tarjeta');
    insert into pago_transacciones(id,tenant_id,sede_venta_id,cliente_id,paquete_id,membresia_id,tipo,proveedor,monto,moneda,estado) values ('${id}','${U(10)}','${U(11)}','${U(21)}','${U(31)}',null,'membresia','recurrente',1000,'GTQ','iniciado')`);
  await db.exec(`delete from membresias where id='${U(70)}'`).catch(() => {});
  await db.exec(`insert into pago_transacciones(id,tenant_id,sede_venta_id,cliente_id,paquete_id,tipo,proveedor,monto,moneda,estado) values ('${U(80)}','${U(10)}','${U(11)}','${U(21)}','${U(31)}','membresia','recurrente',1000,'GTQ','iniciado')`);
  const h1 = await hook({ event_id: "e1", type: "payment.succeeded", reference: U(80) });  // SIN monto
  const m1 = (await db.query(`select count(*) n from membresias where cliente_id='${U(21)}' and pagada=true`)).rows[0].n;
  out["PAG-03 evento de pago FIRMADO pero SIN monto"] = !h1.ok ? "error: " + h1.e : Number(m1) > 0 ? "CONFIRMÓ la compra (Q1,000) sin validar monto" : "no confirma → " + JSON.stringify(h1.v.rows[0].r.resultado);
  // PAG-04: reembolso total del proveedor sobre una compra confirmada
  await db.exec(`insert into membresias(id,tenant_id,cliente_id,paquete_id,sede_venta_id,cobertura_tipo,estado,clases_totales,clases_usadas,fecha_inicio,fecha_vencimiento,pagada,precio_final,confirmado_at,metodo_pago) values ('${U(71)}','${U(10)}','${U(21)}','${U(31)}','${U(11)}','todas','activa',8,0,current_date,current_date+30,true,1000,now(),'tarjeta');
    insert into pago_transacciones(id,tenant_id,sede_venta_id,cliente_id,paquete_id,membresia_id,tipo,proveedor,monto,moneda,estado) values ('${U(81)}','${U(10)}','${U(11)}','${U(21)}','${U(31)}','${U(71)}','membresia','recurrente',1000,'GTQ','confirmado')`);
  await hook({ event_id: "e2", type: "refund.succeeded", reference: U(81), amount: 1000 });
  const est = (await db.query(`select estado from membresias where id='${U(71)}'`)).rows[0].estado;
  out["PAG-04 el proveedor devuelve Q1,000 (reembolso total): ¿el paquete sigue activo?"] = est === "activa" ? "SÍ, activo (dinero devuelto y clases siguen)" : "queda " + est;
  await db.exec(`insert into membresias(id,tenant_id,cliente_id,paquete_id,sede_venta_id,cobertura_tipo,estado,clases_totales,clases_usadas,fecha_inicio,fecha_vencimiento,pagada,precio_final,confirmado_at,metodo_pago) values ('${U(72)}','${U(10)}','${U(21)}','${U(31)}','${U(11)}','todas','activa',8,0,current_date,current_date+30,true,1000,now(),'tarjeta');
    insert into pago_transacciones(id,tenant_id,sede_venta_id,cliente_id,paquete_id,membresia_id,tipo,proveedor,monto,moneda,estado) values ('${U(82)}','${U(10)}','${U(11)}','${U(21)}','${U(31)}','${U(72)}','membresia','recurrente',1000,'GTQ','confirmado')`);
  await hook({ event_id: "e3", type: "refund.succeeded", reference: U(82), amount: 100 });
  const est2 = (await db.query(`select estado from membresias where id='${U(72)}'`)).rows[0].estado;
  out["PAG-04 reembolso PARCIAL de Q100: no debe anular el paquete"] = est2 === "activa" ? "sigue activo (correcto)" : "ANULÓ el paquete entero";
  // FIN-01 en el ranking
  await db.exec(`insert into pedidos(id,tenant_id,sede_entrega_id,cliente_id,estado,metodo_pago,total,pagado_at) values ('${U(73)}','${U(10)}','${U(11)}','${U(22)}','pagado','tarjeta',1000, now());
    insert into pedido_items(tenant_id,pedido_id,tipo,paquete_id,nombre,cantidad,precio_unitario) values ('${U(10)}','${U(73)}','paquete','${U(31)}','8',1,700);
    insert into pedido_items(tenant_id,pedido_id,tipo,nombre,cantidad,precio_unitario) values ('${U(10)}','${U(73)}','producto','Botella',1,300);
    insert into membresias(tenant_id,cliente_id,paquete_id,sede_venta_id,cobertura_tipo,estado,clases_totales,clases_usadas,fecha_inicio,fecha_vencimiento,pagada,precio_final,confirmado_at,metodo_pago,origen) values ('${U(10)}','${U(22)}','${U(31)}','${U(11)}','todas','activa',8,0,current_date,current_date+30,true,700,now(),'tarjeta','compra');`);
  const rk = await intenta(() => como(db, U(1), () => db.query(`select * from ranking_clientas_valor('${U(10)}')`)));
  const fila = rk.ok ? rk.v.rows.find((x) => x.nombre === "Otra") : null;
  out["Ranking de clientas (una venta de Q1,000 en tienda: paquete Q700 + producto Q300)"] = !rk.ok ? "FALLA: " + rk.e : fila ? `total_gastado = Q${fila.total_gastado}` + (Number(fila.total_gastado) === 1000 ? "  ← correcto" : "  ← DOBLE") : "sin fila";
  // HOR-01: cupo por debajo de lo reservado
  await db.exec(`insert into reservas(tenant_id,sede_id,horario_id,cliente_id,fecha,tipo,estado) values ('${U(10)}','${U(11)}','${U(41)}','${U(22)}','${F}','prueba','confirmada'),('${U(10)}','${U(11)}','${U(41)}','${U(23)}','${F}','prueba','confirmada')`);
  const ch = await intenta(() => como(db, U(1), () => db.query(`select actualizar_horario('${U(41)}', null, 1, null)`)));
  out["HOR-01 bajar el cupo a 1 con 2 reservas confirmadas"] = ch.ok ? "PERMITIDO (clase sobrevendida)" : "bloqueado";
  // ESP-06
  await db.exec(`insert into lista_espera(tenant_id,horario_id,cliente_id,fecha) values ('${U(10)}','${U(41)}','${U(21)}','${F}')`);
  const le = await intenta(() => como(db, U(2), () => db.query(`select * from mi_lista_espera()`)));
  out["ESP-06 la lista de espera del portal incluye la clase (horario_id)"] = le.ok && le.v.rows[0] && "horario_id" in le.v.rows[0] ? "sí" : "NO (la pantalla no puede mostrar «Salir de espera»)";
  return out;
}
for (const [titulo, extra] of [["ANTES (sin la tanda 3)", []], ["DESPUÉS (con la migración)", [{ ruta: MIG + "20261018070000_pagos_ranking_cupo_espera.sql" }]]]) {
  const { db, fallos } = await crearDb(extra, ["20261018070000"]);
  if (fallos.length) console.log("  (avisos de carga:", fallos.slice(0, 3).join(" | "), ")");
  console.log(`\n=== ${titulo}`);
  try { const r = await escenarios(db); for (const [k, v] of Object.entries(r)) console.log(`  ${k}: ${v}`); } catch (e) { console.log("  ERROR de prueba:", String(e.message).slice(0, 240)); }
  await db.close();
}
