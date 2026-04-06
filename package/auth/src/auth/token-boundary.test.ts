import { describe, expect, test } from "bun:test";

process.env.NODE_ENV ??= "test";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/rezics_auth";
process.env.BETTER_AUTH_URL ??= "http://localhost:35003";
process.env.BETTER_AUTH_SECRET ??=
  "this-is-a-long-auth-secret-for-tests-123456";
process.env.AUTH_INTERNAL_TOKEN_GATEWAY_SECRET ??= "internal-test-secret";
process.env.AUTH_TRUSTED_ORIGINS ??= "http://localhost:3000";

describe("token boundary policy", () => {
  test("allows browser callers from trusted origins", async () => {
    const { enforceInternalTokenSurface } = await import("./token-boundary");

    expect(() =>
      enforceInternalTokenSurface(
        new Request("http://localhost/api/auth/token", {
          headers: {
            origin: "http://localhost:3000",
          },
        }),
      ),
    ).not.toThrow();
  });

  test("rejects browser callers from untrusted origins", async () => {
    const { enforceInternalTokenSurface } = await import("./token-boundary");
    const { AuthPolicyError } = await import("./errors");

    let thrown: unknown;

    try {
      enforceInternalTokenSurface(
        new Request("http://localhost/api/auth/token", {
          headers: {
            origin: "http://malicious.example",
          },
        }),
      );
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(AuthPolicyError);

    if (!(thrown instanceof AuthPolicyError)) {
      throw thrown;
    }

    expect(thrown.status).toBe(403);
    expect(thrown.code).toBe("AUTH_TOKEN_SURFACE_BLOCKED");
  });
});
