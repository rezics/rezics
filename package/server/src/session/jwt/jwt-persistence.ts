import type {JwtKeyPersistence, JwtKeyRecord} from '@package/jwt';
import {
  JwtAlgorithm,
  asJwtPrivateJwk,
  asJwtPublicJwk,
  type JwtPrivateJwk,
  type JwtPublicJwk,
} from '@package/jwt';
import {prisma, Prisma} from '@/prisma/client';
import {getJwtService} from '@/src/jwt';

function mapRowToRecord(row: {
  id: string;
  publicJwk: unknown;
  privateJwk: unknown;
  alg: string | null;
  createdAt: Date;
  expiresAt: Date | null;
  jwtService: {
    issuer: string;
  };
}): JwtKeyRecord {
  return {
    issuer: row.jwtService.issuer,
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

export const serverJwtPersistence: JwtKeyPersistence = {
  async listKeys({issuer}) {
    const service = await getJwtService('server-local');
    if (issuer !== service.issuer) {
      return [];
    }

    const rows = await prisma.jwks.findMany({
      where: {
        jwtServiceId: service.id,
      },
      include: {
        jwtService: {
          select: {
            issuer: true,
          },
        },
      },
      orderBy: [{createdAt: 'desc'}],
    });

    return rows.map(mapRowToRecord);
  },
  async saveKey({issuer, key}) {
    const service = await getJwtService('server-local');
    if (issuer !== service.issuer) {
      throw new Error(`Unsupported issuer ${issuer}`);
    }

    await prisma.jwks.upsert({
      where: {id: key.kid},
      update: {
        jwtServiceId: service.id,
        publicJwk: key.publicJwk as Prisma.InputJsonValue,
        privateJwk: key.privateJwk as Prisma.InputJsonValue,
        alg: key.algorithm,
        createdAt: key.createdAt,
        expiresAt: key.expiresAt,
      },
      create: {
        id: key.kid,
        jwtServiceId: service.id,
        publicJwk: key.publicJwk as Prisma.InputJsonValue,
        privateJwk: key.privateJwk as Prisma.InputJsonValue,
        alg: key.algorithm,
        createdAt: key.createdAt,
        expiresAt: key.expiresAt,
      },
    });
  },
  async markKeyRetiring({issuer, kid, expiresAt}) {
    const service = await getJwtService('server-local');
    if (issuer !== service.issuer) {
      throw new Error(`Unsupported issuer ${issuer}`);
    }

    await prisma.jwks.update({
      where: {id: kid},
      data: {expiresAt},
    });
  },
  async getKeyByKid({issuer, kid}) {
    const service = await getJwtService('server-local');
    if (issuer !== service.issuer) {
      return null;
    }

    const row = await prisma.jwks.findUnique({
      where: {id: kid},
      include: {
        jwtService: {
          select: {
            issuer: true,
          },
        },
      },
    });

    return row ? mapRowToRecord(row) : null;
  },
};
