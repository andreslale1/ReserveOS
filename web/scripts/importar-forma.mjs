#!/usr/bin/env node
// Importa Forma Pilates (un estudio, sin sedes) a un estudio de ReserveOS (multi-tenant, con sedes).
//
// Uso (siempre empieza en simulacro; no escribe nada sin --aplicar):
//   FORMA_URL=... FORMA_KEY=<service_role de Forma, solo lectura>  \
//   RS_URL=...    RS_KEY=<service_role de ReserveOS>               \
//   cd web && node scripts/importar-forma.mjs --tenant <uuid-del-estudio> [--sede "Sede principal"] [--clientas] [--aplicar]
//
// Fases: 1) catálogo (sede, paquetes, horarios)  2) --clientas: clientas, membresías y reservas.
// Las clientas se importan SIN cuenta (user_id vacío): entran con "olvidé mi contraseña" o invitación.
// Nunca modifica Forma. Es repetible: guarda el id de origen en `notas`/`referencia_pago` para no duplicar.
import { createClient } from "@supabase/supabase-js";

const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i < 0 ? null : (process.argv[i + 1]?.startsWith("--") ? true : process.argv[i + 1] ?? true); };
const APLICAR = !!arg("aplicar"), CLIENTAS = !!arg("clientas"), TENANT = arg("tenant"), SEDE = typeof arg("sede") === "string" ? arg("sede") : "Sede principal";
for (const v of ["FORMA_URL", "FORMA_KEY", "RS_URL", "RS_KEY"]) if (!process.env[v]) { console.error(`Falta ${v}`); process.exit(1); }
if (!TENANT || TENANT === true) { console.error("Falta --tenant <uuid>"); process.exit(1); }

const forma = createClient(process.env.FORMA_URL, process.env.FORMA_KEY, { auth: { persistSession: false } });
const rs = createClient(process.env.RS_URL, process.env.RS_KEY, { auth: { persistSession: false } });
const informe = { modo: APLICAR ? "APLICADO" : "SIMULACRO", tablas: {}, avisos: [] };

async function leer(tabla, cols = "*") {
  const filas = []; for (let d = 0; ; d += 1000) {
    const { data, error } = await forma.from(tabla).select(cols).range(d, d + 999);
    if (error) throw new Error(`${tabla}: ${error.message}`);
    filas.push(...data); if (data.length < 1000) break;
  } return filas;
}
const pick = (o, claves) => Object.fromEntries(claves.filter((k) => o[k] !== undefined && o[k] !== null).map((k) => [k, o[k]]));
async function insertar(tabla, filas) {
  informe.tablas[tabla] = (informe.tablas[tabla] ?? 0) + filas.length;
  if (!APLICAR || filas.length === 0) return filas.map(() => ({ id: "(simulado)" }));
  const salida = [];
  for (let i = 0; i < filas.length; i += 200) {
    const { data, error } = await rs.from(tabla).insert(filas.slice(i, i + 200)).select("id");
    if (error) throw new Error(`${tabla}: ${error.message}`);
    salida.push(...data);
  } return salida;
}

const { data: t } = await rs.from("tenants").select("id, name").eq("id", TENANT).maybeSingle();
if (!t) { console.error("Ese estudio no existe en ReserveOS"); process.exit(1); }
console.log(`Estudio destino: ${t.name} · ${informe.modo}`);

// 1) Sede: Forma solo tiene una; en ReserveOS todo cuelga de una sede.
let { data: sede } = await rs.from("sedes").select("id").eq("tenant_id", TENANT).limit(1).maybeSingle();
if (!sede) { const [s] = await insertar("sedes", [{ tenant_id: TENANT, name: SEDE, timezone: "America/Guatemala" }]); sede = s; }

// 2) Paquetes (mismo shape; en ReserveOS añade cobertura/etiqueta).
const paquetes = await leer("paquetes");
const mapaPaq = new Map();
const { data: yaPaq } = await rs.from("paquetes").select("id, nombre").eq("tenant_id", TENANT);
const paqNuevos = paquetes.filter((p) => !(yaPaq ?? []).some((x) => x.nombre === p.nombre));
const creadosPaq = await insertar("paquetes", paqNuevos.map((p) => ({ tenant_id: TENANT, ...pick(p, ["nombre", "descripcion", "num_clases", "precio", "vigencia_dias", "activo", "orden"]), cobertura: "todas" })));
paqNuevos.forEach((p, i) => mapaPaq.set(p.id, creadosPaq[i].id));
for (const p of paquetes) if (!mapaPaq.has(p.id)) mapaPaq.set(p.id, (yaPaq ?? []).find((x) => x.nombre === p.nombre)?.id);

// 3) Horarios (la instructora no se importa: requiere cuenta; se asigna luego por invitación).
const horarios = await leer("horarios");
const { data: yaHor } = await rs.from("horarios").select("id, dia_semana, hora_inicio, nombre_clase").eq("tenant_id", TENANT);
const clave = (h) => `${h.dia_semana}|${String(h.hora_inicio).slice(0, 5)}|${h.nombre_clase}`;
const horNuevos = horarios.filter((h) => !(yaHor ?? []).some((x) => clave(x) === clave(h)));
const creadosHor = await insertar("horarios", horNuevos.map((h) => ({ tenant_id: TENANT, sede_id: sede.id, ...pick(h, ["dia_semana", "hora_inicio", "hora_fin", "cupo_maximo", "nombre_clase", "activo"]) })));
const mapaHor = new Map(); horNuevos.forEach((h, i) => mapaHor.set(h.id, creadosHor[i].id));
for (const h of horarios) if (!mapaHor.has(h.id)) mapaHor.set(h.id, (yaHor ?? []).find((x) => clave(x) === clave(h))?.id);
const conInstructora = horarios.filter((h) => h.instructor_id).length;
if (conInstructora) informe.avisos.push(`${conInstructora} horarios tenían instructora: quedan sin asignar hasta invitar a cada instructora en ReserveOS.`);

// 4) Clientas, membresías, reservas (solo con --clientas).
if (CLIENTAS) {
  const clientes = await leer("clientes");
  const { data: yaCli } = await rs.from("clientes").select("id, notas").eq("tenant_id", TENANT).like("notas", "%[forma:%");
  const hechas = new Map((yaCli ?? []).map((c) => [c.notas.match(/\[forma:([0-9a-f-]+)\]/)?.[1], c.id]));
  const nuevas = clientes.filter((c) => !hechas.has(c.id));
  const creadas = await insertar("clientes", nuevas.map((c) => ({
    tenant_id: TENANT, sede_habitual_id: sede.id, telefono: c.telefono || "sin-telefono",
    ...pick(c, ["nombre", "email", "genero", "fecha_nacimiento", "cuidados_especiales", "contacto_emergencia", "objetivos", "objetivo_otro", "experiencia_pilates"]),
    notas: `${c.notas ? c.notas + " " : ""}[forma:${c.id}]`,
  })));
  nuevas.forEach((c, i) => hechas.set(c.id, creadas[i].id));
  const sinCorreo = clientes.filter((c) => !c.email).length;
  if (sinCorreo) informe.avisos.push(`${sinCorreo} clientas sin correo: no podrán recuperar contraseña solas; invitar por teléfono/enlace.`);

  const membresias = await leer("membresias");
  const estadoRS = (e) => (e === "cancelada" || e === "rechazada" ? "anulada" : e);
  const { data: yaMem } = await rs.from("membresias").select("referencia_pago").eq("tenant_id", TENANT).like("referencia_pago", "forma:%");
  const memHechas = new Set((yaMem ?? []).map((m) => m.referencia_pago));
  const memNuevas = membresias.filter((m) => hechas.get(m.cliente_id) && mapaPaq.get(m.paquete_id) && !memHechas.has(`forma:${m.id}`));
  await insertar("membresias", memNuevas.map((m) => ({
    tenant_id: TENANT, cliente_id: hechas.get(m.cliente_id), paquete_id: mapaPaq.get(m.paquete_id), sede_venta_id: sede.id, cobertura_tipo: "todas",
    ...pick(m, ["clases_totales", "clases_usadas", "fecha_inicio", "fecha_vencimiento", "comprobante_url", "confirmado_at"]),
    estado: estadoRS(m.estado), referencia_pago: `forma:${m.id}`, origen: "migracion_forma",
  })));

  const reservas = await leer("reservas");
  const resNuevas = reservas.filter((r) => hechas.get(r.cliente_id) && mapaHor.get(r.horario_id));
  const { data: yaRes } = await rs.from("reservas").select("horario_id, cliente_id, fecha").eq("tenant_id", TENANT);
  const llave = (r) => `${r.horario_id}|${r.cliente_id}|${r.fecha}`;
  const vistas = new Set((yaRes ?? []).map(llave));
  const resFilas = resNuevas.map((r) => ({ tenant_id: TENANT, sede_id: sede.id, horario_id: mapaHor.get(r.horario_id), cliente_id: hechas.get(r.cliente_id), fecha: r.fecha, tipo: r.tipo === "prueba" ? "prueba" : "regular", estado: r.estado === "cancelada" ? "cancelada" : "confirmada", asistio: r.asistio ?? null }))
    .filter((r) => !vistas.has(llave(r)));
  await insertar("reservas", resFilas);
}

console.log(JSON.stringify(informe, null, 2));
if (!APLICAR) console.log("\nSimulacro: no se escribió nada. Agrega --aplicar para importar.");
