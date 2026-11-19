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
    insert into auth.users(id,email) values ('${U(1)}','d@t.test'),('${U(2)}','nueva@t.test');
    insert into tenants(id,slug,name) values ('${U(10)}','t','T');
    insert into tenant_entitlements(tenant_id,module_key,enabled,reason,effective_at) select '${U(10)}', key, true, 't', now() from module_catalog on conflict (tenant_id,module_key) do update set enabled=true, effective_at=now();
    insert into sedes(id,tenant_id,name) values ('${U(11)}','${U(10)}','Centro');
    insert into tenant_memberships(id,tenant_id,user_id,role,nombre) values ('${U(15)}','${U(10)}','${U(1)}','duena','D');`);
  await db.exec(`insert into auth.users(id,email) values ('${U(3)}','i@t.test'); insert into tenant_memberships(id,tenant_id,user_id,role,nombre) values ('${U(16)}','${U(10)}','${U(3)}','instructora','Instr'); insert into staff_sedes(tenant_membership_id,sede_id) values ('${U(16)}','${U(11)}');
    insert into salas(id,tenant_id,sede_id,nombre,capacidad) values ('${U(17)}','${U(10)}','${U(11)}','Sala 1',8);`).catch((e) => { out["(salas)"] = "aviso: " + String(e.message).slice(0, 80); });
  // HOR-04: puntual primero, recurrente después (la rama estaba desactivada con «and false»)
  await db.exec(`insert into horarios(tenant_id,sede_id,instructor_membership_id,dia_semana,fecha_especifica,hora_inicio,hora_fin,nombre_clase,cupo_maximo) values ('${U(10)}','${U(11)}','${U(16)}',${DOW},'${F}','10:00','11:00','Puntual',6)`);
  const a = await intenta(() => db.exec(`insert into horarios(tenant_id,sede_id,instructor_membership_id,dia_semana,hora_inicio,hora_fin,nombre_clase,cupo_maximo) values ('${U(10)}','${U(11)}','${U(16)}',${DOW},'10:30','11:30','Recurrente',6)`));
  out["HOR-04 misma instructora: clase PUNTUAL creada primero y luego una RECURRENTE que se solapa"] = a.ok ? "PERMITIDA (dos clases a la vez)" : "bloqueada";
  // HOR-03: sala, recurrente primero y puntual después
  const ex = await db.query("select 1 from information_schema.tables where table_name='salas' and table_schema='public'");
  if (ex.rows.length) {
    await db.exec(`insert into horarios(tenant_id,sede_id,sala_id,dia_semana,hora_inicio,hora_fin,nombre_clase,cupo_maximo) values ('${U(10)}','${U(11)}','${U(17)}',${DOW},'15:00','16:00','R sala',6)`);
    const b = await intenta(() => db.exec(`insert into horarios(tenant_id,sede_id,sala_id,dia_semana,fecha_especifica,hora_inicio,hora_fin,nombre_clase,cupo_maximo) values ('${U(10)}','${U(11)}','${U(17)}',${DOW},'${F}','15:30','16:30','P sala',6)`));
    out["HOR-03 misma sala: clase RECURRENTE primero y luego una PUNTUAL que se solapa"] = b.ok ? "PERMITIDA (doble uso de la sala)" : "bloqueada";
    const c = await intenta(() => db.exec(`insert into horarios(tenant_id,sede_id,sala_id,dia_semana,hora_inicio,hora_fin,nombre_clase,cupo_maximo) values ('${U(10)}','${U(11)}','${U(17)}',${(DOW + 1) % 7},'15:30','16:30','otro día',6)`));
    out["control: la misma sala otro día de la semana sí se permite"] = c.ok ? "permitida (correcto)" : "BLOQUEADA por error: " + c.e;
  }
  // REG-01: registrar dos veces
  const r1 = await intenta(() => como(db, U(2), () => db.query(`select registrar_clienta('${U(10)}','Nueva','50255551234') r`)));
  const r2 = await intenta(() => como(db, U(2), () => db.query(`select registrar_clienta('${U(10)}','Nueva','50255551234') r`)));
  const n = (await db.query(`select count(*) n from clientes where tenant_id='${U(10)}' and user_id='${U(2)}'`)).rows[0].n;
  out["REG-01 reintentar el registro (doble clic / alta a medias)"] = !r1.ok ? "falló el primero: " + r1.e : r2.ok ? `segundo intento ok (${n} ficha)` : "FALLA el reintento: " + r2.e;
  return out;
}
for (const [titulo, extra] of [["ANTES", []], ["DESPUÉS", [{ ruta: MIG + "20261018080000_choques_y_registro.sql" }]]]) {
  const { db, fallos } = await crearDb(extra, ["20261018080000"]);
  if (fallos.length) console.log("  (avisos de carga:", fallos.slice(0, 2).join(" | "), ")");
  console.log(`\n=== ${titulo}`);
  try { const r = await escenarios(db); for (const [k, v] of Object.entries(r)) console.log(`  ${k}: ${v}`); } catch (e) { console.log("  ERROR de prueba:", String(e.message).slice(0, 220)); }
  await db.close();
}
