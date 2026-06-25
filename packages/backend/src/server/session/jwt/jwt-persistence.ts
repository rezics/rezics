import type { JwtKeyPersistence, JwtKeyRecord } from "@/internal/jwt";
import {
  asJwtPrivateJwk,
  asJwtPublicJwk,
  JwtAlgorithm,
  type JwtPrivateJwk,
  type JwtPublicJwk,
} from "@/internal/jwt";
import { desc, eq } from "drizzle-orm";
import { Jwks } from "../../db/schema";
import { getJwtService as getCachedJwtService } from "../../jwt/jwtServiceCache";
import type { CachedJwtService } from "../../jwt/jwtServiceRepository";

export type JwksRow = typeof Jwks.$inferSelect;

export type JwksRepository = {
  list(jwtServiceId: string): Promise<JwksRow[]>;
  upsert(input: JwksRow): Promise<void>;
  updateExpiresAt(kid: string, expiresAt: Date | null): Promise<void>;
  getByKid(kid: string): Promise<JwksRow | undefined>;
};

export type JwtPersistenceDependencies = {
  getJwtService?: typeof getCachedJwtService;
  repository?: JwksRepository;
};

async function getServerDb() {
  const { db } = await import("../../db/client");
  return db;
}

function createDrizzleJwksRepository(): JwksRepository {
  return {
    async list(jwtServiceId) {
      const db = await getServerDb();
      return db
        .select()
        .from(Jwks)
        .where(eq(Jwks.jwtServiceId, jwtServiceId))
        .orderBy(desc(Jwks.createdAt));
    },

    async upsert(input) {
      const db = await getServerDb();
      await db
        .insert(Jwks)
        .values(input)
        .onConflictDoUpdate({
          target: Jwks.id,
          set: {
            jwtServiceId: input.jwtServiceId,
            publicJwk: input.publicJwk,
            privateJwk: input.privateJwk,
            alg: input.alg,
            createdAt: input.createdAt,
            expiresAt: input.expiresAt,
          },
        });
    },

    async updateExpiresAt(kid, expiresAt) {
      const db = await getServerDb();
      await db.update(Jwks).set({ expiresAt }).where(eq(Jwks.id, kid));
    },

    async getByKid(kid) {
      const db = await getServerDb();
      const [row] = await db.select().from(Jwks).where(eq(Jwks.id, kid));
      return row;
    },
  };
}

function mapRowToRecord(
  row: {
    id: string;
    publicJwk: unknown;
    privateJwk: unknown;
    alg: string | null;
    createdAt: Date;
    expiresAt: Date | null;
  },
  issuer: string,
): JwtKeyRecord {
  return {
    issuer,
    kid: row.id,
    algorithm: (row.alg as JwtAlgorithm | null) ?? JwtAlgorithm.ES256,
    publicJwk: asJwtPublicJwk(row.publicJwk as JwtPublicJwk),
    privateJwk: asJwtPrivateJwk(row.privateJwk as JwtPrivateJwk),
    createdAt: row.createdAt,
    activatesAt: row.createdAt,
    retiresAt: row.expiresAt,
    expiresAt: row.expiresAt,
  };
}

export function createServerJwtPersistence(
  dependencies: JwtPersistenceDependencies = {},
): JwtKeyPersistence {
  const getJwtService = dependencies.getJwtService ?? getCachedJwtService;
  const repository = dependencies.repository ?? createDrizzleJwksRepository();

  return {
    async listKeys({ issuer }) {
      const service = await getJwtService("server-local");
      if (issuer !== service.issuer) {
        return [];
      }

      const rows = await repository.list(service.id);

      return rows.map((row) => mapRowToRecord(row, service.issuer));
    },
    async saveKey({ issuer, key }) {
      const service = await getJwtService("server-local");
      if (issuer !== service.issuer) {
        throw new Error(`Unsupported issuer ${issuer}`);
      }

      await repository.upsert({
        id: key.kid,
        jwtServiceId: service.id,
        publicJwk: key.publicJwk,
        privateJwk: key.privateJwk,
        alg: key.algorithm,
        createdAt: key.createdAt,
        expiresAt: key.expiresAt,
      });
    },
    async markKeyRetiring({ issuer, kid, expiresAt }) {
      const service = await getJwtService("server-local");
      if (issuer !== service.issuer) {
        throw new Error(`Unsupported issuer ${issuer}`);
      }

      await repository.updateExpiresAt(kid, expiresAt);
    },
    async getKeyByKid({ issuer, kid }) {
      const service = await getJwtService("server-local");
      if (issuer !== service.issuer) {
        return null;
      }

      const row = await repository.getByKid(kid);

      return row ? mapRowToRecord(row, service.issuer) : null;
    },
  };
}

export const serverJwtPersistence: JwtKeyPersistence =
  createServerJwtPersistence();
