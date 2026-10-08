// MATRIZ RUTA → RPC → ROL de la consola owner (F-04, F-05, F-06, F-12): con sesión real de cada uno de los 8 roles de plataforma,
// toda ruta visible en el menú debe cargar TODAS sus consultas (incluidas las secundarias, como el selector de estudios),
// y toda ruta oculta debe negarse en el servidor, no solo en el menú.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { login, rpc } from "./helpers";
import { GRUPOS } from "../web/components/owner/nav-config";
// @ts-expect-error módulo .mjs sin tipos
import { consulta } from "./escenarios/concurrencia.mjs";

const MGMT = process.env.SUPABASE_ACCESS_TOKEN ?? "";
const REF = process.env.SUPABASE_PROJECT_REF ?? "agkqppuhyltirrhngybq";
const env = Object.fromEntries(readFileSync(resolve(process.cwd(), "web/.env.local"), "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY, URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const PASS = "MatrizRoles2026!", DOM = "matriz-roles.test";
const ROLES = ["operador", "ventas", "marketing", "finanzas", "soporte", "implementacion", "ingenieria", "auditor"] as const;
const sql = (q: string) => { const r = consulta(MGMT, REF, q); if (r && !Array.isArray(r) && r.message) throw new Error(String(r.message).slice(0, 300)); return r as Record<string, unknown>[]; };
const em = (r: string) => `tmpmat-${r}@${DOM}`;
const tok: Record<string, string> = {}, uid: Record<string, string> = {};

// Consultas que carga cada página (todas, no solo la principal). `p` = principal: si falla, la página falla; el resto son selectores/secundarias.
const RUTAS: Record<string, [string, Record<string, unknown>?][]> = {
  "/owner/direccion": [["plataforma_direccion"], ["owner_direccion_extra"]],
  "/owner/tareas": [["tareas_listar"], ["tareas_responsables"], ["listar_tenants_plataforma"]],
  "/owner/pipeline": [["plataforma_leads_listar"], ["plataforma_resumen"]],
  "/owner/marketing": [["campanas_listar"], ["exclusiones_listar"]],
  "/owner/contratos": [["contratos_listar"], ["listar_tenants_plataforma"]],
  "/owner": [["listar_tenants_plataforma"]],
  "/owner/activaciones": [["proyectos_listar"], ["listar_tenants_plataforma"]],
  "/owner/dominios": [["dominios_plataforma"]],
  "/owner/planes": [["planes_listar"]],
  "/owner/cobros": [["plataforma_resumen"], ["plataforma_estudios_cobro"], ["plataforma_cobros_listar", { p_estado: null }], ["planes_listar"]],
  "/owner/rentabilidad": [["costos_listar", { p_desde: "2026-01-01", p_hasta: "2026-12-31" }], ["listar_tenants_plataforma"]],
  "/owner/soporte": [["tickets_listar"], ["incidentes_listar"], ["listar_tenants_plataforma"]],
  "/owner/salud": [["plataforma_salud"], ["salud_historial"]],
  "/owner/equipo": [["equipo_listar"], ["equipo_invitaciones_listar"], ["mi_rol_plataforma"]],
  "/owner/auditoria": [["plataforma_auditoria_buscar", {}], ["plataforma_auditoria_estudios"]],
};
// Consulta que de verdad restringe la ruta (las demás pueden ser catálogos compartidos, p. ej. planes o el selector de estudios).
const GUARDA: Record<string, number> = { "/owner": -1, "/owner/planes": -1, "/owner/cobros": 2 };
const visibles = (rol: string) => new Set(GRUPOS.flatMap((g) => g.enlaces).filter((l) => l.roles.includes(rol)).map((l) => l.href));

async function crear(email: string) {
  const r = await fetch(`${URL_}/auth/v1/admin/users`, { method: "POST", headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" }, body: JSON.stringify({ email, password: PASS, email_confirm: true }) });
  if (!r.ok && !/already|registered|exists/i.test(await r.text())) throw new Error(`no se pudo crear ${email}`);
}
const limpiar = () => { sql(`delete from plataforma_staff where user_id in (select id from auth.users where email like 'tmpmat-%@${DOM}')`); sql(`delete from admin_acciones_log where actor_id in (select id from auth.users where email like 'tmpmat-%@${DOM}')`); };

beforeAll(async () => {
  if (!MGMT) throw new Error("Falta SUPABASE_ACCESS_TOKEN");
  limpiar();
  for (const r of ROLES) { await crear(em(r)); uid[r] = String(sql(`select id from auth.users where email='${em(r)}'`)[0].id); sql(`insert into plataforma_staff(user_id,nombre,rol) values ('${uid[r]}','TMP ${r}','${r}') on conflict (user_id) do update set rol=excluded.rol`); tok[r] = await login(em(r), PASS); }
}, 180_000);
afterAll(async () => { limpiar(); for (const r of ROLES) await fetch(`${URL_}/auth/v1/admin/users/${uid[r]}`, { method: "DELETE", headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } }); });

describe("matriz ruta → consultas → rol, con sesión real", () => {
  for (const rol of ROLES) {
    it(`${rol}: cada ruta del menú carga todas sus consultas y las ocultas se niegan en el servidor`, async () => {
      const vis = visibles(rol), fallas: string[] = [];
      for (const [ruta, consultas] of Object.entries(RUTAS)) {
        for (const [fn, args] of consultas) {
          const r = await rpc(tok[rol], fn, args ?? {});
          const ok = r.status === 200;
          if (vis.has(ruta) && !ok) fallas.push(`VISIBLE pero falla: ${ruta} → ${fn} (${r.status})`);
        }
        if (!vis.has(ruta)) {
          const gi = GUARDA[ruta] ?? 0; if (gi < 0) continue; const [fn, args] = consultas[gi];
          const r = await rpc(tok[rol], fn, args ?? {});
          if (r.status === 200) fallas.push(`OCULTA pero el servidor responde: ${ruta} → ${fn}`);
        }
      }
      expect(fallas, fallas.join("\n")).toEqual([]);
    }, 120_000);
  }
});

describe("Dirección entrega a cada rol solo su parte (F-12)", () => {
  const claves = async (rol: string) => Object.keys((await rpc(tok[rol], "plataforma_direccion")).body as object);
  it("ventas ve pipeline y no dinero ni servicio", async () => { const k = await claves("ventas"); expect(k).toContain("valor_pipeline"); for (const x of ["cobros_en_mora", "tickets_abiertos", "estudios_activos"]) expect(k).not.toContain(x); });
  it("finanzas ve dinero y no pipeline ni servicio", async () => { const k = await claves("finanzas"); expect(k).toContain("cobros_en_mora"); for (const x of ["valor_pipeline", "seguimientos_vencidos", "tickets_abiertos"]) expect(k).not.toContain(x); });
  for (const rol of ["soporte", "implementacion", "ingenieria"]) it(`${rol} ve servicio y no pipeline ni dinero`, async () => { const k = await claves(rol); expect(k).toContain("tickets_abiertos"); for (const x of ["valor_pipeline", "cobros_en_mora"]) expect(k).not.toContain(x); });
  it("la cola de acciones también se filtra por rol", async () => {
    const tipos = async (rol: string) => (((await rpc(tok[rol], "owner_direccion_extra")).body as { acciones: { tipo: string }[] }).acciones).map((a) => a.tipo);
    for (const t of await tipos("finanzas")) expect(t).toMatch(/^Cobro/);
    for (const t of await tipos("ventas")) expect(t).toMatch(/^(Propuesta|Activación)/);
  });
  it("marketing ya no ve el enlace de Dirección", () => { expect(visibles("marketing").has("/owner/direccion")).toBe(false); });
});
