import type {
  CreateJwtServiceInput,
  JwtServiceDTO,
  UpdateJwtServiceInput,
} from "@rezics/contract";
import { defaultJwtCryptoProvider } from "@rezics/jwt";
import { and, asc, eq, gt, isNull, or } from "drizzle-orm";
import { env } from "@/env";
import { invalidateJwtService } from "@/jwt";
import { Jwks, JwtService } from "../db/schema";

type JwtServiceRow = typeof JwtService.$inferSelect;

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

function mapToDTO(record: JwtServiceRow): JwtServiceDTO {
  return {
    id: record.id,
    serviceKey: record.serviceKey,
    issuer: record.issuer,
    audience: record.audience,
    jwksUrl: record.jwksUrl,
    jwksPath: record.jwksPath,
    isLocalIssuer: record.isLocalIssuer,
    isActive: record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export const jwtServiceAdminService = {
  async list(): Promise<JwtServiceDTO[]> {
    const db = await getServerDb();
    const records = await db
      .select()
      .from(JwtService)
      .orderBy(asc(JwtService.createdAt));
    return records.map(mapToDTO);
  },

  async fetch(serviceKey: string): Promise<JwtServiceDTO | null> {
    const db = await getServerDb();
    const [record] = await db
      .select()
      .from(JwtService)
      .where(eq(JwtService.serviceKey, serviceKey))
      .limit(1);
    return record ? mapToDTO(record) : null;
  },

  async create(input: CreateJwtServiceInput): Promise<JwtServiceDTO> {
    const db = await getServerDb();
    const [record] = await db
      .insert(JwtService)
      .values({
        serviceKey: input.serviceKey,
        issuer: input.issuer,
        audience: input.audience,
        jwksUrl: input.jwksUrl,
        jwksPath: input.jwksPath,
        isLocalIssuer: input.isLocalIssuer ?? false,
        isActive: true,
        updatedAt: new Date(),
      })
      .returning();
    if (!record) {
      throw new Error(`JwtService could not be created: ${input.serviceKey}`);
    }
    invalidateJwtService(input.serviceKey);
    return mapToDTO(record);
  },

  async update(
    serviceKey: string,
    input: UpdateJwtServiceInput,
  ): Promise<JwtServiceDTO> {
    const db = await getServerDb();
    const [record] = await db
      .update(JwtService)
      .set({
        ...(input.issuer !== undefined ? { issuer: input.issuer } : {}),
        ...(input.audience !== undefined ? { audience: input.audience } : {}),
        ...(input.jwksUrl !== undefined ? { jwksUrl: input.jwksUrl } : {}),
        ...(input.jwksPath !== undefined ? { jwksPath: input.jwksPath } : {}),
        ...(input.isLocalIssuer !== undefined
          ? { isLocalIssuer: input.isLocalIssuer }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(JwtService.serviceKey, serviceKey))
      .returning();
    if (!record) {
      throw new Error(`JwtService not found: ${serviceKey}`);
    }
    invalidateJwtService(serviceKey);
    return mapToDTO(record);
  },

  async activate(serviceKey: string): Promise<JwtServiceDTO> {
    const db = await getServerDb();
    const [record] = await db
      .update(JwtService)
      .set({ isActive: true, updatedAt: new Date() })
      .where(eq(JwtService.serviceKey, serviceKey))
      .returning();
    if (!record) {
      throw new Error(`JwtService not found: ${serviceKey}`);
    }
    invalidateJwtService(serviceKey);
    return mapToDTO(record);
  },

  async deactivate(serviceKey: string): Promise<JwtServiceDTO> {
    const db = await getServerDb();
    const [record] = await db
      .update(JwtService)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(JwtService.serviceKey, serviceKey))
      .returning();
    if (!record) {
      throw new Error(`JwtService not found: ${serviceKey}`);
    }
    invalidateJwtService(serviceKey);
    return mapToDTO(record);
  },

  async rotate(serviceKey: string): Promise<JwtServiceDTO> {
    const db = await getServerDb();
    const [service] = await db
      .select()
      .from(JwtService)
      .where(eq(JwtService.serviceKey, serviceKey))
      .limit(1);
    if (!service) {
      throw new Error(`JwtService not found: ${serviceKey}`);
    }
    if (!service.isLocalIssuer) {
      throw new Error(`JwtService is not a local issuer: ${serviceKey}`);
    }

    const now = new Date();
    const ttlSeconds = env.MAIN_SESSION_JWT_TTL_SECONDS
      ? Number(env.MAIN_SESSION_JWT_TTL_SECONDS)
      : 900;
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
    const keyPair = await defaultJwtCryptoProvider.generateKey();
    const kid = `jwt-${now.toISOString()}`;

    await db.transaction(async (tx) => {
      await tx
        .update(Jwks)
        .set({ expiresAt })
        .where(
          and(
            eq(Jwks.jwtServiceId, service.id),
            or(isNull(Jwks.expiresAt), gt(Jwks.expiresAt, now)),
          ),
        );
      await tx.insert(Jwks).values({
        id: kid,
        jwtServiceId: service.id,
        publicJwk: {
          ...keyPair.publicJwk,
          kid,
        },
        privateJwk: {
          ...keyPair.privateJwk,
          kid,
        },
        alg: "ES256",
      });
    });

    invalidateJwtService(serviceKey);
    return mapToDTO(service);
  },
};
