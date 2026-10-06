import { beforeAll, describe, expect, it } from "vitest";
import { login, rpc } from "./helpers";
import { TEST_PASSWORD, USER_A_EMAIL } from "./fixtures";

let tokenA: string;
beforeAll(async () => {
  tokenA = await login(USER_A_EMAIL, TEST_PASSWORD);
});

// Un visitante sin cuenta solo puede ejecutar la lista blanca pública. Cualquier otra función debe responder "permission denied".
const PROHIBIDAS_PARA_ANONIMO: [string, Record<string, unknown>][] = [
  ["confirmar_pago_transaccion", { p_transaccion_id: "00000000-0000-0000-0000-000000000000" }],
  ["confirmar_transaccion_carrito", { p_transaccion_id: "00000000-0000-0000-0000-000000000000" }],
  ["devolver_clase_a_membresia", { p_cliente_id: "00000000-0000-0000-0000-000000000000" }],
  ["gasto_productos_clienta", { p_cliente_id: "00000000-0000-0000-0000-000000000000" }],
  ["otorgar_bono_referido_si_corresponde", { p_cliente_id: "00000000-0000-0000-0000-000000000000", p_paquete_id: "00000000-0000-0000-0000-000000000000" }],
  ["clientas_para_recordatorio_password", { p_tenant_id: "00000000-0000-0000-0000-000000000000" }],
  ["usuario_tiene_password", { p_user_id: "00000000-0000-0000-0000-000000000000" }],
  ["crear_sede", { p_tenant_id: "00000000-0000-0000-0000-000000000000", p_nombre: "x" }],
  ["plataforma_resumen", {}],
  ["mis_contextos", {}],
];
const PROHIBIDAS_PARA_AUTENTICADO: [string, Record<string, unknown>][] = [
  ["confirmar_pago_transaccion", { p_transaccion_id: "00000000-0000-0000-0000-000000000000" }],
  ["confirmar_transaccion_carrito", { p_transaccion_id: "00000000-0000-0000-0000-000000000000" }],
  ["devolver_clase_a_membresia", { p_cliente_id: "00000000-0000-0000-0000-000000000000" }],
  ["liberar_cupos_no_confirmados", {}],
];

describe("superficie de funciones expuestas", () => {
  for (const [fn, args] of PROHIBIDAS_PARA_ANONIMO) {
    it(`un visitante sin cuenta no puede ejecutar ${fn}`, async () => {
      const { status, body } = await rpc(null, fn, args);
      expect([401, 403]).toContain(status);
      expect(JSON.stringify(body)).toMatch(/permission denied|not allowed|JWT/i);
    });
  }
  for (const [fn, args] of PROHIBIDAS_PARA_AUTENTICADO) {
    it(`un usuario con cuenta tampoco puede ejecutar la interna ${fn}`, async () => {
      const { status, body } = await rpc(tokenA, fn, args);
      expect([401, 403]).toContain(status);
      expect(JSON.stringify(body)).toMatch(/permission denied/i);
    });
  }
  it("el visitante SÍ puede ver la página pública de un estudio (lista blanca)", async () => {
    const { status } = await rpc(null, "horarios_publicos", { p_slug: "no-existe-zzz" });
    expect(status).toBe(200);
  });
});
