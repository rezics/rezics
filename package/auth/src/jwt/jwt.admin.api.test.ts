import { describe, expect, mock, test } from "bun:test";

let sessionRole: string | null = "admin";

const rotate = mock(async () => ({
  id: "jwt-service-1",
  serviceKey: "auth-local",
  issuer: "http://localhost:35003",
  audience: "rezics",
  jwksUrl: "http://localhost:35003/.well-known/jwks.json",
  jwksPath: "/.well-known/jwks.json",
  isLocalIssuer: true,
  isActive: true,
  createdAt: "2026-05-28T00:00:00.000Z",
  updatedAt: "2026-05-28T00:00:00.000Z",
}));

mock.module("../auth/instance", () => ({
  auth: {
    api: {
      getSession: mock(async () =>
        sessionRole
          ? {
              user: {
                id: "auth-user-1",
                role: sessionRole,
              },
            }
          : null,
      ),
    },
  },
}));

mock.module("./jwt.admin.service", () => ({
  authJwtServiceAdminService: {
    list: mock(),
    fetch: mock(),
    create: mock(),
    update: mock(),
    activate: mock(),
    deactivate: mock(),
    rotate,
  },
}));

describe("auth jwtServiceAdminRouter", () => {
  test("denies non-owner JWT rotation without mutating service state", async () => {
    sessionRole = "admin";
    rotate.mockClear();

    const { jwtServiceAdminRouter } = await import("./jwt.admin.api");
    const response = await jwtServiceAdminRouter.handle(
      new Request("http://localhost/admin/jwt-services/auth-local/rotate", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(403);
    expect(await response.text()).toBe("Forbidden");
    expect(rotate).not.toHaveBeenCalled();
  });
});
