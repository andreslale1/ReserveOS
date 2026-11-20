import { crearDb } from "./cargar.mjs";
const U = (n) => `00000000-0000-4000-8000-0000000000${String(n).padStart(2, "0")}`;
const sumar = (n) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
async function como(db, uid, fn) { await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${uid}',false); select set_config('request.jwt.claim.role','authenticated',false)`); try { return await fn(); } finally { await db.exec("reset role"); } }
const intenta = async (f) => { try { return { ok: true, v: await f() }; } catch (e) { return { ok: false, e: String(e.message).slice(0, 120) }; } };
const { db, fallos } = await crearDb();
if (fallos.length) console.log("fallos de carga (estricto):", fallos.join(" | "));
const R = []; const ok = (n, b, x = "") => R.push(`${b ? "OK   " : "FALLA"}  ${n}${x ? "  → " + x : ""}`);
const D1 = sumar(-3), DOW1 = new Date(D1 + "T00:00:00Z").getUTCDay();
await db.exec(`
  insert into auth.users(id,email) values ('${U(1)}','d@t.test'),('${U(2)}','i@t.test'),('${U(3)}','o@t.test');
  insert into tenants(id,slug,name) values ('${U(10)}','ta','A'),('${U(20)}','tb','B');
  insert into sedes(id,tenant_id,name) values ('${U(11)}','${U(10)}','SA'),('${U(21)}','${U(20)}','SB');
  insert into tenant_memberships(id,tenant_id,user_id,role,nombre) values ('${U(15)}','${U(10)}','${U(1)}','duena','D'),('${U(16)}','${U(10)}','${U(2)}','instructora','I'),('${U(25)}','${U(20)}','${U(3)}','duena','O');
  insert into paquetes(id,tenant_id,nombre,precio,num_clases,vigencia_dias,cobertura) values ('${U(31)}','${U(10)}','P',700,8,60,'todas');
  insert into clientes(id,tenant_id,nombre,telefono) values ('${U(41)}','${U(10)}','C1','1'),('${U(42)}','${U(10)}','C2','2');
  insert into membresias(tenant_id,cliente_id,paquete_id,sede_venta_id,cobertura_tipo,estado,clases_totales,clases_usadas,fecha_inicio,fecha_vencimiento,pagada,precio_final,confirmado_at,metodo_pago)
    values ('${U(10)}','${U(41)}','${U(31)}','${U(11)}','todas','activa',8,0,current_date-5,current_date+60,true,700,now(),'efectivo');
  insert into horarios(id,tenant_id,sede_id,dia_semana,hora_inicio,hora_fin,nombre_clase,cupo_maximo) values ('${U(51)}','${U(10)}','${U(11)}',${DOW1},'07:00','08:00','Reformer',4);
  insert into reservas(tenant_id,sede_id,cliente_id,horario_id,fecha,estado,asistio) values ('${U(10)}','${U(11)}','${U(41)}','${U(51)}','${D1}','confirmada',true),('${U(10)}','${U(11)}','${U(42)}','${U(51)}','${D1}','cancelada',null);`);
const r = await intenta(() => como(db, U(1), () => db.query(`select panel_dashboard('${U(10)}', 30, null) d`)));
ok("la dueña obtiene el tablero", r.ok, r.e);
const d = r.v?.rows?.[0]?.d;
ok("30 días en la serie diaria", d?.por_dia?.length === 30, String(d?.por_dia?.length));
ok("cuenta 1 reserva confirmada y 1 cancelada", d?.totales?.reservas === 1 && d?.totales?.canceladas === 1, JSON.stringify(d?.totales));
ok("el mapa de calor tiene la hora 7", d?.calor?.some((c) => c.hora === 7 && c.n === 1));
ok("ocupación por clase: 1 reserva sobre los lugares de la ventana", d?.clases?.[0]?.reservas === 1 && d.clases[0].lugares >= 4, JSON.stringify(d?.clases?.[0]));
ok("la dueña ve ingresos por semana", d?.finanzas === true && d.semanas.some((s) => Number(s.ingreso) === 700), JSON.stringify(d?.semanas?.map((s) => s.ingreso)));
const ins = await intenta(() => como(db, U(2), () => db.query(`select panel_dashboard('${U(10)}', 30, null)`)));
ok("una instructora NO accede al tablero", !ins.ok, ins.e);
const otro = await intenta(() => como(db, U(3), () => db.query(`select panel_dashboard('${U(10)}', 30, null)`)));
ok("la dueña de otro estudio NO accede", !otro.ok, otro.e);
for (const x of R) console.log(x);
await db.close();
