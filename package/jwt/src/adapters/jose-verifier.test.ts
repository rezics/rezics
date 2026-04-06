import { describe, expect, test } from "bun:test";
import { NormalizedTokenName } from "@rezics/contract";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { defaultJwtCryptoProvider } from "../contracts/crypto-provider";
import type { JwtKeyPersistence } from "../contracts/persistence";
import { JwtAlgorithm } from "../core/jwt-algorithm";
import { createRotationEngine } from "../rotation/rotation-engine";
import { verifyBearerToken, verifyTokenFromHeader } from "./jose-verifier";

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

describe("jose verifier", () => {
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

    try {
      const token = await new SignJWT({ scope: "user" })
        .setProtectedHeader({ alg: "ES256", kid: "kid-new" })
        .setIssuer("https://issuer.example")
        .setAudience("rezics")
        .setIssuedAt()
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
    } finally {
      server.stop(true);
    }
  });

  test("verifies custom-header tokens with explicit transport settings", async () => {
    const key = await createEcJwkWithKid("kid-context");

    const token = await new SignJWT({
      id: "user-1",
      sub: "user-1",
      unitId: "user-1",
      slug: "reader",
      name: "Reader",
      avatar: "https://example.com/avatar.png",
      emailVerified: false,
      verificationStatus: "pending",
      scope: "user",
    })
      .setProtectedHeader({ alg: "ES256", kid: "kid-context" })
      .setIssuer("https://issuer.example")
      .setAudience("rezics")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(key.privateKey);

    const verified = await verifyTokenFromHeader(token, {
      issuer: "https://issuer.example",
      audience: "rezics",
      jwks: { keys: [key.publicJwk] },
      algorithm: JwtAlgorithm.ES256,
      tokenName: NormalizedTokenName.AUTH_CONTEXT,
      requiredScope: undefined,
    });

    expect(verified.payload.slug).toBe("reader");
  });

  test("serializes published keys into JWKS", async () => {
    const persistence: JwtKeyPersistence = {
      keys: [],
      async listKeys({ issuer }) {
        return this.keys.filter((key) => key.issuer === issuer);
      },
      async saveKey({ key }) {
        this.keys.push(key);
      },
      async markKeyRetiring({ issuer, kid, retiresAt, expiresAt }) {
        const record = this.keys.find(
          (key) => key.issuer === issuer && key.kid === kid,
        );
        if (!record) throw new Error(`Missing ${kid}`);
        record.retiresAt = retiresAt;
        record.expiresAt = expiresAt;
      },
      async getKeyByKid({ issuer, kid }) {
        return (
          this.keys.find((key) => key.issuer === issuer && key.kid === kid) ??
          null
        );
      },
    } as JwtKeyPersistence & {
      keys: Awaited<ReturnType<JwtKeyPersistence["listKeys"]>>;
    };

    const engine = createRotationEngine({
      issuer: {
        issuer: "https://issuer.example",
        audience: "rezics",
        algorithm: JwtAlgorithm.ES256,
        jwksPath: "/jwks",
      },
      config: {
        tokenTtlMs: 5 * 60 * 1000,
      },
      persistence,
      cryptoProvider: defaultJwtCryptoProvider,
      clock: {
        now: () => new Date("2026-01-10T00:00:00.000Z"),
      },
    });

    await engine.ensureActiveKey();
    const jwks = await engine.getPublicJwks();

    expect(jwks.keys).toHaveLength(1);
    expect(jwks.keys[0]?.kid).toContain("jwt-2026-01-10");
    expect(jwks.keys[0]?.alg).toBe("ES256");
  });
});
