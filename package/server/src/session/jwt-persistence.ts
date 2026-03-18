import type {JwtKeyPersistence, JwtKeyRecord} from '@package/jwt';
import {JwtAlgorithm} from '@package/jwt';
import {prisma} from '../../prisma/client';
import {
  ensureLocalServerJwtServiceRecord,
  getServerSessionJwtMetadata,
} from './jwt-metadata';

function mapRowToRecord(row: {
  id: string;
  publicKey: string;
  privateKey: string;
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
    publicKeyPem: row.publicKey,
    privateKeyPem: row.privateKey,
    createdAt: row.createdAt,
    activatesAt: row.createdAt,
    retiresAt: row.expiresAt,
    expiresAt: row.expiresAt,
  };
}

export const serverJwtPersistence: JwtKeyPersistence = {
  async listKeys({issuer}) {
    const localService = await ensureLocalServerJwtServiceRecord();
    if (issuer !== localService.issuer) {
      return [];
    }

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
    const localService = await ensureLocalServerJwtServiceRecord();
    if (issuer !== localService.issuer) {
      throw new Error(`Unsupported issuer ${issuer}`);
    }

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
    const localMetadata = getServerSessionJwtMetadata();
    if (issuer !== localMetadata.issuer) {
      throw new Error(`Unsupported issuer ${issuer}`);
    }

    await prisma.jwks.update({
      where: {id: kid},
      data: {expiresAt},
    });
  },
  async getKeyByKid({issuer, kid}) {
    const localMetadata = getServerSessionJwtMetadata();
    if (issuer !== localMetadata.issuer) {
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
