import { describe, expect, mock, test } from "bun:test";
import { Elysia } from "elysia";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/rezics_reaction";
process.env.SERVER_JWKS_URL = "http://localhost:3000/.well-known/jwks.json";
process.env.SERVER_ISSUER = "rezics-server";

const verifier = mock(async () => ({
  payload: {
    sub: "user-1",
    userId: "user-1",
    role: "MEMBER",
    permission: { role: "MEMBER" },
  },
}));

mock.module("@rezics/jwt", () => ({
  JwtAlgorithm: { ES256: "ES256" },
  createJwtVerifier: () => verifier,
}));

describe("reaction auth macro", () => {
  test("resolves userId from rezics-session-token claims", async () => {
    const { authMacro } = await import("./auth");
    const app = new Elysia()
      .use(authMacro)
      .get("/me", ({ userId }) => ({ userId }), {
        requireUser: true,
      });

    const response = await app.handle(
      new Request("http://localhost/me", {
        headers: {
          authorization: "Bearer signed-main-token",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ userId: "user-1" });
  });
});
