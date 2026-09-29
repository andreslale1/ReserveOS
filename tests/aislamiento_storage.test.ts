import { beforeAll, describe, expect, it } from "vitest";
import { login, uploadObject, ONE_PIXEL_PNG } from "./helpers";
import { CLIENTE_A, TENANT_A, TENANT_B, CLIENTE_B, USER_A_EMAIL, TEST_PASSWORD } from "./fixtures";

let tokenA: string;

beforeAll(async () => {
  tokenA = await login(USER_A_EMAIL, TEST_PASSWORD);
});

describe("aislamiento entre tenants — Storage (bucket comprobantes)", () => {
  it("usuario A sube un comprobante a su propia carpeta (tenant/cliente)", async () => {
    const path = `${TENANT_A}/${CLIENTE_A}/vitest-${Date.now()}.png`;
    const { status } = await uploadObject(tokenA, "comprobantes", path, ONE_PIXEL_PNG, "image/png");
    expect(status).toBe(200);
  });

  it("usuario A no puede subir a la carpeta de la clienta del tenant B", async () => {
    const path = `${TENANT_B}/${CLIENTE_B}/vitest-hack-${Date.now()}.png`;
    const { status, body } = await uploadObject(tokenA, "comprobantes", path, ONE_PIXEL_PNG, "image/png");
    expect(status).toBe(400);
    expect(body.error).toBe("Unauthorized");
  });
});

describe("aislamiento entre tenants — Storage (bucket public-assets)", () => {
  it("dueña de tenant A sube un asset a su propio tenant", async () => {
    const path = `${TENANT_A}/vitest-${Date.now()}.png`;
    const { status } = await uploadObject(tokenA, "public-assets", path, ONE_PIXEL_PNG, "image/png");
    expect(status).toBe(200);
  });

  it("dueña de tenant A no puede subir un asset a la carpeta del tenant B", async () => {
    const path = `${TENANT_B}/vitest-hack-${Date.now()}.png`;
    const { status, body } = await uploadObject(tokenA, "public-assets", path, ONE_PIXEL_PNG, "image/png");
    expect(status).toBe(400);
    expect(body.error).toBe("Unauthorized");
  });

  it("lectura pública (anon, sin sesión) funciona — es contenido de portal, a propósito abierto", async () => {
    const path = `${TENANT_A}/vitest-${Date.now()}.png`;
    await uploadObject(tokenA, "public-assets", path, ONE_PIXEL_PNG, "image/png");
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/public-assets/${path}`;
    const res = await fetch(url);
    expect(res.status).toBe(200);
  });
});
