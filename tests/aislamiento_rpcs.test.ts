import { beforeAll, describe, expect, it } from "vitest";
import { login, rpc } from "./helpers";
import {
  TENANT_A,
  TENANT_B,
  HORARIO_B,
  USER_A_EMAIL,
  USER_B_EMAIL,
  TEST_PASSWORD,
} from "./fixtures";

let tokenA: string;
let tokenB: string;

beforeAll(async () => {
  tokenA = await login(USER_A_EMAIL, TEST_PASSWORD);
  tokenB = await login(USER_B_EMAIL, TEST_PASSWORD);
});

describe("aislamiento entre tenants — RPCs de negocio", () => {
  it("usuario A no puede unirse a la lista de espera de un horario de tenant B", async () => {
    const { status, body } = await rpc(tokenA, "unirse_lista_espera", {
      p_horario_id: HORARIO_B,
      p_fecha: "2026-11-01",
    });
    expect(status).toBe(400);
    expect(body.message).toMatch(/Completa tu perfil|Horario no válido/);
  });

  it("usuario A no puede listar clientas de cobro del tenant B (RPC devuelve vacío, no error de datos ajenos)", async () => {
    const { status, body } = await rpc(tokenA, "clientas_para_cobro", { p_tenant_id: TENANT_B });
    expect(status).toBe(200);
    expect(body).toEqual([]);
  });

  it("usuario A no puede pedir KPIs del tenant B (null, no datos)", async () => {
    const { status, body } = await rpc(tokenA, "kpi_resumen_clientas", { p_tenant_id: TENANT_B });
    expect(status).toBe(200);
    expect(body).toBeNull();
  });

  it("mi_permiso: dueña de tenant A tiene scope G en P35 (gastos de sede)", async () => {
    const { status, body } = await rpc(tokenA, "mi_permiso", { p_tenant_id: TENANT_A, p_action_id: "P35" });
    expect(status).toBe(200);
    expect(body[0]).toEqual({ scope: "G", requiere_delegacion: false });
  });

  it("mi_permiso: usuario A no tiene ningún permiso en el tenant B", async () => {
    const { status, body } = await rpc(tokenA, "mi_permiso", { p_tenant_id: TENANT_B, p_action_id: "P35" });
    expect(status).toBe(200);
    expect(body).toEqual([]);
  });
});
