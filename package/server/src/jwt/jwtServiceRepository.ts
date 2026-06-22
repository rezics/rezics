import type { JwtPrivateJwk, JwtPublicJwk } from "@rezics/jwt";
import { and, desc, eq, gt, isNull, or } from "drizzle-orm";
import { Jwks, JwtService } from "../db/schema";

export type CachedJwksEntry = {
  kid: string;
  publicJwk: JwtPublicJwk;
  privateJwk: JwtPrivateJwk;
  alg: string | null;
  createdAt: Date;
  expiresAt: Date | null;
};

export type CachedJwtService = {
  id: string;
  serviceKey: string;
  issuer: string;
  audience: string;
  jwksUrl: string;
  jwksPath: string;
  isLocalIssuer: boolean;
  isActive: boolean;
  jwks: CachedJwksEntry[];
};

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

export async function fetchJwtService(
  serviceKey: string,
): Promise<CachedJwtService> {
  const db = await getServerDb();
  const [record] = await db
    .select()
    .from(JwtService)
    .where(eq(JwtService.serviceKey, serviceKey))
    .limit(1);

  if (!record) {
    throw new Error(`JwtService not found for serviceKey: ${serviceKey}`);
  }

  const jwks = await db
    .select()
    .from(Jwks)
    .where(
      and(
        eq(Jwks.jwtServiceId, record.id),
        or(isNull(Jwks.expiresAt), gt(Jwks.expiresAt, new Date())),
      ),
    )
    .orderBy(desc(Jwks.createdAt));

  return {
    id: record.id,
    serviceKey: record.serviceKey,
    issuer: record.issuer,
    audience: record.audience,
    jwksUrl: record.jwksUrl,
    jwksPath: record.jwksPath,
    isLocalIssuer: record.isLocalIssuer,
    isActive: record.isActive,
    jwks: jwks.map((row) => ({
      kid: row.id,
      publicJwk: row.publicJwk,
      privateJwk: row.privateJwk,
      alg: row.alg,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
    })),
  };
}
