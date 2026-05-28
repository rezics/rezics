import { beforeEach, describe, expect, mock, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { JwtAlgorithm } from "@rezics/jwt";
import { symmetricDecrypt, symmetricEncrypt } from "better-auth/crypto";

process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/rezics_auth";
process.env.BETTER_AUTH_URL = "http://localhost:35003";
process.env.AUTH_PUBLIC_BASE_URL = "http://localhost:35003";
process.env.AUTH_PUBLIC_ISSUER_URL = "http://localhost:35003";
process.env.AUTH_JWT_ISSUER = "http://localhost:35003";
process.env.AUTH_JWT_AUDIENCE = "rezics";
process.env.BETTER_AUTH_SECRET =
  process.env.BETTER_AUTH_SECRET ??
  "better-auth-secret-for-tests-abcdefghijklmnopqrstuvwxyz";
process.env.AUTH_INTERNAL_TOKEN_GATEWAY_SECRET =
  process.env.AUTH_INTERNAL_TOKEN_GATEWAY_SECRET ??
  "internal-auth-gateway-test";
process.env.SMTP_HOST ??= "smtp.test";
process.env.SMTP_USER ??= "smtp-user";
process.env.SMTP_PASSWORD ??= "smtp-password";
process.env.TURNSTILE_SECRET ??= "turnstile-secret";

const jwtServiceUpsert = mock();
const jwksFindMany = mock();
const jwksUpsert = mock();

mock.module("../../auth/prisma", () => ({
  prisma: {
    jwtService: {
      upsert: jwtServiceUpsert,
    },
    jwks: {
      findMany: jwksFindMany,
      upsert: jwksUpsert,
    },
  },
}));

describe("auth jwt prisma adapter", () => {
  beforeEach(() => {
    process.env.BETTER_AUTH_URL = "http://localhost:35003";
    process.env.AUTH_PUBLIC_BASE_URL = "http://localhost:35003";
    process.env.AUTH_PUBLIC_ISSUER_URL = "http://localhost:35003";
    process.env.AUTH_JWT_ISSUER = "http://localhost:35003";
    process.env.AUTH_JWT_AUDIENCE = "rezics";
    jwtServiceUpsert.mockReset();
    jwksFindMany.mockReset();
    jwksUpsert.mockReset();
  });

  test("upserts the local auth jwt service metadata from runtime config", async () => {
    jwtServiceUpsert.mockResolvedValue({
      id: "jwt-service-auth",
      serviceKey: "auth-local",
      issuer: "http://localhost:35003",
      audience: "rezics",
      jwksUrl: "http://localhost:35003/api/auth/session/jwks",
      jwksPath: "/api/auth/session/jwks",
      isLocalIssuer: true,
      isActive: true,
    });

    const { ensureLocalAuthJwtServiceRecord } = await import(
      "./prisma-adapter"
    );
    const record = await ensureLocalAuthJwtServiceRecord();

    expect(record.serviceKey).toBe("auth-local");
    expect(jwtServiceUpsert).toHaveBeenCalledTimes(1);
    expect(jwtServiceUpsert.mock.calls[0]?.[0]).toMatchObject({
      where: {
        serviceKey: "auth-local",
      },
      update: {},
      create: {
        serviceKey: "auth-local",
        issuer: "http://localhost:35003",
        audience: "rezics",
        jwksUrl: "http://localhost:35003/auth/session/jwks",
        jwksPath: "/api/auth/session/jwks",
        isLocalIssuer: true,
        isActive: true,
      },
    });
  });

  test("links saved jwks rows to the local auth jwt service record", async () => {
    jwtServiceUpsert.mockResolvedValue({
      id: "jwt-service-auth",
      serviceKey: "auth-local",
      issuer: "http://localhost:35003",
      audience: "rezics",
      jwksUrl: "http://localhost:35003/api/auth/session/jwks",
      jwksPath: "/api/auth/session/jwks",
      isLocalIssuer: true,
      isActive: true,
    });
    jwksUpsert.mockResolvedValue({});

    const { authJwtPersistence } = await import("./prisma-adapter");
    await authJwtPersistence.saveKey({
      issuer: "http://localhost:35003",
      key: {
        issuer: "http://localhost:35003",
        kid: "kid-auth",
        algorithm: JwtAlgorithm.ES256,
        publicJwk: {
          kid: "kid-auth",
          kty: "EC",
          crv: "P-256",
          x: "public-x",
          y: "public-y",
          alg: JwtAlgorithm.ES256,
          use: "sig",
        },
        privateJwk: {
          kid: "kid-auth",
          kty: "EC",
          crv: "P-256",
          x: "public-x",
          y: "public-y",
          d: "private-d",
          alg: JwtAlgorithm.ES256,
          use: "sig",
        },
        createdAt: new Date("2026-03-17T00:00:00.000Z"),
        activatesAt: new Date("2026-03-17T00:00:00.000Z"),
        retiresAt: null,
        expiresAt: null,
      },
    });

    expect(jwksUpsert).toHaveBeenCalledTimes(1);
    expect(jwksUpsert.mock.calls[0]?.[0]).toMatchObject({
      update: {
        jwtServiceId: "jwt-service-auth",
      },
      create: {
        jwtServiceId: "jwt-service-auth",
      },
    });
  });

  test("accepts better-auth serialized jwk payloads without private key encryption", async () => {
    jwtServiceUpsert.mockResolvedValue({
      id: "jwt-service-auth",
      serviceKey: "auth-local",
      issuer: "http://localhost:35003",
      audience: "rezics",
      jwksUrl: "http://localhost:35003/api/auth/session/jwks",
      jwksPath: "/api/auth/session/jwks",
      isLocalIssuer: true,
      isActive: true,
    });
    jwksUpsert.mockResolvedValue({});

    const { createBetterAuthJwtAdapter } = await import("./prisma-adapter");
    const adapter = createBetterAuthJwtAdapter({
      disablePrivateKeyEncryption: true,
    });
    const createdAt = new Date("2026-03-20T04:31:47.000Z");

    const result = await adapter.createJwk(
      {
        alg: JwtAlgorithm.ES256,
        crv: "P-256",
        publicKey: JSON.stringify({
          kty: "EC",
          crv: "P-256",
          x: "public-x",
          y: "public-y",
        }),
        privateKey: JSON.stringify({
          kty: "EC",
          crv: "P-256",
          x: "public-x",
          y: "public-y",
          d: "private-d",
        }),
        createdAt,
      },
      {},
    );
    const publicJwk = JSON.parse(String(result.publicKey));
    const privateJwk = JSON.parse(String(result.privateKey));

    expect(result).toMatchObject({
      id: expect.any(String),
      createdAt,
      crv: "P-256",
      publicKey: expect.any(String),
      privateKey: expect.any(String),
      alg: JwtAlgorithm.ES256,
    });
    expect(publicJwk).toMatchObject({
      kty: "EC",
      crv: "P-256",
      x: "public-x",
      y: "public-y",
    });
    expect(privateJwk).toMatchObject({
      kty: "EC",
      crv: "P-256",
      x: "public-x",
      y: "public-y",
      d: "private-d",
    });
    expect(jwksUpsert).toHaveBeenCalledTimes(1);
    expect(jwksUpsert.mock.calls[0]?.[0]).toMatchObject({
      create: {
        jwtServiceId: "jwt-service-auth",
        publicJwk: expect.objectContaining({
          kty: "EC",
          crv: "P-256",
          x: "public-x",
          y: "public-y",
        }),
        privateJwk: expect.objectContaining({
          kty: "EC",
          crv: "P-256",
          x: "public-x",
          y: "public-y",
          d: "private-d",
        }),
      },
    });
  });

  test("accepts better-auth serialized jwk payloads with encrypted private keys", async () => {
    jwtServiceUpsert.mockResolvedValue({
      id: "jwt-service-auth",
      serviceKey: "auth-local",
      issuer: "http://localhost:35003",
      audience: "rezics",
      jwksUrl: "http://localhost:35003/api/auth/session/jwks",
      jwksPath: "/api/auth/session/jwks",
      isLocalIssuer: true,
      isActive: true,
    });
    jwksUpsert.mockResolvedValue({});

    const { createBetterAuthJwtAdapter } = await import("./prisma-adapter");
    const adapter = createBetterAuthJwtAdapter();
    const createdAt = new Date("2026-03-20T04:31:47.000Z");
    const secret = process.env.BETTER_AUTH_SECRET!;

    const encryptedPrivateKey = JSON.stringify(
      await symmetricEncrypt({
        key: secret,
        data: JSON.stringify({
          kty: "EC",
          crv: "P-256",
          x: "public-x",
          y: "public-y",
          d: "private-d",
        }),
      }),
    );

    const result = await adapter.createJwk(
      {
        alg: JwtAlgorithm.ES256,
        crv: "P-256",
        publicKey: JSON.stringify({
          kty: "EC",
          crv: "P-256",
          x: "public-x",
          y: "public-y",
        }),
        privateKey: encryptedPrivateKey,
        createdAt,
      },
      {
        context: {
          secretConfig: secret,
        },
      },
    );
    const publicJwk = JSON.parse(String(result.publicKey));
    const privateJwk = JSON.parse(
      await symmetricDecrypt({
        key: secret,
        data: JSON.parse(String(result.privateKey)),
      }),
    );

    expect(result).toMatchObject({
      id: expect.any(String),
      createdAt,
      crv: "P-256",
      publicKey: expect.any(String),
      privateKey: expect.any(String),
      alg: JwtAlgorithm.ES256,
    });
    expect(publicJwk).toMatchObject({
      kty: "EC",
      crv: "P-256",
      x: "public-x",
      y: "public-y",
    });
    expect(privateJwk).toMatchObject({
      kty: "EC",
      crv: "P-256",
      x: "public-x",
      y: "public-y",
      d: "private-d",
    });
    expect(jwksUpsert).toHaveBeenCalledTimes(1);
  });

  test("returns better-auth jwk rows from getJwks", async () => {
    jwtServiceUpsert.mockResolvedValue({
      id: "jwt-service-auth",
      serviceKey: "auth-local",
      issuer: "http://localhost:35003",
      audience: "rezics",
      jwksUrl: "http://localhost:35003/api/auth/session/jwks",
      jwksPath: "/api/auth/session/jwks",
      isLocalIssuer: true,
      isActive: true,
    });
    jwksFindMany.mockResolvedValue([
      {
        id: "kid-auth",
        alg: JwtAlgorithm.ES256,
        createdAt: new Date("2026-03-20T04:31:47.000Z"),
        expiresAt: null,
        publicJwk: {
          kid: "kid-auth",
          kty: "EC",
          crv: "P-256",
          x: "public-x",
          y: "public-y",
          alg: JwtAlgorithm.ES256,
          use: "sig",
        },
        privateJwk: {
          kid: "kid-auth",
          kty: "EC",
          crv: "P-256",
          x: "public-x",
          y: "public-y",
          d: "private-d",
          alg: JwtAlgorithm.ES256,
          use: "sig",
        },
        jwtService: {
          issuer: "http://localhost:35003",
        },
      },
    ]);

    const { createBetterAuthJwtAdapter } = await import("./prisma-adapter");
    const adapter = createBetterAuthJwtAdapter();
    const secret = process.env.BETTER_AUTH_SECRET!;
    const result = (
      await adapter.getJwks({
        context: {
          secretConfig: secret,
        },
      })
    )[0]!;
    const publicJwk = JSON.parse(String(result.publicKey));
    const privateJwk = JSON.parse(
      await symmetricDecrypt({
        key: secret,
        data: JSON.parse(String(result.privateKey)),
      }),
    );

    expect(result).toMatchObject({
      id: "kid-auth",
      alg: JwtAlgorithm.ES256,
      crv: "P-256",
      publicKey: expect.any(String),
      privateKey: expect.any(String),
    });
    expect(publicJwk).toMatchObject({
      kid: "kid-auth",
      kty: "EC",
      crv: "P-256",
      x: "public-x",
      y: "public-y",
    });
    expect(privateJwk).toMatchObject({
      kid: "kid-auth",
      kty: "EC",
      crv: "P-256",
      x: "public-x",
      y: "public-y",
      d: "private-d",
    });
  });

  test("keeps migration bootstrap for jwks rows", () => {
    const migrationPath = join(
      import.meta.dir,
      "../../../prisma/migrations/20260321103802_init/migration.sql",
    );
    const migrationSql = readFileSync(migrationPath, "utf8");

    expect(migrationSql).toContain('"publicJwk" JSONB NOT NULL');
    expect(migrationSql).toContain('"privateJwk" JSONB NOT NULL');
    expect(migrationSql).not.toContain('"publicKey"');
  });
});
