import { describe, expect, test } from "bun:test";
import { JwtAlgorithm, verifyBearerToken } from "@rezics/jwt";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import type { JWTPayload } from "../model/types";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/rezics_book";
process.env.AUTH_BASE_URL ??= "http://localhost:3001";
process.env.AUTH_JWT_AUDIENCE = "rezics";
process.env.AUTH_JWT_CLOCK_TOLERANCE_SECONDS = "5";
process.env.BETTER_AUTH_URL ??= "http://localhost:3001";
process.env.BETTER_AUTH_SECRET ??=
  "better-auth-secret-for-tests-abcdefghijklmnopqrstuvwxyz";
process.env.AUTH_INTERNAL_TOKEN_GATEWAY_SECRET ??= "internal-auth-gateway-test";

describe("auth bearer e2e flow", () => {
  test("token issuance -> bearer verification with offline jwks", async () => {
    const { publicKey, privateKey } = await generateKeyPair("ES256");
    const publicJwk = await exportJWK(publicKey);

    const jwksServer = Bun.serve({
      port: 0,
      fetch() {
        return Response.json({
          keys: [
            {
              ...publicJwk,
              kid: "rezics-active",
              alg: "ES256",
              use: "sig",
            },
          ],
        });
      },
    });

    const jwksUrl = `http://localhost:${jwksServer.port}/api/auth/session/jwks`;

    const token = await new SignJWT({
      unitId: "4f1af8b5-6c9f-4c32-8c17-9108fb6af001",
      scope: "user",
    })
      .setProtectedHeader({ alg: "ES256", kid: "rezics-active" })
      .setIssuer("http://localhost:3001")
      .setAudience("rezics")
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(privateKey);

    const result = await verifyBearerToken<JWTPayload>(`Bearer ${token}`, {
      issuer: "http://localhost:3001",
      audience: "rezics",
      jwksUrl,
      algorithm: JwtAlgorithm.ES256,
      requiredScope: "user",
      enforceTransport: true,
    });

    expect(result.payload.unitId).toBe("4f1af8b5-6c9f-4c32-8c17-9108fb6af001");
    expect(String(result.payload.scope)).toContain("user");

    jwksServer.stop(true);
  });
});
