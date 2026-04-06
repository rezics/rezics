import { beforeEach, describe, expect, mock, test } from "bun:test";

process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/rezics_auth";
process.env.BETTER_AUTH_URL ??= "http://localhost:35003";
process.env.BETTER_AUTH_SECRET ??=
  "better-auth-secret-for-tests-abcdefghijklmnopqrstuvwxyz";
process.env.AUTH_INTERNAL_TOKEN_GATEWAY_SECRET ??= "internal-auth-gateway-test";

const findFirst = mock();
const findMany = mock();
const upsert = mock();

mock.module("../auth/prisma", () => ({
  prisma: {
    jwtService: {
      upsert,
    },
    jwks: {
      findFirst,
      findMany,
    },
  },
}));

describe("auth context token signing", () => {
  beforeEach(() => {
    process.env.BETTER_AUTH_URL = "http://localhost:35003";
    process.env.AUTH_JWT_ISSUER = "http://localhost:35003";
    process.env.AUTH_JWT_AUDIENCE = "rezics";
    findFirst.mockReset();
    findMany.mockReset();
    upsert.mockReset();
  });

  test("builds verified onboarding claims from auth user data", async () => {
    const { generateKeyPairSync } = await import("node:crypto");
    const { privateKey } = generateKeyPairSync("ec", {
      namedCurve: "P-256",
    });

    upsert.mockResolvedValue({
      id: "jwt-service-auth",
      serviceKey: "auth-local",
      issuer: "http://localhost:35003",
      audience: "rezics",
      jwksUrl: "http://localhost:35003/api/auth/session/jwks",
      jwksPath: "/api/auth/session/jwks",
      isLocalIssuer: true,
      isActive: true,
    });
    findMany.mockResolvedValue([
      {
        id: "kid-context",
        alg: "ES256",
        publicKey: "public-key",
        privateKey: privateKey
          .export({ type: "pkcs8", format: "pem" })
          .toString(),
        createdAt: new Date("2026-03-17T00:00:00.000Z"),
        expiresAt: null,
        jwtService: {
          issuer: "http://localhost:35003",
        },
      },
    ]);

    const { buildAuthContextClaims, signAuthContextToken } = await import(
      "./context-token"
    );

    const claims = buildAuthContextClaims({
      id: "user-1",
      name: "Reader",
      emailVerified: false,
      image: "https://example.com/image.png",
      profile: {
        slug: "reader",
        avatar: null,
      },
    });

    expect(claims).toMatchObject({
      id: "user-1",
      slug: "reader",
      name: "Reader",
      avatar: "https://example.com/image.png",
      verificationStatus: "pending",
    });

    const signed = await signAuthContextToken({
      id: "user-1",
      name: "Reader",
      emailVerified: true,
      profile: {
        slug: "reader",
        avatar: "https://example.com/avatar.png",
      },
    });

    expect(signed.claims.verificationStatus).toBe("verified");
    expect(signed.claims.avatar).toBe("https://example.com/avatar.png");
    expect(typeof signed.token).toBe("string");
  });
});
