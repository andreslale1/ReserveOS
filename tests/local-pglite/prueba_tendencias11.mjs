import { crearDb } from "./cargar.mjs";
const U = (n) => `00000000-0000-4000-8000-0000000000${String(n).padStart(2, "0")}`;
async function como(db, uid, fn) { await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${uid}',false); select set_config('request.jwt.claim.role','authenticated',false)`); try { return await fn(); } finally { await db.exec("reset role"); } }
const intenta = async (f) => { try { return { ok: true, v: await f() }; } catch (e) { return { ok: false, e: String(e.message).slice(0, 120) }; } };
const { db, fallos } = await crearDb();
if (fallos.length) console.log("fallos de carga (estricto):", fallos.join(" | "));
const R = []; const ok = (n, b, x = "") => R.push(`${b ? "OK   " : "FALLA"}  ${n}${x ? "  → " + x : ""}`);
await db.exec(`
  insert into auth.users(id,email) values ('${U(1)}','op@t.test'),('${U(2)}','ven@t.test'),('${U(3)}','due@t.test');
  insert into plataforma_staff(user_id,rol) values ('${U(1)}','operador'),('${U(2)}','ventas');
  insert into tenants(id,slug,name) values ('${U(10)}','ta','A');
  insert into tenant_memberships(tenant_id,user_id,role,nombre) values ('${U(10)}','${U(3)}','duena','D');
  insert into plataforma_planes(key,nombre,precio_mensual) values ('estandar','Estándar',500) on conflict do nothing;
  insert into plataforma_suscripciones(tenant_id,precio_mensual,estado) values ('${U(10)}',500,'activa');
  insert into plataforma_cobros(tenant_id,periodo,monto,estado,fecha_vencimiento,fecha_pago) values ('${U(10)}',date_trunc('month',current_date)::date,500,'pagado',current_date,current_date);
  insert into plataforma_leads(nombre,etapa,valor_mensual) values ('L1','demo',400),('L2','ganado',600);`);
const op = await intenta(() => como(db, U(1), () => db.query(`select plataforma_tendencias() d`)));
ok("el operador obtiene las tendencias", op.ok, op.e);
const d = op.v?.rows?.[0]?.d;
ok("MRR = 500", Number(d?.mrr) === 500, String(d?.mrr));
ok("6 meses de cobros con 500 cobrado este mes", d?.cobros?.length === 6 && d.cobros.some((c) => Number(c.cobrado) === 500));
ok("6 meses de estudios y 8 semanas de actividad", d?.estudios?.length === 6 && d?.actividad?.length === 8);
ok("pipeline con 2 etapas", d?.pipeline?.length === 2);
const v = await intenta(() => como(db, U(2), () => db.query(`select plataforma_tendencias() d`)));
ok("ventas ve el pipeline pero NO las finanzas", v.ok && v.v.rows[0].d.pipeline?.length === 2 && v.v.rows[0].d.mrr === null && v.v.rows[0].d.cobros === null, v.e);
const x = await intenta(() => como(db, U(3), () => db.query(`select plataforma_tendencias()`)));
ok("la dueña de un estudio NO accede", !x.ok, x.e);
for (const r of R) console.log(r);
await db.close();
