import {prisma} from '#/prisma/client';
import type {JwtPrivateJwk, JwtPublicJwk} from '@rezics/jwt';

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

export async function fetchJwtService(
  serviceKey: string,
): Promise<CachedJwtService> {
  const record = await prisma.jwtService.findUnique({
    where: {serviceKey},
    include: {
      jwks: {
        where: {
          OR: [{expiresAt: null}, {expiresAt: {gt: new Date()}}],
        },
        orderBy: {createdAt: 'desc'},
      },
    },
  });

  if (!record) {
    throw new Error(`JwtService not found for serviceKey: ${serviceKey}`);
  }

  return {
    id: record.id,
    serviceKey: record.serviceKey,
    issuer: record.issuer,
    audience: record.audience,
    jwksUrl: record.jwksUrl,
    jwksPath: record.jwksPath,
    isLocalIssuer: record.isLocalIssuer,
    isActive: record.isActive,
    jwks: record.jwks.map(row => ({
      kid: row.id,
      publicJwk: row.publicJwk as unknown as JwtPublicJwk,
      privateJwk: row.privateJwk as unknown as JwtPrivateJwk,
      alg: row.alg,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
    })),
  };
}
