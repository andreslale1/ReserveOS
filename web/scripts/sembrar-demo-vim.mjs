#!/usr/bin/env node
// Crea (o recrea) un estudio de DEMOSTRACIÓN «VIM Pilates (demo)» con 3 sedes, clases, paquetes, clientas y reservas,
// para mostrar ReserveOS en reuniones. NO toca los estudios de pruebas automáticas (vim-prueba).
//   cd web && set -a && . ./.env.local && set +a && node scripts/sembrar-demo-vim.mjs [--reiniciar]
// Cuentas (contraseña DemoVIM2026!): demo-duena@ · demo-admin@ · demo-recepcion@ · demo-instructora@ · demo-clienta@vim-demo.test
import { createClient } from "@supabase/supabase-js";

const rs = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const SLUG = "vim-demo", PASS = "DemoVIM2026!", DOM = "vim-demo.test";
const ok = (r, ctx) => { if (r.error) throw new Error(`${ctx}: ${r.error.message}`); return r.data; };

let { data: t } = await rs.from("tenants").select("id").eq("slug", SLUG).maybeSingle();
if (t && !process.argv.includes("--reiniciar")) { console.log("Ya existe (usa --reiniciar para recrear)"); process.exit(0); }
if (t) {
  // El estudio no se puede borrar (la auditoría lo referencia): se vacía y se vuelve a sembrar.
  for (const tb of ["reservas", "membresias", "clientes", "horarios", "paquetes"]) await rs.from(tb).delete().eq("tenant_id", t.id);
  const { data: ms } = await rs.from("tenant_memberships").select("id").eq("tenant_id", t.id);
  if (ms?.length) await rs.from("staff_sedes").delete().in("tenant_membership_id", ms.map((m) => m.id));
  await rs.from("tenant_memberships").delete().eq("tenant_id", t.id);
  await rs.from("sedes").delete().eq("tenant_id", t.id);
  console.log("Estudio vaciado");
} else {
  t = ok(await rs.from("tenants").insert({ slug: SLUG, name: "VIM Pilates (demo)", status: "activo", branding: { color_primario: "#F2A65A" } }).select("id").single(), "tenant");
}
const T = t.id;
const sedes = ok(await rs.from("sedes").insert(["Centro", "Norte", "Sur"].map((name) => ({ tenant_id: T, name, timezone: "America/Guatemala" }))).select("id,name"), "sedes");
const { data: mods } = await rs.from("module_catalog").select("key");
ok(await rs.from("tenant_entitlements").upsert((mods ?? []).map((m) => ({ tenant_id: T, module_key: m.key, enabled: true, reason: "demo", effective_at: new Date().toISOString() })), { onConflict: "tenant_id,module_key" }), "módulos");

// Cuentas
async function usuario(alias) {
  const email = `${alias}@${DOM}`;
  const c = await rs.auth.admin.createUser({ email, password: PASS, email_confirm: true });
  if (c.data?.user) return c.data.user.id;
  const l = await rs.auth.admin.listUsers({ perPage: 1000 });
  const u = l.data.users.find((x) => x.email === email);
  if (!u) throw new Error(`usuario ${alias}: ${c.error?.message}`);
  await rs.auth.admin.updateUserById(u.id, { password: PASS });
  return u.id;
}
const staff = [["demo-duena", "duena", "Mariana Duarte (dueña)", []], ["demo-admin", "admin_sede", "Lucía Pérez (admin Centro)", ["Centro"]],
  ["demo-recepcion", "recepcion", "Andrea Morales (recepción)", ["Centro"]], ["demo-instructora", "instructora", "Sofía Ramírez", ["Centro"]],
  ["demo-instructora-norte", "instructora", "Paula Aguilar", ["Norte"]], ["demo-instructora-sur", "instructora", "Renata Solís", ["Sur"]]];
const instructoraDe = {};
for (const [alias, role, nombre, ss] of staff) {
  const uid = await usuario(alias);
  const m = ok(await rs.from("tenant_memberships").insert({ tenant_id: T, user_id: uid, role, nombre }).select("id").single(), `miembro ${alias}`);
  if (ss.length) ok(await rs.from("staff_sedes").insert(ss.map((n) => ({ tenant_membership_id: m.id, sede_id: sedes.find((s) => s.name === n).id }))), "staff_sedes");
  if (role === "instructora") instructoraDe[ss[0]] = m.id;
}

// Paquetes
const paquetes = ok(await rs.from("paquetes").insert([
  { nombre: "Clase suelta", num_clases: 1, precio: 100, vigencia_dias: 30, cobertura: "todas", orden: 1 },
  { nombre: "4 clases", num_clases: 4, precio: 380, vigencia_dias: 30, cobertura: "todas", orden: 2 },
  { nombre: "8 clases", num_clases: 8, precio: 700, vigencia_dias: 45, cobertura: "todas", orden: 3, featured: true, badge: "Más popular" },
  { nombre: "12 clases", num_clases: 12, precio: 990, vigencia_dias: 60, cobertura: "todas", orden: 4 },
  { nombre: "Ilimitado mensual", num_clases: null, precio: 1200, vigencia_dias: 30, cobertura: "todas", orden: 5 },
].map((p) => ({ tenant_id: T, featured: false, badge: null, ...p }))).select("id,nombre,precio,num_clases,vigencia_dias"), "paquetes");

// Horarios: lunes a sábado, 3 sedes
const franjas = [["07:00", "08:00", "Pilates Reformer"], ["09:00", "10:00", "Pilates Mat"], ["18:00", "19:00", "Pilates Reformer"], ["19:00", "20:00", "Pilates Flow"]];
const filasH = [];
for (const s of sedes) for (let d = 1; d <= 6; d++) for (const [i, f, n] of franjas) filasH.push({ tenant_id: T, sede_id: s.id, instructor_membership_id: instructoraDe[s.name], dia_semana: d, hora_inicio: i, hora_fin: f, nombre_clase: n, cupo_maximo: 8, activo: true });
const horarios = ok(await rs.from("horarios").insert(filasH).select("id,sede_id,dia_semana"), "horarios");

// Clientas
const nombres = ["Valeria Castillo", "Daniela Méndez", "Paola Ruiz", "Gabriela Soto", "Mónica Lemus", "Andrea Girón", "Karla Orellana", "Ximena Paz", "Fernanda Reyes", "Alejandra Cruz", "Diana Barrios", "Natalia Flores"];
const uidClienta = await usuario("demo-clienta");
const clientes = ok(await rs.from("clientes").insert([{ nombre: "Camila Herrera (clienta demo)", email: `demo-clienta@${DOM}`, telefono: "50255550000", user_id: uidClienta, sede_habitual_id: sedes[0].id },
  ...nombres.map((n, i) => ({ nombre: n, telefono: `5025555${String(1000 + i)}`, sede_habitual_id: sedes[i % 3].id }))].map((c) => ({ tenant_id: T, ...c }))).select("id,nombre,sede_habitual_id"), "clientas");

// Membresías: la clienta demo con 8 clases; las demás repartidas en los últimos 30 días (para que Finanzas tenga números); 2 pagos pendientes.
const hoy = new Date(); const iso = (d) => d.toISOString().slice(0, 10); const mas = (n) => { const d = new Date(hoy); d.setDate(d.getDate() + n); return d; };
const memb = clientes.map((c, i) => {
  const p = i === 0 ? paquetes[2] : paquetes[(i % 4) + 1 - (i % 4 === 0 ? 0 : 0)] ?? paquetes[2];
  const pendiente = i === 1 || i === 2;
  const inicio = i === 0 ? hoy : mas(-(i * 2));
  return { tenant_id: T, cliente_id: c.id, paquete_id: p.id, sede_venta_id: c.sede_habitual_id, cobertura_tipo: "todas", clases_totales: p.num_clases, clases_usadas: 0,
    fecha_inicio: iso(inicio), fecha_vencimiento: iso(new Date(inicio.getTime() + p.vigencia_dias * 86400000)), estado: pendiente ? "pendiente_pago" : "activa",
    precio_final: p.precio, metodo_pago: pendiente ? "transferencia" : i % 2 ? "efectivo" : "tarjeta", pagada: !pendiente, confirmado_at: pendiente ? null : inicio.toISOString() };
});
const mem = ok(await rs.from("membresias").insert(memb).select("id"), "membresías");

// Reservas próximas 7 días (ocupación visible)
const reservas = [];
for (let n = 0; n < 7; n++) {
  const f = mas(n), dow = f.getDay(); if (dow === 0) continue;
  const delDia = horarios.filter((h) => h.dia_semana === dow);
  delDia.forEach((h, j) => { const k = (j + n) % 6 + 3; for (let q = 0; q < Math.min(k, 7); q++) { const c = clientes[3 + ((j + q + n) % (clientes.length - 3))]; reservas.push({ tenant_id: T, sede_id: h.sede_id, horario_id: h.id, cliente_id: c.id, fecha: iso(f), estado: "confirmada", tipo: "regular" }); } });
}
const unicas = [...new Map(reservas.map((r) => [`${r.horario_id}|${r.cliente_id}|${r.fecha}`, r])).values()];
for (let i = 0; i < unicas.length; i += 200) ok(await rs.from("reservas").insert(unicas.slice(i, i + 200)), "reservas");

console.log(`Listo: ${sedes.length} sedes, ${horarios.length} horarios, ${paquetes.length} paquetes, ${clientes.length} clientas, ${mem.length} membresías, ${unicas.length} reservas.`);
console.log(`Página pública: https://reserveos.app/e/${SLUG}\nCuentas @${DOM} · contraseña ${PASS}`);
