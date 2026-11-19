import { fileURLToPath } from "node:url";
import { crearDb } from "./cargar.mjs";
const MIG = fileURLToPath(new URL("../../supabase/migrations/", import.meta.url));
const U = (n) => `00000000-0000-4000-8000-0000000000${String(n).padStart(2, "0")}`;
const sumar = (n) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const F = sumar(5), DOW = new Date(F + "T00:00:00Z").getUTCDay();
async function como(db, uid, fn) { await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${uid}',false); select set_config('request.jwt.claim.role','authenticated',false)`); try { return await fn(); } finally { await db.exec("reset role"); } }
const { db, fallos } = await crearDb();   // TODAS las migraciones, incluidas las nuevas
console.log("migraciones aplicadas sin fallos:", fallos.length === 0 ? "sí" : fallos.join(" | "));
await db.exec(`
  insert into auth.users(id,email) values ('${U(1)}','d@t.test'),('${U(2)}','a@t.test'),('${U(3)}','b@t.test');
  insert into tenants(id,slug,name) values ('${U(10)}','t','T');
  insert into tenant_entitlements(tenant_id,module_key,enabled,reason,effective_at) select '${U(10)}', key, true, 't', now() from module_catalog on conflict (tenant_id,module_key) do update set enabled=true, effective_at=now();
  insert into sedes(id,tenant_id,name) values ('${U(11)}','${U(10)}','Centro');
  insert into tenant_memberships(tenant_id,user_id,role,nombre) values ('${U(10)}','${U(1)}','duena','D');
  insert into configuracion_reservas(tenant_id,anticipacion_maxima_dias,max_reservas_dia_por_clienta) values ('${U(10)}',60,5) on conflict (tenant_id) do update set anticipacion_maxima_dias=60;
  insert into paquetes(id,tenant_id,nombre,precio,num_clases,vigencia_dias,cobertura) values ('${U(31)}','${U(10)}','8',700,8,30,'todas');
  insert into clientes(id,tenant_id,nombre,telefono,user_id,sede_habitual_id) values ('${U(21)}','${U(10)}','A','1','${U(2)}','${U(11)}'),('${U(22)}','${U(10)}','B','2','${U(3)}','${U(11)}');
  insert into horarios(id,tenant_id,sede_id,dia_semana,hora_inicio,hora_fin,nombre_clase,cupo_maximo) values ('${U(41)}','${U(10)}','${U(11)}',${DOW},'07:00','08:00','A',1);
  insert into membresias(id,tenant_id,cliente_id,paquete_id,sede_venta_id,cobertura_tipo,estado,clases_totales,clases_usadas,fecha_inicio,fecha_vencimiento,pagada,precio_final,confirmado_at,metodo_pago) values
   ('${U(51)}','${U(10)}','${U(21)}','${U(31)}','${U(11)}','todas','activa',8,0,current_date-1,current_date+30,true,700,now(),'efectivo'),
   ('${U(52)}','${U(10)}','${U(22)}','${U(31)}','${U(11)}','todas','activa',8,0,current_date-1,current_date+30,true,700,now(),'efectivo');
`);
const usadas = async (m) => Number((await db.query(`select clases_usadas u from membresias where id='${m}'`)).rows[0].u);
const R = [];
const a = await como(db, U(2), () => db.query(`select agendar_clase('${U(41)}','${F}') r`));
R.push(["A reserva con paquete vigente (usadas 0→1)", (await usadas(U(51))) === 1]);
const rid = (await db.query(`select id from reservas where cliente_id='${U(21)}' and horario_id='${U(41)}'`)).rows[0].id;
await como(db, U(3), () => db.query(`select unirse_lista_espera('${U(41)}','${F}') r`)).catch((e) => R.push(["B se anota en la espera", String(e.message).slice(0,80)]));
R.push(["B quedó en la lista de espera", Number((await db.query(`select count(*) n from lista_espera where cliente_id='${U(22)}'`)).rows[0].n) === 1]);
await como(db, U(2), () => db.query(`select cancelar_mi_reserva('${rid}') r`));
R.push(["A cancela: su crédito vuelve (1→0)", (await usadas(U(51))) === 0]);
R.push(["B es promovida a la clase (cobertura válida)", Number((await db.query(`select count(*) n from reservas where cliente_id='${U(22)}' and estado='confirmada'`)).rows[0].n) === 1]);
R.push(["B consume su crédito al ser promovida (0→1)", (await usadas(U(52))) === 1]);
R.push(["B sale de la lista de espera", Number((await db.query(`select count(*) n from lista_espera where cliente_id='${U(22)}'`)).rows[0].n) === 0]);
// pago por transferencia de punta a punta
await db.exec(`insert into paquetes(id,tenant_id,nombre,precio,num_clases,vigencia_dias,cobertura) values ('${U(32)}','${U(10)}','4',380,4,30,'todas')`);
await db.exec(`delete from reservas where cliente_id='${U(22)}'; update membresias set pagada=true where id='${U(52)}'`);
await como(db, U(3), () => db.query(`select solicitar_membresia('${U(32)}','TRF-998877') r`));
const mp = (await db.query(`select id, precio_final from membresias where cliente_id='${U(22)}' and pagada=false`)).rows[0];
R.push(["solicitar transferencia guarda el precio pactado (Q380)", Number(mp.precio_final) === 380]);
await db.exec(`update paquetes set precio = 999 where id='${U(32)}'`);   // el estudio sube el precio antes de confirmar
await como(db, U(1), () => db.query(`select confirmar_pago_membresia('${mp.id}') r`));
const mf = (await db.query(`select precio_final, pagada from membresias where id='${mp.id}'`)).rows[0];
R.push(["confirmar cobra el precio pactado aunque el catálogo cambió (Q380, no Q999)", Number(mf.precio_final) === 380 && mf.pagada === true]);
for (const [k, ok] of R) console.log(`  ${ok === true ? "OK " : "FALLA"}  ${k}${ok === true ? "" : " → " + ok}`);
await db.close();
