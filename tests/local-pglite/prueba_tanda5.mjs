import { fileURLToPath } from "node:url";
import { crearDb } from "./cargar.mjs";
const MIG = fileURLToPath(new URL("../../supabase/migrations/", import.meta.url));
const U = (n) => `00000000-0000-4000-8000-0000000000${String(n).padStart(2, "0")}`;
const sumar = (n) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const F = sumar(6), DOW = new Date(F + "T00:00:00Z").getUTCDay();
async function como(db, uid, fn) { await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${uid}',false); select set_config('request.jwt.claim.role','authenticated',false)`); try { return await fn(); } finally { await db.exec("reset role"); } }
const intenta = async (f) => { try { return { ok: true, v: await f() }; } catch (e) { return { ok: false, e: String(e.message).slice(0, 100) }; } };
async function escenarios(db) {
  const out = {};
  await db.exec(`
    insert into auth.users(id,email) values ('${U(1)}','d@t.test');
    insert into tenants(id,slug,name) values ('${U(10)}','t','T');
    insert into tenant_entitlements(tenant_id,module_key,enabled,reason,effective_at) select '${U(10)}', key, true, 't', now() from module_catalog on conflict (tenant_id,module_key) do update set enabled=true, effective_at=now();
    insert into sedes(id,tenant_id,name) values ('${U(11)}','${U(10)}','Centro');
    insert into tenant_memberships(tenant_id,user_id,role,nombre) values ('${U(10)}','${U(1)}','duena','D');
    insert into configuracion_reservas(tenant_id,anticipacion_maxima_dias,max_reservas_dia_por_clienta) values ('${U(10)}',60,5) on conflict (tenant_id) do update set anticipacion_maxima_dias=60;
    insert into paquetes(id,tenant_id,nombre,precio,num_clases,vigencia_dias,cobertura) values ('${U(31)}','${U(10)}','8',1000,8,30,'todas');
    insert into clientes(id,tenant_id,nombre,telefono) values ('${U(21)}','${U(10)}','A','1'),('${U(22)}','${U(10)}','B','2');
    insert into horarios(id,tenant_id,sede_id,dia_semana,hora_inicio,hora_fin,nombre_clase,cupo_maximo) values ('${U(41)}','${U(10)}','${U(11)}',${DOW},'07:00','08:00','A',8),('${U(42)}','${U(10)}','${U(11)}',${DOW},'10:00','11:00','B',8);`);
  const mem = (id, cli) => db.exec(`insert into membresias(id,tenant_id,cliente_id,paquete_id,sede_venta_id,cobertura_tipo,estado,clases_totales,clases_usadas,fecha_inicio,fecha_vencimiento,pagada,precio_final,confirmado_at,metodo_pago) values ('${id}','${U(10)}','${cli}','${U(31)}','${U(11)}','todas','activa',8,1,current_date-1,current_date+30,true,1000,now(),'tarjeta')`);
  // PAG-05: reembolso parcial
  await mem(U(51), U(21));
  await db.exec(`insert into reembolsos(id,tenant_id,membresia_id,cliente_id,monto,motivo,solicitado_por_clienta) values ('${U(61)}','${U(10)}','${U(51)}','${U(21)}',100,'ajuste parcial',false)`);
  const rp = await intenta(() => como(db, U(1), () => db.query(`select reembolso_resolver('${U(61)}', true, 'ok')`)));
  const est = (await db.query(`select estado from membresias where id='${U(51)}'`)).rows[0].estado;
  out["PAG-05 reembolso PARCIAL de Q100 aprobado: ¿qué pasa con la compra de Q1,000?"] = !rp.ok ? "error: " + rp.e : est === "anulada" ? "ANULADA entera (pierde todas sus clases)" : "sigue vigente (correcto)";
  const ing = (await db.query(`select _ingreso_confirmado('${U(10)}', current_date - 1, current_date + 1) r`)).rows[0].r;
  out["PAG-05 el reembolso parcial resta del ingreso neto (Q1,000 - Q100)"] = `neto Q${ing.neto}` + (Number(ing.neto) === 900 ? "  ← correcto" : "  ← NO resta");
  // MEM-02: anular una compra con reservas de dos compras
  await mem(U(52), U(22)); await mem(U(53), U(22));
  await db.exec(`insert into reservas(id,tenant_id,sede_id,horario_id,cliente_id,fecha,tipo,estado,membresia_id) values ('${U(71)}','${U(10)}','${U(11)}','${U(41)}','${U(22)}','${F}','regular','confirmada','${U(52)}'),('${U(72)}','${U(10)}','${U(11)}','${U(42)}','${U(22)}','${F}','regular','confirmada','${U(53)}')`);
  const an = await intenta(() => como(db, U(1), () => db.query(`select anular_cobro_membresia('${U(52)}','prueba')`)));
  const r1 = (await db.query(`select estado from reservas where id='${U(71)}'`)).rows[0].estado, r2 = (await db.query(`select estado from reservas where id='${U(72)}'`)).rows[0].estado;
  out["MEM-02 anular la compra A (cliente con 2 compras): reserva de A / reserva de B"] = !an.ok ? "error: " + an.e : `A=${r1}, B=${r2}` + (r1 === "cancelada" && r2 === "confirmada" ? "  ← correcto" : "  ← INCORRECTO (debe cancelar solo la de A)");
  // COM-01 / COM-02
  await db.exec(`insert into comunicacion_preferencias(cliente_id,tenant_id,marketing_ok,email_ok,whatsapp_ok) values ('${U(21)}','${U(10)}',false,true,true) on conflict (cliente_id) do update set marketing_ok=false;
    insert into cola_mensajes(id,tenant_id,cliente_id,canal,destino,asunto,cuerpo,tipo,estado,intentos,proximo_intento) values
      ('${U(81)}','${U(10)}','${U(21)}','email','a@x.com','promo','hola','marketing','pendiente',0,now()),
      ('${U(82)}','${U(10)}','${U(22)}','email','b@x.com','recordatorio','hola','recordatorio','enviando',1,now()-interval '2 days');`);
  const tom = (await db.query(`select id from cola_tomar(50)`)).rows.map((x) => x.id);
  out["COM-02 promoción encolada de alguien que retiró su permiso de marketing"] = tom.includes(U(81)) ? "SE ENVÍA (sin consentimiento)" : "se cancela (correcto)";
  out["COM-01 mensaje atascado en «enviando» desde hace 2 días (el proceso se cayó)"] = tom.includes(U(82)) ? "se recupera y se reintenta" : "queda atascado para siempre";
  // SAS-01 / SAS-02
  await db.exec(`insert into plataforma_cobros(tenant_id,periodo,monto,estado,fecha_vencimiento,monto_pagado) values ('${U(10)}', date_trunc('month', current_date - interval '2 month')::date, 1000,'parcial', current_date - 10, 400);
    delete from reservas where tenant_id='${U(10)}';
    insert into reservas(tenant_id,sede_id,horario_id,cliente_id,fecha,tipo,estado) values ('${U(10)}','${U(11)}','${U(41)}','${U(22)}','${sumar(30)}','regular','confirmada');`);
  const at = (await db.query(`select _estudios_atencion() r`)).rows[0].r.find((x) => x.slug === "t");
  out["SAS-01 cobro vencido PARCIAL (Q1,000, pagó Q400): ¿aparece en la alerta?"] = Number(at.cobros_vencidos) === 1 ? `sí, saldo Q${at.monto_vencido}` : "NO aparece";
  out["SAS-02 estudio con una sola reserva dentro de 30 días: reservas de los últimos 7 días"] = `${at.reservas_7d}` + (Number(at.reservas_7d) === 0 ? "  ← correcto (alerta «sin actividad»)" : "  ← cuenta la reserva futura");
  return out;
}
for (const [titulo, extra] of [["ANTES", []], ["DESPUÉS", [{ ruta: MIG + "20261018100000_reembolsos_colas_alertas.sql" }]]]) {
  const { db, fallos } = await crearDb(extra, ["20261018100000"]);
  if (fallos.length) console.log("  (avisos de carga:", fallos.slice(0, 2).join(" | "), ")");
  console.log(`\n=== ${titulo}`);
  try { const r = await escenarios(db); for (const [k, v] of Object.entries(r)) console.log(`  ${k}: ${v}`); } catch (e) { console.log("  ERROR de prueba:", String(e.message).slice(0, 240)); }
  await db.close();
}
