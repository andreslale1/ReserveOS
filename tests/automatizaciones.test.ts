// AUTOMATIZACIONES PROGRAMADAS: lógica con hora simulada (escenario SQL en transacción que se deshace), programación en pg_cron,
// panel de la dueña por API con sesión real, y garantía de que nada de esto es ejecutable desde el navegador.
import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import roles from "./fixtures/roles.json";
import { login, rpc } from "./helpers";
// @ts-expect-error módulo .mjs sin tipos
import { consulta } from "./escenarios/concurrencia.mjs";

const MGMT = process.env.SUPABASE_ACCESS_TOKEN ?? "";
const REF = process.env.SUPABASE_PROJECT_REF ?? "agkqppuhyltirrhngybq";
const sql = (q: string) => consulta(MGMT, REF, q) as Record<string, unknown>[] & { message?: string };
const email = (a: string) => `${a}@${roles.dominio}`;
const tok: Record<string, string> = {};
let T = "";
const JOBS: Record<string, string> = {
  recordatorio_clase_1h: "*/10 * * * *", recordatorio_reserva_agendada: "*/15 * * * *", recordatorio_confirmacion: "*/10 * * * *", recordatorio_horario_fijo: "*/15 * * * *",
  aviso_inasistencia: "*/10 * * * *", aviso_asistencia_confirmada: "*/10 * * * *", avisos_operativos: "*/10 * * * *", liberar_cupos_no_confirmados: "*/10 * * * *",
  lista_espera_vencida: "*/15 * * * *", reconciliar_pagos: "*/2 * * * *", salud_sistema: "7 * * * *", paquetes_por_vencer: "7 * * * *",
  clientas_inactivas: "7 * * * *", cuentas_sin_password: "7 * * * *", analisis_semanal: "30 * * * *",
};

beforeAll(async () => {
  if (!MGMT) throw new Error("Falta SUPABASE_ACCESS_TOKEN");
  for (const a of ["duena", "recep1", "admin1", "instr12"]) tok[a] = await login(email(a), roles.password);
  T = String(sql("select id from tenants where slug='vim-prueba'")[0].id);
}, 60_000);

describe("lógica con hora simulada (miércoles 14/10/2026 09:00 de Guatemala)", () => {
  it("las 14 automatizaciones encolan lo correcto, una sola vez, respetando módulos, apagado por estudio, preferencias y la hora de la sede", () => {
    const r = sql(readFileSync(resolve(process.cwd(), "tests/escenarios/auto.sql"), "utf8")) as unknown as { message: string };
    const m = String(r.message);
    expect(m).toContain("RESULTADO:");
    for (const esperado of [
      "[rec1h nuevos>0=t, en cola=2, repetir=0, solo-1-reserva=t]", "[agendada nuevos>0=t, repetir=0, marca=t]", "[confirmar pedido=t, ultimo=t, repetir=0]",
      "[inasistencia nuevos>0=t, repetir=0, solo-c1=t]", "[asistencia nuevos>0=t, repetir=0, marca=t]", "[operativos nuevos=2, repetir=0, fin=t, inicio=t]", "[fijo nuevos>0=t, repetir=0]",
      "[apagada=0, sin-marca=t]", "[sin-consentimiento=0]", "[salud 9am sin correr=t]", "[salud 8am: aviso a dueña>0=t, repetir=0, cupos=1, fila=1]", "[vence nuevos>0=t, repetir=0]",
      "[inactivas 10am nuevos>0=t, repetir=0, c1-no=t]", "[sinpass 11am nuevos>0=t, repetir=0, enlace=t]", "[semanal nuevos>0=t, repetir=0, martes-no=t]", "[pagos marcados=1, repetir=0]",
    ]) expect(m, esperado).toContain(esperado);
  }, 120_000);
  it("no deja datos de prueba (el escenario se deshace)", () => {
    expect(Number(sql("select count(*) n from horarios where nombre_clase like 'ZZ Auto%'")[0].n)).toBe(0);
    expect(Number(sql("select count(*) n from clientes where nombre in ('ZZ Inactiva','ZZ SinPass')")[0].n)).toBe(0);
  });
});

describe("programación y seguridad", () => {
  it("los 15 trabajos están programados y activos, y el antiguo diario en UTC ya no existe", () => {
    const filas = sql("select jobname, schedule, active from cron.job") as unknown as { jobname: string; schedule: string; active: boolean }[];
    for (const [nombre, horario] of Object.entries(JOBS)) { const f = filas.find((x) => x.jobname === nombre); expect(f, nombre).toBeTruthy(); expect(f!.schedule).toBe(horario); expect(f!.active).toBe(true); }
    expect(filas.find((x) => x.jobname === "encolar_recordatorios")).toBeUndefined();
  });
  it("ninguna función de automatización se puede ejecutar desde el navegador (ni sin sesión ni con sesión)", async () => {
    const r = sql("select count(*) n from pg_proc p where p.pronamespace='public'::regnamespace and (p.proname like 'auto\\_%' or p.proname like '\\_auto%' or p.proname like '\\_encolar\\_%' or p.proname='encolar_recordatorios') and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))");
    expect(Number(r[0].n)).toBe(0);
    for (const fn of ["auto_recordatorio_clase", "auto_salud_sistema", "auto_analisis_semanal", "_encolar_auto", "_encolar_transaccional"]) expect((await rpc(tok.duena, fn, {})).status, fn).not.toBe(200);
  });
  it("las tablas nuevas tienen RLS y no son legibles directamente", async () => {
    const r = sql("select relname, relrowsecurity from pg_class where relname in ('automatizaciones','automatizaciones_tenant','automatizaciones_latido','automatizaciones_ejecuciones','salud_chequeos')") as unknown as { relrowsecurity: boolean }[];
    expect(r.length).toBe(5); for (const x of r) expect(x.relrowsecurity).toBe(true);
  });
});

describe("panel de la dueña, con sesión real", () => {
  it("la dueña ve las 15 automatizaciones con su estado", async () => {
    const r = await rpc(tok.duena, "automatizaciones_panel", { p_tenant_id: T });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const b = r.body as { automatizaciones: { clave: string; activa: boolean; modulo_activo: boolean; toggleable: boolean }[]; cola: { pendientes: number } };
    expect(b.automatizaciones.length).toBe(15);
    expect(b.automatizaciones.find((a) => a.clave === "liberar_cupos")!.toggleable).toBe(false);
    expect(typeof b.cola.pendientes).toBe("number");
  });
  it("recepción y administración de sede no entran al panel ni apagan nada", async () => {
    for (const a of ["recep1", "admin1", "instr12"]) {
      expect((await rpc(tok[a], "automatizaciones_panel", { p_tenant_id: T })).status, a).toBe(400);
      expect((await rpc(tok[a], "automatizacion_configurar", { p_tenant_id: T, p_clave: "aviso_asistencia", p_activa: false })).status, a).toBe(400);
      expect((await rpc(tok[a], "salud_ejecutar_ahora", { p_tenant_id: T })).status, a).toBe(400);
    }
  });
  it("la dueña apaga y vuelve a prender una automatización; las de núcleo no se pueden apagar", async () => {
    expect([200, 204]).toContain((await rpc(tok.duena, "automatizacion_configurar", { p_tenant_id: T, p_clave: "aviso_asistencia", p_activa: false })).status);
    let b = (await rpc(tok.duena, "automatizaciones_panel", { p_tenant_id: T })).body as { automatizaciones: { clave: string; activa: boolean }[] };
    expect(b.automatizaciones.find((a) => a.clave === "aviso_asistencia")!.activa).toBe(false);
    expect([200, 204]).toContain((await rpc(tok.duena, "automatizacion_configurar", { p_tenant_id: T, p_clave: "aviso_asistencia", p_activa: true })).status);
    b = (await rpc(tok.duena, "automatizaciones_panel", { p_tenant_id: T })).body as typeof b;
    expect(b.automatizaciones.find((a) => a.clave === "aviso_asistencia")!.activa).toBe(true);
    expect((await rpc(tok.duena, "automatizacion_configurar", { p_tenant_id: T, p_clave: "liberar_cupos", p_activa: false })).status).toBe(400);
    sql(`delete from automatizaciones_tenant where tenant_id='${T}'`);
  });
  it("«Verificar ahora» guarda el chequeo de salud del día", async () => {
    const r = await rpc(tok.duena, "salud_ejecutar_ahora", { p_tenant_id: T });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const s = r.body as { problemas: number; resultados: Record<string, { n: number }> };
    expect(Object.keys(s.resultados).sort()).toEqual(["cupos_excedidos", "inventario_negativo", "membresias_excedidas", "pagos_sin_resolver", "reservas_duplicadas", "reservas_fecha_invalida"]);
    expect(typeof s.problemas).toBe("number");
  });
  it("otro estudio no puede consultar ni cambiar el de VIM", async () => {
    const otra = await login(email("duena-una"), roles.password);
    expect((await rpc(otra, "automatizaciones_panel", { p_tenant_id: T })).status).toBe(400);
    expect((await rpc(otra, "automatizacion_configurar", { p_tenant_id: T, p_clave: "aviso_asistencia", p_activa: false })).status).toBe(400);
  });
});
