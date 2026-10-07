// Banco de escenarios de punta a punta contra la base real (staging). Cada .sql corre dentro de una transacción que se
// deshace sola: crea datos ficticios, ejecuta el flujo con los roles reales y termina con "RESULTADO: …", que aquí se compara
// con lo esperado. Después se comprueba que no quedó ningún dato de prueba ("ZZ…").
//
// Uso:   SUPABASE_ACCESS_TOKEN=sbp_… node tests/escenarios/run.mjs        (el token NO se guarda en ningún archivo)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { consulta, correrConcurrencia } from "./concurrencia.mjs";

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const REF = process.env.SUPABASE_PROJECT_REF ?? "agkqppuhyltirrhngybq";
if (!TOKEN) { console.error("Falta SUPABASE_ACCESS_TOKEN (genera uno en supabase.com/dashboard/account/tokens)."); process.exit(2); }
const dir = dirname(fileURLToPath(import.meta.url));

const ESPERADO = {
  crm: ["bloqueó duplicado OK", "proyectos creados=1", "Vincula primero el estudio", "perdido sin motivo"],
  bill: ["1a vez creó 2 cobros, 2a vez 0", "sobrepago: El pago", "tras 600 más: pagado"],
  sup: ["SLA urgente=4", "Indica la causa", "listado equipo=1", "mensajes visibles a la dueña=2"],
  st: ["La instructora ya tiene otra clase", "Esa sala ya está ocupada", "feriado canceló 1 reservas", "La sede está cerrada", "Teléfono repetido en el archivo", "Falta el nombre"],
  del: ["[3] permitido con delegación", "[4] bloqueado tras revocar", "[6] recepción con delegación por rol: OK", "Esta acción requiere una delegación"],
  elig: ["[1] sin_paquete", "[2] no_cubre_sede", "[3] ok", "[4] sin_creditos", "[5] llena espera=true"],
  shop: ["[checkout efectivo OK", "[checkout pasarela OK]", "[venta presencial OK]", "[crear gift OK]"],
  stock: ["No hay stock suficiente", "entrada 5", "salida -2"],
  pay: ["[firma falsa -> Firma inválida]", "[pago: confirmado]", "[repetido: duplicado=true]", "monto_distinto", "[replay ->", "[clienta aprueba -> No autorizado]", "[aprobado: membresía anulada]", "reembolso devuelto"],
  caja: ["cuadra=true", "recepción ve 1 sede(s), consolidado=oculto", "No autorizado"],
  gv: ["cuadra=true", "Esta tarjeta fue anulada por el estudio"],
  fel: ["IVA=85.71", "tras devolver la compra: factura anulacion_pendiente", "[final=anulado]"],
  com: ["[sin consentimiento: encolados=0", "[con consentimiento: encolados=1]", "reintento en ~2 min", "Máximo 3 campañas"],
  qr: ["Código no reconocido", "ya_registrada=false clase=ZZ Clase Ahora", "[2º escaneo: ya_registrada=true]", "asistencias marcadas=1"],
  cat: ["la clienta ve el producto=1", "módulo tienda en mis_modulos=1"],
  espera: ["[reserva propia: vínculo ok=t, créditos 0->1]", "[cancela: crédito de la clienta 1 de vuelta=t]", "vínculo ok=t, créditos 0->1]", "[la promovida cancela: créditos de vuelta=t]", "Necesitas comprar un paquete"],
};

let fallos = 0;
for (const [nombre, esperados] of Object.entries(ESPERADO)) {
  const sql = readFileSync(join(dir, `${nombre}.sql`), "utf8");
  const r = consulta(TOKEN, REF, sql);
  const msg = (r.message ?? JSON.stringify(r)).replace(/\\n/g, " ");
  const faltan = esperados.filter((e) => !msg.includes(e));
  const ok = faltan.length === 0;
  if (!ok) fallos++;
  console.log(`${ok ? "✔" : "✘"} ${nombre.padEnd(6)} ${ok ? "" : "FALTA: " + faltan.join(" | ") + "\n         " + msg.slice(0, 400)}`);
}
for (const r of await correrConcurrencia(TOKEN, REF)) { if (!r.ok) fallos++; console.log(`${r.ok ? "✔" : "✘"} ${r.nombre} — ${r.detalle}`); }

const BLANCA = ["captar_lead","horarios_publicos","invitacion_clienta_por_token","invitacion_personal_por_token","pago_webhook","tenant_por_dominio","testimonios_publicos"].join(", ");
const anon = consulta(TOKEN, REF, "select string_agg(proname, ', ' order by proname) n from pg_proc where pronamespace='public'::regnamespace and prokind='f' and has_function_privilege('anon', oid, 'execute')")[0]?.n;
if (anon !== BLANCA) { fallos++; console.log(`✘ El visitante sin cuenta puede ejecutar funciones fuera de la lista blanca: ${anon}`); } else console.log("✔ El visitante sin cuenta solo puede ejecutar las 7 funciones públicas");

const sucio = consulta(TOKEN, REF, "select (select count(*) from clientes where nombre like 'ZZ%')+(select count(*) from sedes where name like 'ZZ%')+(select count(*) from horarios where nombre_clase like 'ZZ%')+(select count(*) from productos where nombre like 'ZZ%')+(select count(*) from paquetes where nombre like 'ZZ%')+(select count(*) from plataforma_empresas where nombre like 'ZZ%') as n")[0]?.n;
console.log(sucio === 0 ? "✔ Sin datos de prueba residuales" : `✘ Quedaron ${sucio} registros de prueba`);
if (sucio !== 0) fallos++;
console.log(fallos === 0 ? "\nTODOS LOS ESCENARIOS PASARON" : `\n${fallos} ESCENARIO(S) FALLARON`);
process.exit(fallos === 0 ? 0 : 1);
