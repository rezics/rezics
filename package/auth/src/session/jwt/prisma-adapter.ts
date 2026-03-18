import {createHash} from 'node:crypto';
import type {JwtKeyPersistence, JwtKeyRecord} from '@package/jwt';
import {JwtAlgorithm, publicPemToJwk} from '@package/jwt';
import {prisma} from '../../auth/prisma';
import {
  authJwtLocalServiceKey,
  getAuthJwtAudience,
  getAuthJwtIssuer,
  getAuthJwksGracePeriodSeconds,
  getAuthSessionJwksPath,
  getAuthSessionJwksUrl,
} from './config';

type JwtServiceRecord = {
  id: string;
  serviceKey: string;
  issuer: string;
  audience: string;
  jwksUrl: string;
  jwksPath: string;
  isLocalIssuer: boolean;
  isActive: boolean;
};

function deriveDeterministicKid(publicKey: string): string {
  return createHash('sha256').update(publicKey).digest('hex').slice(0, 32);
}

function mapRowToRecord(row: {
  id: string;
  jwtService: {
    issuer: string;
  };
  publicKey: string;
  privateKey: string;
  alg: string | null;
  createdAt: Date;
  expiresAt: Date | null;
}): JwtKeyRecord {
  const retiresAt =
    row.expiresAt === null
      ? null
      : new Date(
          row.expiresAt.getTime() - getAuthJwksGracePeriodSeconds() * 1000,
        );

  return {
    issuer: row.jwtService.issuer,
    kid: row.id,
    algorithm: (row.alg as JwtAlgorithm | null) ?? JwtAlgorithm.ES256,
    publicKeyPem: row.publicKey,
    privateKeyPem: row.privateKey,
    createdAt: row.createdAt,
    activatesAt: row.createdAt,
    retiresAt,
    expiresAt: row.expiresAt,
  };
}

export async function ensureLocalAuthJwtServiceRecord(): Promise<JwtServiceRecord> {
  return prisma.jwtService.upsert({
    where: {
      serviceKey: authJwtLocalServiceKey,
    },
    update: {
      issuer: getAuthJwtIssuer(),
      audience: getAuthJwtAudience(),
      jwksUrl: getAuthSessionJwksUrl(),
      jwksPath: getAuthSessionJwksPath(),
      isLocalIssuer: true,
      isActive: true,
    },
    create: {
      serviceKey: authJwtLocalServiceKey,
      issuer: getAuthJwtIssuer(),
      audience: getAuthJwtAudience(),
      jwksUrl: getAuthSessionJwksUrl(),
      jwksPath: getAuthSessionJwksPath(),
      isLocalIssuer: true,
      isActive: true,
    },
  });
}

export async function getLocalAuthJwtServiceRecord(): Promise<JwtServiceRecord> {
  return ensureLocalAuthJwtServiceRecord();
}

export const authJwtPersistence: JwtKeyPersistence = {
  async listKeys({issuer}) {
    if (issuer !== getAuthJwtIssuer()) {
      return [];
    }

    const localService = await ensureLocalAuthJwtServiceRecord();
    const rows = await prisma.jwks.findMany({
      where: {
        jwtServiceId: localService.id,
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
    if (issuer !== getAuthJwtIssuer()) {
      throw new Error(`Unsupported issuer ${issuer}`);
    }

    const localService = await ensureLocalAuthJwtServiceRecord();
    await prisma.jwks.upsert({
      where: {id: key.kid},
      update: {
        jwtServiceId: localService.id,
        publicKey: key.publicKeyPem,
        privateKey: key.privateKeyPem,
        alg: key.algorithm,
        createdAt: key.createdAt,
        expiresAt: key.expiresAt,
      },
      create: {
        id: key.kid,
        jwtServiceId: localService.id,
        publicKey: key.publicKeyPem,
        privateKey: key.privateKeyPem,
        alg: key.algorithm,
        createdAt: key.createdAt,
        expiresAt: key.expiresAt,
      },
    });
  },
  async markKeyRetiring({issuer, kid, expiresAt}) {
    if (issuer !== getAuthJwtIssuer()) {
      throw new Error(`Unsupported issuer ${issuer}`);
    }

    await prisma.jwks.update({
      where: {id: kid},
      data: {expiresAt},
    });
  },
  async getKeyByKid({issuer, kid}) {
    if (issuer !== getAuthJwtIssuer()) {
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

export function createBetterAuthJwtAdapter() {
  return {
    getJwks: async (_ctx: unknown) => {
      void _ctx;
      const keys = await authJwtPersistence.listKeys({
        issuer: getAuthJwtIssuer(),
      });
      return Promise.all(
        keys.map(async key => ({
          ...(await publicPemToJwk(key.publicKeyPem, key.kid)),
          privateKey: key.privateKeyPem,
          publicKey: key.publicKeyPem,
          createdAt: key.createdAt,
          expiresAt: key.expiresAt ?? undefined,
          alg: key.algorithm,
          crv: 'P-256',
        })),
      );
    },
    createJwk: async (
      data: {
        publicKey: string;
        privateKey: string;
        createdAt: Date;
        expiresAt?: Date;
        alg?: string;
        crv?: string;
      },
      _ctx: unknown,
    ) => {
      void _ctx;
      const key: JwtKeyRecord = {
        issuer: getAuthJwtIssuer(),
        kid: deriveDeterministicKid(data.publicKey),
        algorithm: (data.alg as JwtAlgorithm | undefined) ?? JwtAlgorithm.ES256,
        publicKeyPem: data.publicKey,
        privateKeyPem: data.privateKey,
        createdAt: data.createdAt,
        activatesAt: data.createdAt,
        retiresAt: data.expiresAt
          ? new Date(
              data.expiresAt.getTime() -
                getAuthJwksGracePeriodSeconds() * 1000,
            )
          : null,
        expiresAt: data.expiresAt ?? null,
      };

      await authJwtPersistence.saveKey({
        issuer: getAuthJwtIssuer(),
        key,
      });

      return {
        id: key.kid,
        publicKey: key.publicKeyPem,
        privateKey: key.privateKeyPem,
        createdAt: key.createdAt,
        expiresAt: key.expiresAt ?? undefined,
        alg: key.algorithm,
        crv: data.crv ?? 'P-256',
      };
    },
  };
}
