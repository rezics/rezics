import { describe, expect, mock, test } from "bun:test";
import { Elysia } from "elysia";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/rezics_book";
process.env.AUTH_BASE_URL ??= "http://localhost:3001";

const getMainSessionPublicJwks = mock(async () => ({
  keys: [
    {
      kty: "EC",
      use: "sig",
      alg: "ES256",
      kid: "server-kid",
      crv: "P-256",
      x: "x-coordinate",
      y: "y-coordinate",
    },
  ],
}));

const mockGetAuthSessionState = mock(async () => ({
  session: { id: "session-1", token: "token-1", expiresAt: "", userId: "u-1" },
  user: {
    id: "u-1",
    name: "Test",
    role: "user",
    email: "test@test.com",
    emailVerified: true,
  },
  authSession: {
    canAcquireMemberToken: true,
    readinessStatus: "ready" as const,
  },
}));

const mockAssertMainServerEligibility = mock(() => {});

mock.module("@/middleware/permission", () => ({
  authMacro: new Elysia({ name: "macro/auth" })
    .macro("requireLogin", {
      resolve: () => ({ identity: { unitId: "user-1" } }),
    })
    .macro("requireOwner", {
      requireLogin: true,
      resolve: () => ({ session: {}, currentUser: {} }),
    })
    .macro("requireAdmin", { requireOwner: true }),
  buildActorFromContext: () => ({}),
}));

mock.module("@/middleware/session-state", () => ({
  getAuthSessionState: mockGetAuthSessionState,
  assertMainServerEligibility: mockAssertMainServerEligibility,
}));

mock.module("@/user/service/user.service", () => ({
  userService: {
    getByUnitId: async () => ({
      unitId: "user-1",
      permission: { role: ["USER"] },
    }),
  },
}));

mock.module("./jwt/jwt.service", () => ({
  mainSessionJwtPlugin: new Elysia().decorate("jwt", {
    sign: async () => "signed-token",
  }),
  getMainSessionPublicJwks,
  buildRezicsSessionClaims: () => ({
    unitId: "user-1",
    permission: { role: "USER" },
  }),
  REZICS_SESSION_HEADER: "x-rezics-session-token",
  getMainSessionJwtContext: () => ({}),
}));

describe("session jwks route", () => {
  test("publishes the canonical public jwks document without auth", async () => {
    const { sessionApi } = await import("./session.api");

    const response = await sessionApi.handle(
      new Request("http://localhost/session/jwks"),
    );

    expect(response.status).toBe(200);
    expect(getMainSessionPublicJwks).toHaveBeenCalledTimes(1);
    expect(await response.json()).toEqual({
      keys: [
        {
          kty: "EC",
          use: "sig",
          alg: "ES256",
          kid: "server-kid",
          crv: "P-256",
          x: "x-coordinate",
          y: "y-coordinate",
        },
      ],
    });
  });
});

describe("POST /session/token eligibility enforcement", () => {
  test("verified user receives session token", async () => {
    mockGetAuthSessionState.mockResolvedValueOnce({
      session: { id: "s-1", token: "t-1", expiresAt: "", userId: "u-1" },
      user: {
        id: "u-1",
        name: "Test",
        role: "user",
        email: "test@test.com",
        emailVerified: true,
      },
      authSession: {
        canAcquireMemberToken: true,
        readinessStatus: "ready" as const,
      },
    });
    mockAssertMainServerEligibility.mockImplementationOnce(() => {});

    const { sessionApi } = await import("./session.api");

    const response = await sessionApi.handle(
      new Request("http://localhost/session/token", {
        method: "POST",
        headers: { Authorization: "Bearer valid-token" },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty("token");
  });

  test("unverified user gets 403", async () => {
    mockGetAuthSessionState.mockResolvedValueOnce({
      session: { id: "s-1", token: "t-1", expiresAt: "", userId: "u-1" },
      user: {
        id: "u-1",
        name: "Test",
        role: "user",
        email: "test@test.com",
        emailVerified: false,
      },
      authSession: {
        canAcquireMemberToken: false,
        readinessStatus: "needs-verification",
      },
    } as any);
    mockAssertMainServerEligibility.mockImplementationOnce(() => {
      throw new Error(
        "Forbidden: Auth session is not ready for main-server access",
      );
    });

    const { sessionApi } = await import("./session.api");

    const response = await sessionApi.handle(
      new Request("http://localhost/session/token", {
        method: "POST",
        headers: { Authorization: "Bearer valid-token" },
      }),
    );

    expect(response.status).toBe(403);
  });

  test("missing session gets 401", async () => {
    mockGetAuthSessionState.mockResolvedValueOnce({
      session: { id: null, token: null, expiresAt: "", userId: "" },
      user: { id: null, name: "", role: "", email: "", emailVerified: false },
      authSession: {
        canAcquireMemberToken: false,
        readinessStatus: "needs-onboarding",
      },
    } as any);
    mockAssertMainServerEligibility.mockImplementationOnce(() => {
      throw new Error("Unauthorized: Missing auth session state");
    });

    const { sessionApi } = await import("./session.api");

    const response = await sessionApi.handle(
      new Request("http://localhost/session/token", {
        method: "POST",
        headers: { Authorization: "Bearer valid-token" },
      }),
    );

    expect(response.status).toBe(401);
  });

  test("auth service unavailable returns 503", async () => {
    mockGetAuthSessionState.mockRejectedValueOnce(
      new Error("Network error: auth service unreachable"),
    );

    const { sessionApi } = await import("./session.api");

    const response = await sessionApi.handle(
      new Request("http://localhost/session/token", {
        method: "POST",
        headers: { Authorization: "Bearer valid-token" },
      }),
    );

    expect(response.status).toBe(503);
  });
});
