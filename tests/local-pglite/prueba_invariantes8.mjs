// Invariantes del blueprint: aislamiento entre estudios en la BASE (no solo en el menú).
import { crearDb } from "./cargar.mjs";
const U = (n) => `00000000-0000-4000-8000-0000000000${String(n).padStart(2, "0")}`;
const sumar = (n) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const F = sumar(6), DOW = new Date(F + "T00:00:00Z").getUTCDay();
async function como(db, uid, fn) { await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${uid}',false); select set_config('request.jwt.claim.role','authenticated',false)`); try { return await fn(); } finally { await db.exec("reset role"); } }
const intenta = async (f) => { try { return { ok: true, v: await f() }; } catch (e) { return { ok: false, e: String(e.message).slice(0, 100) }; } };
const { db, fallos } = await crearDb();
if (fallos.length) console.log("fallos de carga (estricto):", fallos.join(" | "));
const R = []; const ok = (n, b, x = "") => R.push(`${b ? "OK   " : "FALLA"}  ${n}${x ? "  → " + x : ""}`);
await db.exec(`
  insert into auth.users(id,email) values ('${U(1)}','a@t.test'),('${U(2)}','b@t.test'),('${U(3)}','cli@t.test'),('${U(4)}','sop@t.test');
  insert into tenants(id,slug,name) values ('${U(10)}','ta','A'),('${U(20)}','tb','B');
  insert into tenant_entitlements(tenant_id,module_key,enabled,reason,effective_at) select t, key, true, 't', now() from module_catalog, (values ('${U(10)}'::uuid),('${U(20)}'::uuid)) v(t) on conflict (tenant_id,module_key) do update set enabled=true, effective_at=now();
  insert into sedes(id,tenant_id,name) values ('${U(11)}','${U(10)}','SA'),('${U(21)}','${U(20)}','SB');
  insert into tenant_memberships(tenant_id,user_id,role,nombre) values ('${U(10)}','${U(1)}','duena','DA'),('${U(20)}','${U(2)}','duena','DB');
  insert into configuracion_reservas(tenant_id,anticipacion_maxima_dias,max_reservas_dia_por_clienta) values ('${U(10)}',60,5),('${U(20)}',60,5) on conflict (tenant_id) do update set anticipacion_maxima_dias=60;
  insert into paquetes(id,tenant_id,nombre,precio,num_clases,vigencia_dias,cobertura) values ('${U(31)}','${U(10)}','PA',700,8,60,'todas'),('${U(32)}','${U(20)}','PB',700,8,60,'todas');
  insert into clientes(id,tenant_id,nombre,telefono,user_id) values ('${U(41)}','${U(10)}','CA','1','${U(3)}'),('${U(42)}','${U(20)}','CB','2',null);
  insert into membresias(id,tenant_id,cliente_id,paquete_id,sede_venta_id,cobertura_tipo,estado,clases_totales,clases_usadas,fecha_inicio,fecha_vencimiento,pagada,precio_final,confirmado_at,metodo_pago)
    values ('${U(51)}','${U(10)}','${U(41)}','${U(31)}','${U(11)}','todas','activa',8,0,current_date-1,current_date+60,true,700,now(),'efectivo'),
           ('${U(52)}','${U(20)}','${U(42)}','${U(32)}','${U(21)}','todas','activa',8,0,current_date-1,current_date+60,true,700,now(),'efectivo');
  insert into horarios(id,tenant_id,sede_id,dia_semana,hora_inicio,hora_fin,nombre_clase,cupo_maximo) values ('${U(61)}','${U(10)}','${U(11)}',${DOW},'07:00','08:00','A',5),('${U(62)}','${U(20)}','${U(21)}',${DOW},'07:00','08:00','B',5);
  insert into plataforma_staff(user_id,rol) values ('${U(4)}','soporte');`);

// 1) Estructura: no se puede unir datos de estudios distintos ni escribiendo directo en la base.
const m1 = await intenta(() => db.exec(`insert into membresias(tenant_id,cliente_id,paquete_id,sede_venta_id,cobertura_tipo,estado,clases_totales,clases_usadas,fecha_inicio,fecha_vencimiento,pagada,precio_final) values ('${U(20)}','${U(41)}','${U(32)}','${U(21)}','todas','activa',8,0,current_date,current_date+30,true,700)`));
ok("membresía del estudio B con clienta del estudio A: la base la rechaza", !m1.ok, m1.e);
const m2 = await intenta(() => db.exec(`insert into membresias(tenant_id,cliente_id,paquete_id,sede_venta_id,cobertura_tipo,estado,clases_totales,clases_usadas,fecha_inicio,fecha_vencimiento,pagada,precio_final) values ('${U(10)}','${U(41)}','${U(32)}','${U(11)}','todas','activa',8,0,current_date,current_date+30,true,700)`));
ok("membresía del estudio A con el paquete del estudio B: la base la rechaza", !m2.ok, m2.e);
const r1 = await intenta(() => db.exec(`insert into reservas(tenant_id,sede_id,cliente_id,horario_id,fecha,estado,membresia_id) values ('${U(10)}','${U(11)}','${U(41)}','${U(62)}','${F}','confirmada','${U(51)}')`));
ok("reserva de A en una clase del estudio B: la base la rechaza", !r1.ok, r1.e);
const r2 = await intenta(() => db.exec(`insert into reservas(tenant_id,sede_id,cliente_id,horario_id,fecha,estado,membresia_id) values ('${U(10)}','${U(11)}','${U(41)}','${U(61)}','${F}','confirmada','${U(52)}')`));
ok("reserva de A pagada con la membresía del estudio B: la base la rechaza", !r2.ok, r2.e);

// 2) Lectura y operación entre estudios
const ver = await como(db, U(1), () => db.query(`select (select count(*) from clientes) c, (select count(*) from membresias) m, (select count(*) from horarios) h`));
ok("la dueña de A ve solo lo de A (1 clienta, 1 membresía, 1 clase)", Number(ver.rows[0].c) === 1 && Number(ver.rows[0].m) === 1 && Number(ver.rows[0].h) === 1, JSON.stringify(ver.rows[0]));
const x1 = await intenta(() => como(db, U(1), () => db.query(`select admin_agregar_reserva('${U(42)}','${U(62)}','${F}')`)));
ok("la dueña de A no puede reservar en el estudio B", !x1.ok, x1.e);
const x2 = await intenta(() => como(db, U(1), () => db.query(`select fijar_cupo_fecha('${U(62)}','${F}',1)`)));
ok("la dueña de A no puede cambiar el cupo del estudio B", !x2.ok, x2.e);
const x3 = await intenta(() => como(db, U(3), () => db.query(`select agendar_clase('${U(62)}','${F}')`)));
ok("una clienta de A no puede reservar en el estudio B", !x3.ok, x3.e);

// 3) Personal de ReserveOS: sin datos de los estudios por defecto
const sop = await como(db, U(4), () => db.query(`select (select count(*) from clientes) c, (select count(*) from membresias) m, (select count(*) from reservas) r`));
ok("soporte de ReserveOS no ve clientas, membresías ni reservas de los estudios", Number(sop.rows[0].c) + Number(sop.rows[0].m) + Number(sop.rows[0].r) === 0, JSON.stringify(sop.rows[0]));
// 4) La API no debe ver dos relaciones entre las mismas tablas (si no, deja de poder traer datos relacionados).
const dup = await db.query(`select c.conrelid::regclass::text a, c.confrelid::regclass::text b, count(*) n from pg_constraint c where c.contype='f' and c.connamespace='public'::regnamespace and c.conrelid::regclass::text in ('membresias','reservas') and c.confrelid::regclass::text in ('clientes','paquetes','horarios','sedes','membresias') group by 1,2 having count(*) > 1`);
ok("membresías y reservas no tienen dos claves foráneas hacia la misma tabla (evita romper las consultas de la API)", dup.rows.length === 0, dup.rows.map((r) => `${r.a}->${r.b}`).join(", "));
for (const r of R) console.log(r);
await db.close();
