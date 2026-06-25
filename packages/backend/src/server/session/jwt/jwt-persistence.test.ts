import { beforeEach, describe, expect, mock, test } from "bun:test";
import { JwtAlgorithm } from "@/internal/jwt";
import {
  createServerJwtPersistence,
  type JwksRepository,
  type JwksRow,
} from "./jwt-persistence";

process.env.NODE_ENV = "test";

const localService = {
  id: "server-local-id",
  serviceKey: "server-local",
  issuer: "http://localhost:3000",
  audience: "rezics",
  jwksUrl: "http://localhost:3000/.well-known/jwks.json",
  jwksPath: "/.well-known/jwks.json",
  isLocalIssuer: true,
  isActive: true,
  jwks: [],
};

const jwksRow: JwksRow = {
  id: "server-kid",
  jwtServiceId: "server-local-id",
  publicJwk: {
    kid: "server-kid",
    kty: "EC",
    crv: "P-256",
    x: "public-x",
    y: "public-y",
    alg: JwtAlgorithm.ES256,
    use: "sig",
  },
  privateJwk: {
    kid: "server-kid",
    kty: "EC",
    crv: "P-256",
    x: "public-x",
    y: "public-y",
    d: "private-d",
    alg: JwtAlgorithm.ES256,
    use: "sig",
  },
  alg: "ES256",
  createdAt: new Date("2026-03-17T00:00:00.000Z"),
  expiresAt: null,
};

function freshPersistence() {
  const calls: Array<{ method: string; input: unknown }> = [];
  const repository: JwksRepository = {
    async list(jwtServiceId) {
      calls.push({ method: "list", input: jwtServiceId });
      return [jwksRow];
    },
    async upsert(input) {
      calls.push({ method: "upsert", input });
    },
    async updateExpiresAt(kid, expiresAt) {
      calls.push({ method: "updateExpiresAt", input: { kid, expiresAt } });
    },
    async getByKid(kid) {
      calls.push({ method: "getByKid", input: kid });
      return jwksRow;
    },
  };
  return {
    calls,
    persistence: createServerJwtPersistence({
      repository,
      getJwtService: async () => localService,
    }),
  };
}

describe("server jwt persistence", () => {
  beforeEach(() => {
    process.env.PORT = "3000";
  });

  test("lists local server signing keys via the local jwt service record", async () => {
    const { calls, persistence } = freshPersistence();
    const keys = await persistence.listKeys({
      issuer: "http://localhost:3000",
    });

    expect(keys).toHaveLength(1);
    expect(calls).toContainEqual({
      method: "list",
      input: "server-local-id",
    });
  });

  test("links saved keys to the local server jwt service record", async () => {
    const { calls, persistence } = freshPersistence();
    await persistence.saveKey({
      issuer: "http://localhost:3000",
      key: {
        issuer: "http://localhost:3000",
        kid: "server-kid",
        algorithm: JwtAlgorithm.ES256,
        publicJwk: {
          kid: "server-kid",
          kty: "EC",
          crv: "P-256",
          x: "public-x",
          y: "public-y",
          alg: JwtAlgorithm.ES256,
          use: "sig",
        },
        privateJwk: {
          kid: "server-kid",
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

    expect(calls).toContainEqual(
      expect.objectContaining({
        method: "upsert",
        input: expect.objectContaining({
          id: "server-kid",
          jwtServiceId: "server-local-id",
        }),
      }),
    );
  });

  test("marks local keys retiring through the server jwks table", async () => {
    const expiresAt = new Date("2026-03-18T00:00:00.000Z");

    const { calls, persistence } = freshPersistence();
    await persistence.markKeyRetiring({
      issuer: "http://localhost:3000",
      kid: "server-kid",
      retiresAt: new Date("2026-03-17T23:00:00.000Z"),
      expiresAt,
    });

    expect(calls).toContainEqual({
      method: "updateExpiresAt",
      input: { kid: "server-kid", expiresAt },
    });
  });
});
