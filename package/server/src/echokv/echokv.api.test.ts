import { describe, expect, mock, test } from "bun:test";
import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/rezics_book";
process.env.AUTH_BASE_URL ??= "http://localhost:3001";

mock.module("@/middleware/permission", () => ({
  authMacro: new Elysia({ name: "macro/auth" }).macro("requireLogin", {
    resolve: () => ({ identity: { unitId: "test", role: "MEMBER" } }),
  }),
  tryResolveIdentity: async () => null,
  isAdminRole: () => false,
  verifyAdminFromDb: async () => true,
  verifyRootFromDb: async () => true,
}));

mock.module("./echokv.service", () => ({
  echoKvService: {
    listKeys: async () => ["alpha", "beta"],
    get: async () => ({ value: "ok" }),
    set: async () => ({ value: "ok" }),
  },
}));

describe("echokv router cors", () => {
  test("keeps non-session feature routes on credentialed cors", async () => {
    const { echoKvApi } = await import("./echokv.api");
    const app = new Elysia()
      .use(
        cors({
          origin: ["https://rezics.com"],
          credentials: true,
        }),
      )
      .use(echoKvApi);

    const response = await app.handle(
      new Request("http://localhost/echokv/list", {
        headers: {
          Origin: "https://rezics.com",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "https://rezics.com",
    );
    expect(response.headers.get("access-control-allow-credentials")).toBe(
      "true",
    );
    expect(await response.json()).toEqual({
      keys: ["alpha", "beta"],
    });
  });
});
