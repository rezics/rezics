import type {
  CreateJwtServiceInput,
  JwtServiceDTO,
  UpdateJwtServiceInput,
} from "@rezics/contract";
import { defaultJwtCryptoProvider } from "@/internal/jwt";
import { and, asc, eq, gt, isNull, or } from "drizzle-orm";
import { db } from "../db/client";
import { jwks, jwtServices } from "../db/schema";
import { getAuthJwksGracePeriodSeconds } from "../session/jwt/options";

function mapToDTO(record: {
  id: string;
  serviceKey: string;
  issuer: string;
  audience: string;
  jwksUrl: string;
  jwksPath: string;
  isLocalIssuer: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): JwtServiceDTO {
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

export const authJwtServiceAdminService = {
  async list(): Promise<JwtServiceDTO[]> {
    const records = await db
      .select()
      .from(jwtServices)
      .orderBy(asc(jwtServices.createdAt));
    return records.map(mapToDTO);
  },

  async fetch(serviceKey: string): Promise<JwtServiceDTO | null> {
    const record =
      (
        await db
          .select()
          .from(jwtServices)
          .where(eq(jwtServices.serviceKey, serviceKey))
          .limit(1)
      )[0] ?? null;
    return record ? mapToDTO(record) : null;
  },

  async create(input: CreateJwtServiceInput): Promise<JwtServiceDTO> {
    const [record] = await db
      .insert(jwtServices)
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
    if (!record) throw new Error("Failed to create JWT service");
    return mapToDTO(record);
  },

  async update(
    serviceKey: string,
    input: UpdateJwtServiceInput,
  ): Promise<JwtServiceDTO> {
    const [record] = await db
      .update(jwtServices)
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
      .where(eq(jwtServices.serviceKey, serviceKey))
      .returning();
    if (!record) throw new Error(`JwtService not found: ${serviceKey}`);
    return mapToDTO(record);
  },

  async activate(serviceKey: string): Promise<JwtServiceDTO> {
    const [record] = await db
      .update(jwtServices)
      .set({ isActive: true, updatedAt: new Date() })
      .where(eq(jwtServices.serviceKey, serviceKey))
      .returning();
    if (!record) throw new Error(`JwtService not found: ${serviceKey}`);
    return mapToDTO(record);
  },

  async deactivate(serviceKey: string): Promise<JwtServiceDTO> {
    const [record] = await db
      .update(jwtServices)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(jwtServices.serviceKey, serviceKey))
      .returning();
    if (!record) throw new Error(`JwtService not found: ${serviceKey}`);
    return mapToDTO(record);
  },

  async rotate(serviceKey: string): Promise<JwtServiceDTO> {
    const service =
      (
        await db
          .select()
          .from(jwtServices)
          .where(eq(jwtServices.serviceKey, serviceKey))
          .limit(1)
      )[0] ?? null;
    if (!service) {
      throw new Error(`JwtService not found: ${serviceKey}`);
    }
    if (!service.isLocalIssuer) {
      throw new Error(`JwtService is not a local issuer: ${serviceKey}`);
    }

    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + getAuthJwksGracePeriodSeconds() * 1000,
    );
    const keyPair = await defaultJwtCryptoProvider.generateKey();
    const kid = `jwt-${now.toISOString()}`;

    await db.transaction(async (tx) => {
      await tx
        .update(jwks)
        .set({ expiresAt })
        .where(
          and(
            eq(jwks.jwtServiceId, service.id),
            or(isNull(jwks.expiresAt), gt(jwks.expiresAt, now)),
          ),
        );
      await tx.insert(jwks).values({
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

    return mapToDTO(service);
  },
};
