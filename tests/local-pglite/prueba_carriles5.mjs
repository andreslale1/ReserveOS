import { fileURLToPath } from "node:url";
import { crearDb } from "./cargar.mjs";
const MIG = fileURLToPath(new URL("../../supabase/migrations/", import.meta.url));
const U = (n) => `00000000-0000-4000-8000-0000000000${String(n).padStart(2, "0")}`;
const sumar = (n) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const F = sumar(6), DOW = new Date(F + "T00:00:00Z").getUTCDay();
async function como(db, uid, fn) { await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${uid}',false); select set_config('request.jwt.claim.role','authenticated',false)`); try { return await fn(); } finally { await db.exec("reset role"); } }
const intenta = async (f) => { try { return { ok: true, v: await f() }; } catch (e) { return { ok: false, e: String(e.message).slice(0, 110) }; } };
const { db, fallos } = await crearDb();
if (fallos.length) console.log("fallos de carga (estricto):", fallos.join(" | "));
const R = []; const ok = (n, b, x = "") => R.push(`${b ? "OK   " : "FALLA"}  ${n}${x ? "  → " + x : ""}`);
await db.exec(`
  insert into auth.users(id,email) values ('${U(1)}','d@t.test'),('${U(2)}','a@t.test'),('${U(3)}','b@t.test'),('${U(4)}','c@t.test'),('${U(5)}','rec@t.test'),('${U(6)}','otro@t.test');
  insert into tenants(id,slug,name) values ('${U(10)}','t','Gym HYROX'),('${U(90)}','x','Otro gym');
  insert into tenant_entitlements(tenant_id,module_key,enabled,reason,effective_at) select t.id, key, true, 't', now() from module_catalog, (values ('${U(10)}'::uuid),('${U(90)}'::uuid)) t(id) on conflict (tenant_id,module_key) do update set enabled=true, effective_at=now();
  insert into sedes(id,tenant_id,name) values ('${U(11)}','${U(10)}','Centro'),('${U(91)}','${U(90)}','Otra');
  insert into tenant_memberships(id,tenant_id,user_id,role,nombre) values ('${U(15)}','${U(10)}','${U(1)}','duena','D'),('${U(18)}','${U(10)}','${U(5)}','recepcion','R'),('${U(19)}','${U(90)}','${U(6)}','duena','Otro');
  insert into staff_sedes(tenant_membership_id,sede_id) values ('${U(18)}','${U(11)}');
  insert into configuracion_reservas(tenant_id,anticipacion_maxima_dias,max_reservas_dia_por_clienta) values ('${U(10)}',60,5) on conflict (tenant_id) do update set anticipacion_maxima_dias=60;
  insert into paquetes(id,tenant_id,nombre,precio,num_clases,vigencia_dias,cobertura) values ('${U(31)}','${U(10)}','Pase 10',900,10,30,'todas');
  insert into clientes(id,tenant_id,nombre,telefono,user_id,sede_habitual_id) values ('${U(21)}','${U(10)}','A','1','${U(2)}','${U(11)}'),('${U(22)}','${U(10)}','B','2','${U(3)}','${U(11)}'),('${U(23)}','${U(10)}','C','3','${U(4)}','${U(11)}');
  insert into membresias(tenant_id,cliente_id,paquete_id,sede_venta_id,cobertura_tipo,estado,clases_totales,clases_usadas,fecha_inicio,fecha_vencimiento,pagada,precio_final,confirmado_at,metodo_pago)
   select '${U(10)}', c, '${U(31)}','${U(11)}','todas','activa',10,0,current_date-1,current_date+30,true,900,now(),'efectivo' from (values ('${U(21)}'::uuid),('${U(22)}'::uuid),('${U(23)}'::uuid)) v(c);
  insert into horarios(id,tenant_id,sede_id,dia_semana,hora_inicio,hora_fin,nombre_clase,cupo_maximo) values ('${U(41)}','${U(10)}','${U(11)}',${DOW},'07:00','08:00','HYROX Bloque A',2);`);
// crear carriles y activar el modo
const cr = await intenta(() => como(db, U(1), () => db.query(`select crear_recursos('${U(11)}', 4) n`)));
ok("la dueña crea 4 carriles", cr.ok && Number((await db.query(`select count(*) n from recursos where sede_id='${U(11)}'`)).rows[0].n) === 4, cr.e);
const recn = await intenta(() => como(db, U(5), () => db.query(`select crear_recursos('${U(11)}', 2)`)));
ok("recepción NO puede crear carriles", !recn.ok);
const ajeno = await intenta(() => como(db, U(6), () => db.query(`select crear_recursos('${U(11)}', 2)`)));
ok("la dueña de OTRO gimnasio no puede crear carriles aquí", !ajeno.ok);
const md = await intenta(() => como(db, U(1), () => db.query(`select fijar_modo_reserva('${U(41)}','carril')`)));
ok("la dueña pone la clase en modo carril", md.ok, md.e);
const rec = (await db.query(`select id, nombre from recursos where sede_id='${U(11)}' order by orden`)).rows;
// reservar
const sin = await intenta(() => como(db, U(2), () => db.query(`select agendar_clase('${U(41)}','${F}')`)));
ok("reservar SIN elegir carril en una clase por carril: bloqueado", !sin.ok, sin.e?.slice(0, 60));
const a = await intenta(() => como(db, U(2), () => db.query(`select agendar_clase_carril('${U(41)}','${F}','${rec[0].id}') r`)));
ok("A reserva el Carril 1", a.ok, a.e);
const b = await intenta(() => como(db, U(3), () => db.query(`select agendar_clase_carril('${U(41)}','${F}','${rec[0].id}') r`)));
ok("B pide el mismo Carril 1: rechazado con mensaje claro", !b.ok && /ya fue reservado/.test(b.e || ""), b.e?.slice(0, 70));
const antesB = Number((await db.query(`select count(*) n from reservas where cliente_id='${U(22)}' and estado='confirmada'`)).rows[0].n);
const usadasB = Number((await db.query(`select clases_usadas u from membresias where cliente_id='${U(22)}'`)).rows[0].u);
ok("el intento fallido de B no dejó reserva ni gastó su clase", antesB === 0 && usadasB === 0, `reservas=${antesB} usadas=${usadasB}`);
const b2 = await intenta(() => como(db, U(3), () => db.query(`select agendar_clase_carril('${U(41)}','${F}','${rec[1].id}') r`)));
ok("B reserva el Carril 2", b2.ok, b2.e);
// disponibilidad
const lst = await como(db, U(4), () => db.query(`select nombre, ocupado, mio from carriles_de_clase('${U(41)}','${F}')`));
ok("C ve la ocupación: 1 y 2 ocupados, 3 y 4 libres", lst.rows.length === 4 && lst.rows[0].ocupado && lst.rows[1].ocupado && !lst.rows[2].ocupado && !lst.rows[3].ocupado, JSON.stringify(lst.rows.map((x) => x.ocupado)));
const lstA = await como(db, U(2), () => db.query(`select nombre, mio from carriles_de_clase('${U(41)}','${F}')`));
ok("A ve su propio carril marcado", lstA.rows[0].mio === true && lstA.rows[1].mio === false);
const lstX = await como(db, U(6), () => db.query(`select * from carriles_de_clase('${U(41)}','${F}')`));
ok("una cuenta de OTRO gimnasio no ve los carriles", lstX.rows.length === 0);
// lista de espera: clase llena (cupo 2); C espera; A cancela → C entra con el carril libre
await como(db, U(4), () => db.query(`select unirse_lista_espera('${U(41)}','${F}')`)).catch((e) => R.push("INFO unirse: " + e.message.slice(0, 80)));
const ca = await intenta(() => como(db, U(2), () => db.query(`select cancelar_mi_reserva((select id from reservas where cliente_id='${U(21)}' and estado='confirmada' limit 1))`)));
ok("A cancela", ca.ok, ca.e);
const pr = (await db.query(`select r.nombre from reservas x join recursos r on r.id = x.recurso_id where x.cliente_id='${U(23)}' and x.estado='confirmada'`)).rows[0];
ok("C (en espera) fue promovida y recibió el Carril 1 liberado", pr?.nombre === "Carril 1", pr ? pr.nombre : "sin carril");
// cancelar libera el carril
const cb = await intenta(() => como(db, U(3), () => db.query(`select cancelar_mi_reserva((select id from reservas where cliente_id='${U(22)}' and estado='confirmada' limit 1))`)));
const libre = (await como(db, U(2), () => db.query(`select nombre, ocupado from carriles_de_clase('${U(41)}','${F}')`))).rows;
ok("al cancelar B, su Carril 2 queda libre", libre[1].ocupado === false);
for (const r of R) console.log(r);
await db.close();
