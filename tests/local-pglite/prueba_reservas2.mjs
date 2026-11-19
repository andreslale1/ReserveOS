import { fileURLToPath } from "node:url";
import { crearDb } from "./cargar.mjs";
const MIG = fileURLToPath(new URL("../../supabase/migrations/", import.meta.url));
const U = (n) => `00000000-0000-4000-8000-0000000000${String(n).padStart(2, "0")}`;
const sumar = (n) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dow = (iso) => new Date(iso + "T00:00:00Z").getUTCDay();
const F = sumar(4), DOW = dow(F);
async function como(db, uid, fn) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${uid}',false); select set_config('request.jwt.claim.role','authenticated',false)`);
  try { return await fn(); } finally { await db.exec("reset role"); }
}
const intenta = async (f) => { try { return { ok: true, v: await f() }; } catch (e) { return { ok: false, e: String(e.message).slice(0, 90) }; } };
const reservar = (db, uid, hor) => intenta(() => como(db, uid, () => db.query(`select agendar_clase('${hor}','${F}') r`)));

async function escenarios(db) {
  const out = {};
  const mem = (id, cli, paq, extra = "") => db.exec(`insert into membresias(id,tenant_id,cliente_id,paquete_id,sede_venta_id,cobertura_tipo,estado,clases_totales,clases_usadas,fecha_inicio,fecha_vencimiento,pagada,precio_final,confirmado_at,metodo_pago) values ('${id}','${U(10)}','${cli}','${paq}','${U(11)}','todas','activa',8,0,${extra || "current_date - 1, current_date + 30, true"},100,now(),'efectivo')`);
  await db.exec(`
    insert into auth.users(id,email) select U::uuid, 'u'||n||'@t.test' from (values ('${U(2)}',2),('${U(3)}',3),('${U(4)}',4),('${U(5)}',5),('${U(6)}',6)) v(U,n);
    insert into tenants(id,slug,name) values ('${U(10)}','t','Estudio T');
    insert into tenant_entitlements(tenant_id,module_key,enabled,reason,effective_at) select '${U(10)}', key, true, 'test', now() from module_catalog on conflict (tenant_id,module_key) do update set enabled=true, effective_at=now();
    insert into sedes(id,tenant_id,name) values ('${U(11)}','${U(10)}','Centro'),('${U(12)}','${U(10)}','Norte');
    insert into configuracion_reservas(tenant_id,anticipacion_maxima_dias,max_reservas_dia_por_clienta) values ('${U(10)}',60,5) on conflict (tenant_id) do update set anticipacion_maxima_dias=60, max_reservas_dia_por_clienta=5;
    insert into paquetes(id,tenant_id,nombre,precio,num_clases,vigencia_dias,cobertura,categoria) values ('${U(31)}','${U(10)}','8 clases',700,8,30,'todas','regular'),('${U(33)}','${U(10)}','Privado',100,4,30,'todas','privado');
    insert into clientes(id,tenant_id,nombre,telefono,user_id,sede_habitual_id) values
      ('${U(21)}','${U(10)}','C1','5551','${U(2)}','${U(11)}'),('${U(22)}','${U(10)}','C2','5552','${U(3)}','${U(11)}'),('${U(23)}','${U(10)}','C3','5553','${U(4)}','${U(11)}'),
      ('${U(24)}','${U(10)}','C4','5554','${U(5)}','${U(11)}'),('${U(25)}','${U(10)}','C5','5555','${U(6)}','${U(11)}'),
      ('${U(26)}','${U(10)}','H1','5556',null,'${U(11)}'),('${U(27)}','${U(10)}','W1','5557',null,'${U(12)}'),('${U(28)}','${U(10)}','H2','5558',null,'${U(11)}'),('${U(29)}','${U(10)}','W2','5559',null,'${U(11)}');
    insert into horarios(id,tenant_id,sede_id,dia_semana,hora_inicio,hora_fin,nombre_clase,cupo_maximo) values
      ('${U(41)}','${U(10)}','${U(11)}',${DOW},'07:00','08:00','A',8),('${U(42)}','${U(10)}','${U(12)}',${DOW},'07:30','08:30','B',8),
      ('${U(43)}','${U(10)}','${U(11)}',${DOW},'10:00','11:00','C',1),('${U(44)}','${U(10)}','${U(11)}',${DOW},'12:00','13:00','D',1),
      ('${U(45)}','${U(10)}','${U(11)}',${DOW},'14:00','15:00','E',8),('${U(46)}','${U(10)}','${U(11)}',${DOW},'16:00','17:00','F',1),
      ('${U(47)}','${U(10)}','${U(11)}',${DOW},'18:00','19:00','G',8);`);
  // RES-03
  await mem(U(51), U(21), U(33));
  const r3 = await reservar(db, U(2), U(41));
  out["RES-03 solo tiene un paquete PRIVADO e intenta una clase regular"] = r3.ok ? "PERMITIDA (gasta crédito privado)" : "bloqueada";
  // RES-04
  await mem(U(52), U(22), U(31), "current_date + 10, current_date + 40, true");
  const r4 = await reservar(db, U(3), U(41));
  out["RES-04 paquete que empieza en 10 días, reserva en 4"] = r4.ok ? "PERMITIDA (usa un periodo no iniciado)" : "bloqueada";
  // RES-05
  await db.exec(`insert into membresias(id,tenant_id,cliente_id,paquete_id,sede_venta_id,cobertura_tipo,estado,clases_totales,clases_usadas,fecha_inicio,fecha_vencimiento,pagada,precio_final,metodo_pago)
    values ('${U(53)}','${U(10)}','${U(23)}','${U(31)}','${U(11)}','todas','activa',1,0,current_date - 31,current_date - 1,false,700,'transferencia')`);
  const r5 = await reservar(db, U(4), U(41));
  out["RES-05 deuda VENCIDA (impagada, venció ayer) intenta reservar"] = r5.ok ? "PERMITIDA (gracia sobre un paquete vencido)" : "bloqueada";
  // RES-09
  await mem(U(54), U(24), U(31));
  await db.exec(`insert into reservas(id,tenant_id,sede_id,horario_id,cliente_id,fecha,tipo,estado,asistio,penalizada,confirmada_por_clienta_at) values ('${U(61)}','${U(10)}','${U(11)}','${U(41)}','${U(24)}','${F}','regular','cancelada',true,true,now())`);
  const r9 = await reservar(db, U(5), U(41));
  const fila = (await db.query(`select asistio, penalizada, confirmada_por_clienta_at is not null conf from reservas where id='${U(61)}'`)).rows[0];
  out["RES-09 reactivar una reserva que estaba cancelada con asistencia marcada"] = r9.ok ? (fila.asistio === true || fila.penalizada || fila.conf ? "NUEVA reserva ya marcada (asistió/penalizada/confirmó)" : "reiniciada (limpia)") : "error: " + r9.e;
  // RES-08
  await mem(U(55), U(25), U(31));
  const a = await reservar(db, U(6), U(41));
  const b = await reservar(db, U(6), U(42));
  out["RES-08 dos clases que se solapan el mismo día (07:00 Centro y 07:30 Norte)"] = !a.ok ? "no pudo reservar la 1.ª: " + a.e : b.ok ? "PERMITIDA (dos a la vez)" : "bloqueada";
  // ESP-01: espera con paquete que cubre SOLO otra sede
  await db.exec(`insert into membresias(id,tenant_id,cliente_id,paquete_id,sede_venta_id,cobertura_tipo,estado,clases_totales,clases_usadas,fecha_inicio,fecha_vencimiento,pagada,precio_final,confirmado_at,metodo_pago)
      values ('${U(56)}','${U(10)}','${U(27)}','${U(31)}','${U(12)}','sede','activa',8,0,current_date-1,current_date+30,true,700,now(),'efectivo');
    insert into membresia_sedes(membresia_id,sede_id) values ('${U(56)}','${U(12)}');
    insert into reservas(id,tenant_id,sede_id,horario_id,cliente_id,fecha,tipo,estado) values ('${U(62)}','${U(10)}','${U(11)}','${U(43)}','${U(26)}','${F}','prueba','confirmada');
    insert into lista_espera(tenant_id,horario_id,cliente_id,fecha) values ('${U(10)}','${U(43)}','${U(27)}','${F}');`);
  const c1 = await intenta(() => db.exec(`update reservas set estado='cancelada' where id='${U(62)}'`));
  const prom = (await db.query(`select count(*) n from reservas where horario_id='${U(43)}' and cliente_id='${U(27)}' and estado='confirmada'`)).rows[0].n;
  out["ESP-01 la espera usa un paquete que NO cubre la sede de la clase"] = !c1.ok ? "cancelar falló: " + c1.e : Number(prom) > 0 ? "PROMOVIDA con paquete de otra sede" : "no se promueve (correcto)";
  // ESP-03: candidato inválido no debe impedir cancelar
  await db.exec(`insert into membresias(id,tenant_id,cliente_id,paquete_id,sede_venta_id,cobertura_tipo,estado,clases_totales,clases_usadas,fecha_inicio,fecha_vencimiento,pagada,precio_final,confirmado_at,metodo_pago)
      values ('${U(57)}','${U(10)}','${U(29)}','${U(31)}','${U(11)}','todas','activa',8,0,current_date-1,current_date+30,true,700,now(),'efectivo');
    insert into reservas(id,tenant_id,sede_id,horario_id,cliente_id,fecha,tipo,estado) values ('${U(63)}','${U(10)}','${U(11)}','${U(44)}','${U(28)}','${F}','prueba','confirmada'),('${U(64)}','${U(10)}','${U(11)}','${U(45)}','${U(29)}','${F}','prueba','confirmada');
    insert into lista_espera(tenant_id,horario_id,cliente_id,fecha) values ('${U(10)}','${U(44)}','${U(29)}','${F}');
    update configuracion_reservas set max_reservas_dia_por_clienta = 1 where tenant_id='${U(10)}';`);
  const c3 = await intenta(() => db.exec(`update reservas set estado='cancelada' where id='${U(63)}'`));
  const est3 = (await db.query(`select estado from reservas where id='${U(63)}'`)).rows[0].estado;
  out["ESP-03 quien espera ya llegó a su máximo diario: ¿puede cancelar quien libera el cupo?"] = c3.ok ? "sí, la cancelación se conserva" : "NO: la cancelación se revierte (" + c3.e.slice(0, 60) + ")";
  await db.exec(`update configuracion_reservas set max_reservas_dia_por_clienta = 5 where tenant_id='${U(10)}'`);
  // ESP-04: módulo de espera apagado
  await db.exec(`insert into reservas(id,tenant_id,sede_id,horario_id,cliente_id,fecha,tipo,estado) values ('${U(65)}','${U(10)}','${U(11)}','${U(46)}','${U(28)}','${F}','prueba','confirmada');
    insert into lista_espera(tenant_id,horario_id,cliente_id,fecha) values ('${U(10)}','${U(46)}','${U(29)}','${F}');
    update tenant_entitlements set enabled=false where tenant_id='${U(10)}' and module_key='lista_espera';`);
  const c4 = await intenta(() => db.exec(`update reservas set estado='cancelada' where id='${U(65)}'`));
  out["ESP-04 módulo de lista de espera apagado: ¿se puede cancelar?"] = c4.ok ? "sí" : "NO: bloquea la cancelación (" + c4.e.slice(0, 70) + ")";
  await db.exec(`update tenant_entitlements set enabled=true where tenant_id='${U(10)}' and module_key='lista_espera'`);
  // TEN-01: estudio suspendido
  await mem(U(58), U(21), U(31));
  await db.exec(`delete from membresias where id='${U(51)}'`);
  await db.exec(`insert into reservas(id,tenant_id,sede_id,horario_id,cliente_id,fecha,tipo,estado) values ('${U(66)}','${U(10)}','${U(11)}','${U(47)}','${U(21)}','${F}','regular','cancelada')`);
  await db.exec(`update tenants set status='suspendido' where id='${U(10)}'`);
  const t1 = await reservar(db, U(2), U(47));
  out["TEN-01 estudio SUSPENDIDO: reactivar una reserva cancelada"] = t1.ok ? "PERMITIDA (elude el bloqueo)" : "bloqueada";
  return out;
}

for (const [titulo, extra] of [["ANTES (sin la tanda 2)", []], ["DESPUÉS (con la migración)", [{ ruta: MIG + "20261018060000_reservas_y_espera.sql" }]]]) {
  const { db, fallos } = await crearDb(extra, ["20261018060000"]);
  if (fallos.length) console.log("  (avisos de carga:", fallos.slice(0, 3).join(" | "), ")");
  console.log(`\n=== ${titulo}`);
  try { const r = await escenarios(db); for (const [k, v] of Object.entries(r)) console.log(`  ${k}: ${v}`); }
  catch (e) { console.log("  ERROR de prueba:", String(e.message).slice(0, 220)); }
  await db.close();
}
