// Pruebas de concurrencia: dos operaciones simultáneas sobre lo mismo (último cupo, mismo código de gift card).
import { execFileSync } from "node:child_process";

export function consulta(token, ref, sql) {
  const out = execFileSync("curl", ["-s", "-X", "POST", `https://api.supabase.com/v1/projects/${ref}/database/query`, "-H", `Authorization: Bearer ${token}`, "-H", "Content-Type: application/json", "-d", JSON.stringify({ query: sql })], { encoding: "utf8", maxBuffer: 20_000_000 });
  try { return JSON.parse(out); } catch { return { message: out.slice(0, 300) }; }
}
const q = (token, ref, sql) => new Promise((res) => setTimeout(() => res(consulta(token, ref, sql)), 0));
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

export async function correrConcurrencia(token, ref) {
  const resultados = [];
  // 1) Último cupo: A toma el candado y tarda; B llega después y debe ser rechazada.
  const f = consulta(token, ref, "select t.id tid,(select id from sedes where tenant_id=t.id limit 1) sid from tenants t where slug='ficticio-a'")[0];
  const s = consulta(token, ref, `with h as (insert into horarios(tenant_id,sede_id,dia_semana,hora_inicio,hora_fin,cupo_maximo,nombre_clase) values('${f.tid}','${f.sid}',3,'23:00','23:50',1,'ZZ_CARRERA') returning id), c1 as (insert into clientes(tenant_id,nombre,telefono) values('${f.tid}','ZZ Carrera 1','5550001') returning id), c2 as (insert into clientes(tenant_id,nombre,telefono) values('${f.tid}','ZZ Carrera 2','5550002') returning id) select h.id hid,c1.id c1,c2.id c2 from h,c1,c2`)[0];
  const ins = (cid, dormir) => `insert into reservas(tenant_id,sede_id,horario_id,cliente_id,fecha,estado) values('${f.tid}','${f.sid}','${s.hid}','${cid}','2026-12-02','confirmada');` + (dormir ? `select pg_sleep(${dormir});` : "");
  const A = q(token, ref, ins(s.c1, 4)); await pausa(1500); const B = q(token, ref, ins(s.c2, 0));
  const [ra, rb] = await Promise.all([A, B]);
  const confirmadas = consulta(token, ref, `select count(*)::int n from reservas where horario_id='${s.hid}' and estado='confirmada'`)[0].n;
  consulta(token, ref, `delete from reservas where horario_id='${s.hid}'; delete from horarios where id='${s.hid}'; delete from clientes where id in ('${s.c1}','${s.c2}');`);
  resultados.push({ nombre: "Último cupo: dos reservas simultáneas, solo una gana", ok: !ra.message && /cupo/i.test(rb.message ?? "") && confirmadas === 1, detalle: `confirmadas=${confirmadas}; segunda: ${(rb.message ?? "").slice(0, 60)}` });

  // 2) Gift card: el segundo canje simultáneo recibe "ya canjeado" y no se crea un segundo paquete.
  const g = consulta(token, ref, "select te.id t, cl.user_id u, cl.id c, (select id from paquetes where tenant_id=te.id and activo limit 1) p from clientes cl join tenants te on te.id=cl.tenant_id where te.slug='demo' and cl.user_id is not null limit 1")[0];
  consulta(token, ref, `insert into gift_cards(tenant_id,codigo,paquete_id,comprador_nombre,destinatario_nombre,estado) values ('${g.t}','ZZTEST01','${g.p}','ZZ','ZZ','activa')`);
  const antes = consulta(token, ref, `select count(*)::int n from membresias where cliente_id='${g.c}'`)[0].n;
  const A2 = q(token, ref, "begin; select 1 from gift_cards where codigo='ZZTEST01' for update; select pg_sleep(4); update gift_cards set estado='canjeada' where codigo='ZZTEST01'; commit;");
  await pausa(1500);
  const B2 = q(token, ref, `select set_config('request.jwt.claim.sub','${g.u}',true), set_config('request.jwt.claims','{"sub":"${g.u}","role":"authenticated"}',true); select public.canjear_gift_card('${g.t}','zztest01');`);
  const [, rb2] = await Promise.all([A2, B2]);
  const despues = consulta(token, ref, `select count(*)::int n from membresias where cliente_id='${g.c}'`)[0].n;
  consulta(token, ref, "delete from gift_cards where codigo='ZZTEST01'");
  resultados.push({ nombre: "Gift card: dos canjes simultáneos, solo uno gana", ok: /ya fue canjeado/i.test(rb2.message ?? "") && despues === antes, detalle: `membresías nuevas=${despues - antes}; segundo: ${(rb2.message ?? "").slice(0, 50)}` });
  return resultados;
}
