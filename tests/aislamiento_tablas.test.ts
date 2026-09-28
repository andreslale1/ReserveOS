import { beforeAll, describe, expect, it } from "vitest";
import { login, selectFrom } from "./helpers";
import { TENANT_A, TENANT_B, USER_A_EMAIL, USER_B_EMAIL, TEST_PASSWORD } from "./fixtures";

// Automatiza las verificaciones manuales de los Hitos B/C: cada usuario ve exactamente sus propias
// filas por API real (REST + JWT), nunca las del otro tenant. Si esto se rompe con un cambio futuro
// de RLS, esta prueba lo agarra antes que un usuario real.

let tokenA: string;
let tokenB: string;

beforeAll(async () => {
  tokenA = await login(USER_A_EMAIL, TEST_PASSWORD);
  tokenB = await login(USER_B_EMAIL, TEST_PASSWORD);
});

describe("aislamiento entre tenants — lectura directa de tablas", () => {
  it.each([
    ["clientes", "?select=tenant_id"],
    ["horarios", "?select=tenant_id"],
    ["reservas", "?select=tenant_id"],
    ["paquetes", "?select=tenant_id"],
  ])("%s: usuario A solo ve filas de su propio tenant", async (table, query) => {
    const { status, body } = await selectFrom(tokenA, table, query);
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    for (const row of body) expect(row.tenant_id).toBe(TENANT_A);
  });

  it.each([
    ["clientes", "?select=tenant_id"],
    ["horarios", "?select=tenant_id"],
    ["reservas", "?select=tenant_id"],
    ["paquetes", "?select=tenant_id"],
  ])("%s: usuario B solo ve filas de su propio tenant", async (table, query) => {
    const { status, body } = await selectFrom(tokenB, table, query);
    expect(status).toBe(200);
    for (const row of body) expect(row.tenant_id).toBe(TENANT_B);
  });

  it("anon sin sesión recibe 401 (permission denied), no una lista vacía", async () => {
    const { status, body } = await selectFrom(null, "tenants", "?select=slug");
    expect(status).toBe(401);
    expect(body.code).toBe("42501");
  });

  it("un tenant nunca aparece en la respuesta del otro (tenants)", async () => {
    const { body: asA } = await selectFrom(tokenA, "tenants", "?select=id");
    const { body: asB } = await selectFrom(tokenB, "tenants", "?select=id");
    const idsA = asA.map((r: { id: string }) => r.id);
    const idsB = asB.map((r: { id: string }) => r.id);
    expect(idsA).not.toContain(TENANT_B);
    expect(idsB).not.toContain(TENANT_A);
  });
});
