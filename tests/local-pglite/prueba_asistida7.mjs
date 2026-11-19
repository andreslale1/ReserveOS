import { crearDb } from "./cargar.mjs";
const U = (n) => `00000000-0000-4000-8000-0000000000${String(n).padStart(2, "0")}`;
const sumar = (n) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const F = sumar(6), DOW = new Date(F + "T00:00:00Z").getUTCDay();
async function como(db, uid, fn) { await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${uid}',false); select set_config('request.jwt.claim.role','authenticated',false)`); try { return await fn(); } finally { await db.exec("reset role"); } }
const intenta = async (f) => { try { return { ok: true, v: await f() }; } catch (e) { return { ok: false, e: String(e.message).slice(0, 110) }; } };
const { db, fallos } = await crearDb();
if (fallos.length) console.log("fallos de carga (estricto):", fallos.join(" | "));
const R = []; const ok = (n, b, x = "") => R.push(`${b ? "OK   " : "FALLA"}  ${n}${x ? "  → " + x : ""}`);
await db.exec(`
  insert into auth.users(id,email) values ('${U(1)}','d@t.test'),('${U(2)}','r@t.test'),('${U(3)}','x@t.test');
  insert into tenants(id,slug,name) values ('${U(10)}','t','T');
  insert into tenant_entitlements(tenant_id,module_key,enabled,reason,effective_at) select '${U(10)}', key, true, 't', now() from module_catalog on conflict (tenant_id,module_key) do update set enabled=true, effective_at=now();
  insert into sedes(id,tenant_id,name) values ('${U(11)}','${U(10)}','Centro');
  insert into tenant_memberships(id,tenant_id,user_id,role,nombre) values ('${U(15)}','${U(10)}','${U(1)}','duena','D'),('${U(16)}','${U(10)}','${U(2)}','recepcion','R');
  insert into staff_sedes(tenant_membership_id,sede_id) values ('${U(16)}','${U(11)}');
  insert into configuracion_reservas(tenant_id,anticipacion_maxima_dias,max_reservas_dia_por_clienta) values ('${U(10)}',60,5) on conflict (tenant_id) do update set anticipacion_maxima_dias=60;
  insert into paquetes(id,tenant_id,nombre,precio,num_clases,vigencia_dias,cobertura) values ('${U(31)}','${U(10)}','P',700,8,60,'todas');
  insert into clientes(id,tenant_id,nombre,telefono) values ('${U(21)}','${U(10)}','A','1'),('${U(22)}','${U(10)}','B','2');
  insert into membresias(tenant_id,cliente_id,paquete_id,sede_venta_id,cobertura_tipo,estado,clases_totales,clases_usadas,fecha_inicio,fecha_vencimiento,pagada,precio_final,confirmado_at,metodo_pago)
    select '${U(10)}', c,'${U(31)}','${U(11)}','todas','activa',8,0,current_date-1,current_date+60,true,700,now(),'efectivo' from (values ('${U(21)}'::uuid),('${U(22)}'::uuid)) v(c);
  insert into horarios(id,tenant_id,sede_id,dia_semana,hora_inicio,hora_fin,nombre_clase,cupo_maximo) values ('${U(41)}','${U(10)}','${U(11)}',${DOW},'07:00','08:00','HYROX',3),('${U(42)}','${U(10)}','${U(11)}',${DOW},'12:00','13:00','Cupo',3);`);
await como(db, U(1), () => db.query(`select crear_recursos('${U(11)}',3)`));
await como(db, U(1), () => db.query(`select fijar_modo_reserva('${U(41)}','carril')`));
const rec = (await db.query(`select id from recursos order by orden`)).rows;
const sin = await intenta(() => como(db, U(2), () => db.query(`select admin_agregar_reserva('${U(21)}','${U(41)}','${F}')`)));
ok("recepción NO puede agregar a una clase por carril sin carril", !sin.ok, sin.e?.slice(0, 60));
const a = await intenta(() => como(db, U(2), () => db.query(`select admin_agendar_clase_carril('${U(21)}','${U(41)}','${F}','${rec[0].id}') r`)));
ok("recepción reserva a la clienta A en el Carril 1", a.ok, a.e);
const lane = (await db.query(`select r.nombre from reservas x join recursos r on r.id=x.recurso_id where x.cliente_id='${U(21)}'`)).rows[0]?.nombre;
ok("la reserva quedó con su carril", lane === "Carril 1", lane);
const b = await intenta(() => como(db, U(2), () => db.query(`select admin_agendar_clase_carril('${U(22)}','${U(41)}','${F}','${rec[0].id}') r`)));
ok("el mismo carril para B: rechazado y sin gastar su clase", !b.ok && Number((await db.query(`select clases_usadas u from membresias where cliente_id='${U(22)}'`)).rows[0].u) === 0, b.e?.slice(0, 70));
const out = await intenta(() => como(db, U(3), () => db.query(`select admin_agendar_clase_carril('${U(22)}','${U(41)}','${F}','${rec[1].id}')`)));
ok("una cuenta sin rol en el estudio no puede", !out.ok);
const n = await intenta(() => como(db, U(2), () => db.query(`select admin_agregar_reserva('${U(22)}','${U(42)}','${F}') r`)));
ok("la reserva asistida normal (por cupo) sigue funcionando", n.ok, n.e);
// cupo por fecha también en la reserva del personal: subir el cupo del día a 5 permite una 4.ª persona
await como(db, U(1), () => db.query(`select fijar_cupo_fecha('${U(42)}','${F}',1)`)).catch(() => {});
const extra = await intenta(() => como(db, U(2), () => db.query(`select admin_agregar_reserva('${U(21)}','${U(42)}','${F}') r`)));
ok("con el cupo del día en 1 y una persona dentro, la 2.ª se rechaza", !extra.ok, extra.e?.slice(0, 60));
for (const r of R) console.log(r);
await db.close();
