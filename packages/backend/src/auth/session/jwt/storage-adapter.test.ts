import { beforeEach, describe, expect, mock, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { JwtAlgorithm } from "@/internal/jwt";
import { symmetricDecrypt, symmetricEncrypt } from "better-auth/crypto";
import type { AuthJwtStorage } from "./storage-adapter";

process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/rezics_auth";
process.env.BETTER_AUTH_URL = "http://localhost:35003";
process.env.AUTH_PUBLIC_BASE_URL = "http://localhost:35003";
process.env.AUTH_PUBLIC_ISSUER_URL = "http://localhost:35003";
process.env.AUTH_JWT_ISSUER = "http://localhost:35003";
process.env.AUTH_JWT_AUDIENCE = "rezics";
process.env.BETTER_AUTH_SECRET ??=
  "better-auth-secret-for-tests-abcdefghijklmnopqrstuvwxyz";
process.env.AUTH_INTERNAL_TOKEN_GATEWAY_SECRET ??= "internal-auth-gateway-test";
process.env.SMTP_HOST ??= "smtp.test";
process.env.SMTP_USER ??= "smtp-user";
process.env.SMTP_PASSWORD ??= "smtp-password";
process.env.TURNSTILE_SECRET ??= "turnstile-secret";

const serviceRecord = {
  id: "jwt-service-auth",
  serviceKey: "auth-local",
  issuer: "http://localhost:35003",
  audience: "rezics",
  jwksUrl: "http://localhost:35003/api/auth/session/jwks",
  jwksPath: "/api/auth/session/jwks",
  isLocalIssuer: true,
  isActive: true,
};

const ensureLocalService = mock(async () => serviceRecord);
const listKeys = mock(async (_serviceId: string): Promise<any[]> => []);
const saveKey = mock(async (_serviceId: string, _key: unknown) => {});
const markKeyRetiring = mock(async (_kid: string, _expiresAt: Date) => {});
const getKeyByKid = mock(
  async (
    _kid: string,
  ): Promise<Awaited<ReturnType<AuthJwtStorage["getKeyByKid"]>>> => null,
);

describe("auth jwt storage adapter", () => {
  beforeEach(async () => {
    process.env.BETTER_AUTH_URL = "http://localhost:35003";
    process.env.AUTH_PUBLIC_BASE_URL = "http://localhost:35003";
    process.env.AUTH_PUBLIC_ISSUER_URL = "http://localhost:35003";
    process.env.AUTH_JWT_ISSUER = "http://localhost:35003";
    process.env.AUTH_JWT_AUDIENCE = "rezics";
    ensureLocalService.mockClear();
    listKeys.mockClear();
    saveKey.mockClear();
    markKeyRetiring.mockClear();
    getKeyByKid.mockClear();

    const { setAuthJwtStorageForTests } = await import("./storage-adapter");
    setAuthJwtStorageForTests({
      ensureLocalService,
      listKeys,
      saveKey,
      markKeyRetiring,
      getKeyByKid,
    });
  });

  test("upserts the local auth jwt service metadata from runtime config", async () => {
    const { ensureLocalAuthJwtServiceRecord } = await import(
      "./storage-adapter"
    );
    const record = await ensureLocalAuthJwtServiceRecord();

    expect(record.serviceKey).toBe("auth-local");
    expect(record.issuer).toBe("http://localhost:35003");
    expect(record.audience).toBe("rezics");
    expect(ensureLocalService).toHaveBeenCalledTimes(1);
  });

  test("links saved jwks rows to the local auth jwt service record", async () => {
    const { getAuthJwtIssuer } = await import("./options");
    const { authJwtPersistence } = await import("./storage-adapter");
    await authJwtPersistence.saveKey({
      issuer: getAuthJwtIssuer(),
      key: {
        issuer: getAuthJwtIssuer(),
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

    expect(saveKey).toHaveBeenCalledTimes(1);
    expect(saveKey.mock.calls[0]?.[0]).toBe("jwt-service-auth");
    expect(saveKey.mock.calls[0]?.[1]).toMatchObject({
      kid: "kid-auth",
      publicJwk: expect.objectContaining({ x: "public-x" }),
      privateJwk: expect.objectContaining({ d: "private-d" }),
    });
  });

  test("accepts better-auth serialized jwk payloads without private key encryption", async () => {
    const { createBetterAuthJwtAdapter } = await import("./storage-adapter");
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
    expect(saveKey).toHaveBeenCalledTimes(1);
    expect(saveKey.mock.calls[0]?.[1]).toMatchObject({
      publicJwk: expect.objectContaining({ x: "public-x" }),
      privateJwk: expect.objectContaining({ d: "private-d" }),
    });
  });

  test("accepts better-auth serialized jwk payloads with encrypted private keys", async () => {
    const { createBetterAuthJwtAdapter } = await import("./storage-adapter");
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
    expect(saveKey).toHaveBeenCalledTimes(1);
  });

  test("returns better-auth jwk rows from getJwks", async () => {
    listKeys.mockResolvedValueOnce([
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

    const { createBetterAuthJwtAdapter } = await import("./storage-adapter");
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

    expect(listKeys).toHaveBeenCalledWith("jwt-service-auth");
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

  test("marks persisted jwks rows as retiring", async () => {
    const { getAuthJwtIssuer } = await import("./options");
    const { authJwtPersistence } = await import("./storage-adapter");
    const expiresAt = new Date("2026-03-21T00:00:00.000Z");

    await authJwtPersistence.markKeyRetiring({
      issuer: getAuthJwtIssuer(),
      kid: "kid-auth",
      retiresAt: expiresAt,
      expiresAt,
    });

    expect(markKeyRetiring).toHaveBeenCalledWith("kid-auth", expiresAt);
  });

  test("gets persisted jwks rows by kid", async () => {
    getKeyByKid.mockResolvedValueOnce({
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
    });
    const { getAuthJwtIssuer } = await import("./options");
    const { authJwtPersistence } = await import("./storage-adapter");

    const key = await authJwtPersistence.getKeyByKid({
      issuer: getAuthJwtIssuer(),
      kid: "kid-auth",
    });

    expect(getKeyByKid).toHaveBeenCalledWith("kid-auth");
    expect(key).toMatchObject({
      issuer: "http://localhost:35003",
      kid: "kid-auth",
      algorithm: JwtAlgorithm.ES256,
      publicJwk: expect.objectContaining({ x: "public-x" }),
      privateJwk: expect.objectContaining({ d: "private-d" }),
    });
  });

  test("keeps migration bootstrap for jwks rows", () => {
    const migrationPath = join(
      import.meta.dir,
      "../../../..",
      "drizzle/auth/20260604052947_late_bug/migration.sql",
    );
    const migrationSql = readFileSync(migrationPath, "utf8");

    expect(migrationSql).toContain('"publicJwk" jsonb NOT NULL');
    expect(migrationSql).toContain('"privateJwk" jsonb NOT NULL');
    expect(migrationSql).not.toContain('"publicKey"');
  });
});
