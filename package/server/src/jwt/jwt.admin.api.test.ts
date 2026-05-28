import { describe, expect, mock, test } from "bun:test";
import { Elysia } from "elysia";

let currentIdentity = {
  sub: "admin-1",
  userId: "admin-1",
  permission: { role: "ADMIN" },
};
let dbRoot = false;

const rotate = mock(async () => ({
  id: "jwt-service-1",
  serviceKey: "server-local",
  issuer: "http://localhost:35002",
  audience: "rezics",
  jwksUrl: "http://localhost:35002/.well-known/jwks.json",
  jwksPath: "/.well-known/jwks.json",
  isLocalIssuer: true,
  isActive: true,
  createdAt: "2026-05-28T00:00:00.000Z",
  updatedAt: "2026-05-28T00:00:00.000Z",
}));

mock.module("@/middleware", () => ({
  authMacro: new Elysia({ name: "macro/auth" }).macro("requireLogin", {
    resolve: () => ({ identity: currentIdentity }),
  }),
  verifyRootFromDb: async () => dbRoot,
}));

mock.module("./jwt.admin.service", () => ({
  jwtServiceAdminService: {
    list: mock(),
    fetch: mock(),
    create: mock(),
    update: mock(),
    activate: mock(),
    deactivate: mock(),
    rotate,
  },
}));

describe("jwtServiceAdminApi", () => {
  test("denies non-root JWT rotation without mutating service state", async () => {
    currentIdentity = {
      sub: "admin-1",
      userId: "admin-1",
      permission: { role: "ADMIN" },
    };
    dbRoot = false;
    rotate.mockClear();

    const { jwtServiceAdminApi } = await import("./jwt.admin.api");
    const response = await jwtServiceAdminApi.handle(
      new Request("http://localhost/admin/jwt-services/server-local/rotate", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(403);
    expect(await response.text()).toBe("Forbidden: Root role required");
    expect(rotate).not.toHaveBeenCalled();
  });
});
