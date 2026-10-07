// Siembra (de forma idempotente) los estudios y usuarios de prueba: VIM de 3 sedes, un estudio de una sede, y se usa
// ficticio-b como estudio ajeno. Cada rol tiene un usuario real con sesión, para probar permisos con llamadas directas a la API.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { consulta } from "../escenarios/concurrencia.mjs";

const dir = dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(join(dir, "roles.json"), "utf8"));
const env = Object.fromEntries(readFileSync(join(dir, "../../web/.env.local"), "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL, SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN, REF = process.env.SUPABASE_PROJECT_REF ?? "agkqppuhyltirrhngybq";
if (!TOKEN) { console.error("Falta SUPABASE_ACCESS_TOKEN"); process.exit(2); }
const sql = (q) => { const r = consulta(TOKEN, REF, q); if (r && r.message) throw new Error(r.message.slice(0, 400)); return r; };
const esc = (s) => String(s).replace(/'/g, "''");

async function crearUsuario(email) {
  const r = await fetch(`${URL_}/auth/v1/admin/users`, { method: "POST", headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" }, body: JSON.stringify({ email, password: cfg.password, email_confirm: true }) });
  if (!r.ok) { const t = await r.text(); if (!/already|registered|exists/i.test(t)) throw new Error(`No se pudo crear ${email}: ${t.slice(0, 200)}`); }
}
const uid = (email) => sql(`select id from auth.users where email='${esc(email)}'`)[0]?.id;

// 1) Estudios y sedes
for (const t of Object.values(cfg.tenants)) {
  sql(`insert into tenants(slug,name) values ('${t.slug}','${esc(t.nombre)}') on conflict (slug) do nothing`);
  sql(`insert into tenant_entitlements(tenant_id,module_key,enabled,reason,effective_at) select t.id,m.key,true,'fixture de pruebas',now() from tenants t cross join module_catalog m where t.slug='${t.slug}' on conflict (tenant_id,module_key) do update set enabled=true`);
  for (const s of t.sedes) sql(`insert into sedes(tenant_id,name) select id,'${esc(s)}' from tenants where slug='${t.slug}' on conflict (tenant_id,name) do nothing`);
}
// 2) Usuarios de personal, con membresías y sedes
for (const u of cfg.usuarios) {
  const email = `${u.alias}@${cfg.dominio}`;
  await crearUsuario(email);
  const id = uid(email);
  const asignar = (tk, rol, sedes) => {
    const tenant = cfg.tenants[tk];
    sql(`insert into tenant_memberships(tenant_id,user_id,role,nombre) select t.id,'${id}','${rol}','FX ${u.alias}' from tenants t where t.slug='${tenant.slug}' and not exists (select 1 from tenant_memberships m where m.tenant_id=t.id and m.user_id='${id}')`);
    for (const s of sedes) sql(`insert into staff_sedes(tenant_membership_id,sede_id) select m.id,s.id from tenant_memberships m join tenants t on t.id=m.tenant_id join sedes s on s.tenant_id=t.id and s.name='${esc(s)}' where t.slug='${tenant.slug}' and m.user_id='${id}' on conflict do nothing`);
  };
  asignar(u.tenant, u.rol, u.sedes);
  if (u.tambien) asignar(u.tambien.tenant, u.tambien.rol, u.tambien.sedes);
}
// 3) Clientas (algunas con usuario)
for (const c of cfg.clientas) {
  const t = cfg.tenants.vim;
  let userSql = "null";
  if (c.usuario) { const email = `${c.alias}@${cfg.dominio}`; await crearUsuario(email); userSql = `'${uid(email)}'`; }
  sql(`insert into clientes(tenant_id,nombre,telefono,sede_habitual_id,user_id,creada_por) select t.id,'${esc(c.nombre)}','${c.tel}',${c.habitual ? `(select id from sedes where tenant_id=t.id and name='${c.habitual}')` : "null"},${userSql},null from tenants t where t.slug='${t.slug}' and not exists (select 1 from clientes x where x.tenant_id=t.id and x.telefono='${c.tel}')`);
}
// 4) Clases, paquetes, ventas, reservas, pedidos y cajas (datos estáticos para probar alcance)
const T = `(select id from tenants where slug='vim-prueba')`;
const S = (n) => `(select id from sedes where tenant_id=${T} and name='${n}')`;
const M = (a) => `(select m.id from tenant_memberships m join auth.users u on u.id=m.user_id where m.tenant_id=${T} and u.email='${a}@${cfg.dominio}')`;
const C = (n) => `(select id from clientes where tenant_id=${T} and nombre='${n}')`;
const clases = [["FX Clase Centro", "Centro", "instr12", 1, "07:00", "08:00"], ["FX Clase Norte", "Norte", "instr12", 2, "07:00", "08:00"], ["FX Clase Sur", "Sur", "instr3", 3, "07:00", "08:00"]];
for (const [n, sede, ins, dia, h1, h2] of clases)
  sql(`insert into horarios(tenant_id,sede_id,instructor_membership_id,dia_semana,hora_inicio,hora_fin,nombre_clase,cupo_maximo) select ${T},${S(sede)},${M(ins)},${dia},'${h1}','${h2}','${n}',8 where not exists (select 1 from horarios where tenant_id=${T} and nombre_clase='${n}')`);
const paquetes = [["FX Solo sede", "sede", 100, 60], ["FX Dos sedes", "sedes", 160, 60], ["FX Todas", "todas", 220, 60], ["FX Todas larga", "todas", 300, 120], ["FX Flujo Sede", "sede", 71, 60], ["FX Flujo Todas", "todas", 72, 120]];
for (const [n, cob, precio, vig] of paquetes) sql(`insert into paquetes(tenant_id,nombre,precio,num_clases,vigencia_dias,cobertura) select ${T},'${n}',${precio},8,${vig},'${cob}' where not exists (select 1 from paquetes where tenant_id=${T} and nombre='${n}')`);
sql(`insert into paquete_sedes(paquete_id,sede_id) select p.id,s.id from paquetes p join sedes s on s.tenant_id=p.tenant_id and s.name in ('Centro','Norte') where p.tenant_id=${T} and p.nombre='FX Dos sedes' on conflict do nothing`);
const ventas = [["FX Clienta Centro", "FX Solo sede", "Centro"], ["FX Clienta Norte", "FX Todas", "Norte"], ["FX Clienta Sur", "FX Solo sede", "Sur"], ["FX Clienta Visita", "FX Dos sedes", "Centro"]];
for (const [cli, paq, sede] of ventas)
  sql(`insert into membresias(tenant_id,cliente_id,paquete_id,sede_venta_id,cobertura_tipo,metodo_pago,precio_final,estado,clases_totales,clases_usadas,fecha_inicio,fecha_vencimiento,pagada,origen,confirmado_at)
       select ${T},${C(cli)},p.id,${S(sede)},p.cobertura,'efectivo',p.precio,'activa',8,0,current_date,current_date+60,true,'compra',now() from paquetes p
       where p.tenant_id=${T} and p.nombre='${paq}' and not exists (select 1 from membresias m where m.tenant_id=${T} and m.cliente_id=${C(cli)} and m.paquete_id=p.id)`);
sql(`insert into membresia_sedes(membresia_id,sede_id) select m.id, m.sede_venta_id from membresias m where m.tenant_id=${T} and m.cobertura_tipo='sede' on conflict do nothing`);
sql(`insert into membresia_sedes(membresia_id,sede_id) select m.id, ps.sede_id from membresias m join paquete_sedes ps on ps.paquete_id=m.paquete_id where m.tenant_id=${T} and m.cobertura_tipo='sedes' on conflict do nothing`);
const reservas = [["FX Clienta Centro", "FX Clase Centro", "Centro"], ["FX Clienta Norte", "FX Clase Norte", "Norte"], ["FX Clienta Visita", "FX Clase Norte", "Norte"], ["FX Clienta Sur", "FX Clase Sur", "Sur"]];
for (const [cli, cl, sede] of reservas)
  sql(`insert into reservas(tenant_id,sede_id,horario_id,cliente_id,fecha,tipo,estado) select ${T},${S(sede)},h.id,${C(cli)},current_date+30,'prueba','confirmada' from horarios h where h.tenant_id=${T} and h.nombre_clase='${cl}' and not exists (select 1 from reservas r where r.horario_id=h.id and r.cliente_id=${C(cli)})`);
for (const [sede, monto] of [["Centro", 300], ["Sur", 500]]) {
  sql(`insert into cobros_personalizados(tenant_id,sede_id,cliente_id,concepto,monto,metodo_pago,confirmado_at) select ${T},${S(sede)},${C("FX Clienta " + (sede === "Centro" ? "Centro" : "Sur"))},'FX cobro ${sede}',${monto},'efectivo',now() where not exists (select 1 from cobros_personalizados where tenant_id=${T} and concepto='FX cobro ${sede}')`);
  sql(`insert into cierre_caja(tenant_id,sede_id,fecha,efectivo_sistema,efectivo_contado,tarjeta_sistema,tarjeta_contado,transferencia_sistema,transferencia_contado) select ${T},${S(sede)},'2026-01-01',${monto},${monto},0,0,0,0 on conflict do nothing`);
}
sql(`delete from cierre_caja where tenant_id=${T} and fecha <> '2026-01-01'`);   // el fixture usa una fecha fija: así es idempotente
console.log("Fixtures listos:", Object.values(cfg.tenants).map((t) => t.slug).join(", "), "+", cfg.usuarios.length, "usuarios de personal,", cfg.clientas.length, "clientas");
