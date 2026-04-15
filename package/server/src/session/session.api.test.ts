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

const signRezicsSessionToken = mock(async () => "signed-session-token");
const verifyRezicsSessionToken = mock(async () => null);

mock.module("./jwt/jwt.service", () => ({
  getMainSessionPublicJwks,
  signRezicsSessionToken,
  verifyRezicsSessionToken,
}));

const mockVerifyBearerToken = mock(async () => ({
  payload: { unitId: "user-1", sub: "user-1", scope: "user" },
  token: "raw-token",
  protectedHeader: { alg: "ES256" },
}));

mock.module("@rezics/jwt", () => ({
  JwtAlgorithm: { ES256: "ES256" },
  verifyBearerToken: mockVerifyBearerToken,
}));

const mockGetJwtService = mock(async () => ({
  issuer: "http://localhost:3001",
  audience: "rezics",
  jwksUrl: "http://localhost:3001/.well-known/jwks.json",
}));

mock.module("@/jwt/jwtServiceCache", () => ({
  getJwtService: mockGetJwtService,
}));

const mockFindUnique = mock(async () => ({
  unitId: "user-1",
  permission: { role: ["MEMBER"] },
}));

mock.module("#/prisma/client", () => ({
  prisma: {
    user: {
      findUnique: mockFindUnique,
    },
  },
}));

const mockProvisionFromJwt = mock(async () => ({
  unitId: "new-user",
  permission: null,
}));

mock.module("@/user/service/user.service", () => ({
  userService: {
    provisionFromJwt: mockProvisionFromJwt,
  },
}));

describe("GET /session/jwks", () => {
  test("publishes the canonical public jwks document", async () => {
    const { sessionApi } = await import("./session.api");

    const response = await sessionApi.handle(
      new Request("http://localhost/session/jwks"),
    );

    expect(response.status).toBe(200);
    expect(getMainSessionPublicJwks).toHaveBeenCalled();
    const body = await response.json();
    expect(body.keys).toHaveLength(1);
    expect(body.keys[0].kid).toBe("server-kid");
  });
});

describe("POST /session/exchange", () => {
  test("valid exchange returns session token", async () => {
    mockVerifyBearerToken.mockResolvedValueOnce({
      payload: { unitId: "user-1", sub: "user-1", scope: "user" },
      token: "raw-token",
      protectedHeader: { alg: "ES256" },
    });
    mockFindUnique.mockResolvedValueOnce({
      unitId: "user-1",
      permission: { role: ["MEMBER"] },
    });
    signRezicsSessionToken.mockResolvedValueOnce("signed-session-token");

    const { sessionApi } = await import("./session.api");

    const response = await sessionApi.handle(
      new Request("http://localhost/session/exchange", {
        method: "POST",
        headers: { "x-auth-session-token": "valid-auth-token" },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty("token", "signed-session-token");
  });

  test("missing auth header returns 401", async () => {
    const { sessionApi } = await import("./session.api");

    const response = await sessionApi.handle(
      new Request("http://localhost/session/exchange", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(401);
  });

  test("expired auth token returns 401", async () => {
    mockVerifyBearerToken.mockRejectedValueOnce(
      new Error("Token expired"),
    );

    const { sessionApi } = await import("./session.api");

    const response = await sessionApi.handle(
      new Request("http://localhost/session/exchange", {
        method: "POST",
        headers: { "x-auth-session-token": "expired-token" },
      }),
    );

    expect(response.status).toBe(401);
  });

  test("unprovisioned verified user is auto-provisioned and gets token", async () => {
    mockVerifyBearerToken.mockResolvedValueOnce({
      payload: { unitId: "new-user", sub: "new-user", scope: "user", name: "New User" },
      token: "raw-token",
      protectedHeader: { alg: "ES256" },
    });
    mockFindUnique.mockResolvedValueOnce(null);
    mockProvisionFromJwt.mockResolvedValueOnce({
      unitId: "new-user",
      permission: null,
    });
    signRezicsSessionToken.mockResolvedValueOnce("new-user-session-token");

    const { sessionApi } = await import("./session.api");

    const response = await sessionApi.handle(
      new Request("http://localhost/session/exchange", {
        method: "POST",
        headers: { "x-auth-session-token": "valid-auth-token" },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty("token", "new-user-session-token");
    expect(mockProvisionFromJwt).toHaveBeenCalledWith({
      unitId: "new-user",
      slug: undefined,
      name: "New User",
    });
  });

  test("unverified unprovisioned user returns 403", async () => {
    mockVerifyBearerToken.mockResolvedValueOnce({
      payload: { unitId: "unverified-user", sub: "unverified-user", scope: "user", email_verified: false },
      token: "raw-token",
      protectedHeader: { alg: "ES256" },
    });
    mockFindUnique.mockResolvedValueOnce(null);

    const { sessionApi } = await import("./session.api");

    const response = await sessionApi.handle(
      new Request("http://localhost/session/exchange", {
        method: "POST",
        headers: { "x-auth-session-token": "valid-auth-token" },
      }),
    );

    expect(response.status).toBe(403);
  });

  test("blocked user still receives token (role embedded as hint)", async () => {
    mockVerifyBearerToken.mockResolvedValueOnce({
      payload: { unitId: "blocked-user", sub: "blocked-user", scope: "user" },
      token: "raw-token",
      protectedHeader: { alg: "ES256" },
    });
    mockFindUnique.mockResolvedValueOnce({
      unitId: "blocked-user",
      permission: { role: ["BLOCKED"] },
    });
    signRezicsSessionToken.mockResolvedValueOnce("blocked-session-token");

    const { sessionApi } = await import("./session.api");

    const response = await sessionApi.handle(
      new Request("http://localhost/session/exchange", {
        method: "POST",
        headers: { "x-auth-session-token": "valid-auth-token" },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty("token", "blocked-session-token");
  });
});
