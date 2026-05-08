import { describe, expect, test } from "bun:test";
import { NormalizedTokenName } from "@rezics/contract";
import {
  JwtAlgorithm,
  verifyBearerToken,
  verifyTokenFromHeader,
} from "@rezics/jwt";
import { exportJWK, generateKeyPair, SignJWT } from "jose";

process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/rezics_auth";
process.env.BETTER_AUTH_URL = "http://localhost:35003";
process.env.BETTER_AUTH_SECRET =
  process.env.BETTER_AUTH_SECRET ??
  "better-auth-secret-for-tests-abcdefghijklmnopqrstuvwxyz";
process.env.AUTH_INTERNAL_TOKEN_GATEWAY_SECRET =
  process.env.AUTH_INTERNAL_TOKEN_GATEWAY_SECRET ??
  "internal-auth-gateway-test";
process.env.AUTH_JWT_ISSUER = "http://localhost:35003";
process.env.AUTH_JWT_AUDIENCE = "rezics";

async function createEcJwkWithKid(kid: string) {
  const { publicKey, privateKey } = await generateKeyPair("ES256");
  const publicJwk = await exportJWK(publicKey);
  return {
    publicJwk: {
      ...publicJwk,
      use: "sig",
      alg: "ES256",
      kid,
    },
    privateKey,
  };
}

describe("verifyBearerToken", () => {
  test("rejects malformed JWT formatting before JOSE parsing", async () => {
    await expect(
      verifyBearerToken("Bearer not-a-jwt", {
        issuer: "https://issuer.example",
        audience: "rezics",
        jwksUrl: "http://localhost:1/jwks",
        algorithm: JwtAlgorithm.ES256,
      }),
    ).rejects.toThrow("Invalid JWT format");
  });

  test("rejects non-ES256 tokens", async () => {
    const token = await new SignJWT({ scope: "user" })
      .setProtectedHeader({ alg: "HS256", kid: "hs" })
      .setIssuer("https://issuer.example")
      .setAudience("rezics")
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode("not-es256-secret"));

    await expect(
      verifyBearerToken(`Bearer ${token}`, {
        issuer: "https://issuer.example",
        audience: "rezics",
        jwksUrl: "http://localhost:1/jwks",
        algorithm: JwtAlgorithm.ES256,
      }),
    ).rejects.toThrow("Invalid token algorithm");
  });

  test("refreshes JWKS on unknown kid and verifies token", async () => {
    const key1 = await createEcJwkWithKid("kid-old");
    const key2 = await createEcJwkWithKid("kid-new");

    let jwksRequestCount = 0;
    const server = Bun.serve({
      port: 0,
      fetch() {
        jwksRequestCount += 1;
        return Response.json({
          keys:
            jwksRequestCount === 1
              ? [key1.publicJwk]
              : [key1.publicJwk, key2.publicJwk],
        });
      },
    });

    const token = await new SignJWT({ scope: "user" })
      .setProtectedHeader({ alg: "ES256", kid: "kid-new" })
      .setIssuer("https://issuer.example")
      .setAudience("rezics")
      .setIssuedAt()
      .setNotBefore(0)
      .setExpirationTime("1h")
      .sign(key2.privateKey);

    const verified = await verifyBearerToken(`Bearer ${token}`, {
      issuer: "https://issuer.example",
      audience: "rezics",
      jwksUrl: `http://localhost:${server.port}/jwks`,
      algorithm: JwtAlgorithm.ES256,
    });

    expect(verified.protectedHeader.kid).toBe("kid-new");
    expect(jwksRequestCount).toBeGreaterThan(1);

    server.stop(true);
  });
});

