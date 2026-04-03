import {createHash} from 'node:crypto';
import {symmetricDecrypt, symmetricEncrypt} from 'better-auth/crypto';
import type {JwtKeyPersistence, JwtKeyRecord} from '@rezics/jwt';
import {
  JwtAlgorithm,
  asJwtPrivateJwk,
  asJwtPublicJwk,
  type JwtPrivateJwk,
  type JwtPublicJwk,
} from '@rezics/jwt';
import {prisma} from '../../auth/prisma';
import {
  authJwtLocalServiceKey,
  getAuthJwtAudience,
  getAuthJwtIssuer,
  getAuthJwksGracePeriodSeconds,
  getAuthSessionJwksPath,
  getAuthSessionJwksUrl,
} from './options';

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

type BetterAuthJwtAdapterContext = {
  context?: {
    secretConfig?: string | {currentVersion: number; keys: Map<number, string>};
  };
};

type BetterAuthJwtAdapterOptions = {
  disablePrivateKeyEncryption?: boolean;
};

type BetterAuthSerializedJwkPayload = {
  kid?: string;
  alg?: string;
  crv?: string;
  publicKey: string;
  privateKey: string;
  createdAt: Date;
  expiresAt?: Date;
};

type BetterAuthDirectJwkPayload = {
  kid?: string;
  kty: string;
  crv?: string;
  x?: string;
  y?: string;
  d?: string;
  createdAt: Date;
  expiresAt?: Date;
  alg?: string;
};

function deriveDeterministicKid(publicJwk: JwtPublicJwk): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        kty: publicJwk.kty,
        crv: publicJwk.crv,
        x: publicJwk.x,
        y: publicJwk.y,
      }),
    )
    .digest('hex')
    .slice(0, 32);
}

function isSerializedJwkPayload(
  data: BetterAuthSerializedJwkPayload | BetterAuthDirectJwkPayload,
): data is BetterAuthSerializedJwkPayload {
  return 'publicKey' in data && 'privateKey' in data;
}

function parseJsonValue(raw: string, fieldName: string): unknown {
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid ${fieldName} JSON`, {cause: error});
  }
}

function asCompletePrivateJwk(jwk: unknown): JwtPrivateJwk {
  if (
    !jwk ||
    typeof jwk !== 'object' ||
    !('d' in jwk) ||
    !('x' in jwk) ||
    !('y' in jwk) ||
    !('kty' in jwk) ||
    jwk.kty !== 'EC'
  ) {
    throw new Error('Expected a complete ES256 private JWK');
  }

  return asJwtPrivateJwk(jwk as JwtPrivateJwk);
}

async function parseSerializedPrivateJwk(
  privateKey: string,
  ctx: BetterAuthJwtAdapterContext,
): Promise<JwtPrivateJwk> {
  const parsed = parseJsonValue(privateKey, 'privateKey');
  if (typeof parsed !== 'string') {
    return asCompletePrivateJwk(parsed);
  }

  const secretConfig = ctx.context?.secretConfig;
  if (!secretConfig) {
    throw new Error('Missing Better Auth secret config for encrypted privateKey');
  }

  const decrypted = await symmetricDecrypt({
    key: secretConfig,
    data: parsed,
  });
  return asCompletePrivateJwk(parseJsonValue(decrypted, 'decrypted privateKey'));
}

async function toJwtKeyRecord(
  data: BetterAuthSerializedJwkPayload | BetterAuthDirectJwkPayload,
  ctx: BetterAuthJwtAdapterContext,
): Promise<JwtKeyRecord> {
  if (isSerializedJwkPayload(data)) {
    const publicJwk = asJwtPublicJwk(
      parseJsonValue(data.publicKey, 'publicKey') as JwtPublicJwk,
    );
    const privateJwk = await parseSerializedPrivateJwk(data.privateKey, ctx);
    const kid = data.kid ?? publicJwk.kid ?? privateJwk.kid;
    const normalizedPublicJwk = asJwtPublicJwk({
      ...publicJwk,
      kid: kid ?? deriveDeterministicKid(asJwtPublicJwk(publicJwk)),
    });
    const normalizedPrivateJwk = asJwtPrivateJwk({
      ...privateJwk,
      kid: normalizedPublicJwk.kid,
    });

    return {
      issuer: getAuthJwtIssuer(),
      kid: normalizedPublicJwk.kid,
      algorithm: (data.alg as JwtAlgorithm | undefined) ?? JwtAlgorithm.ES256,
      publicJwk: normalizedPublicJwk,
      privateJwk: normalizedPrivateJwk,
      createdAt: data.createdAt,
      activatesAt: data.createdAt,
      retiresAt: data.expiresAt
        ? new Date(
            data.expiresAt.getTime() - getAuthJwksGracePeriodSeconds() * 1000,
          )
        : null,
      expiresAt: data.expiresAt ?? null,
    };
  }

  if (!data.d || !data.x || !data.y || data.kty !== 'EC') {
    throw new Error('Expected a complete ES256 private JWK');
  }

  const publicJwk = asJwtPublicJwk({
    kid: data.kid ?? deriveDeterministicKid(asJwtPublicJwk(data)),
    kty: data.kty,
    crv: data.crv,
    x: data.x,
    y: data.y,
  });

  return {
    issuer: getAuthJwtIssuer(),
    kid: publicJwk.kid,
    algorithm: (data.alg as JwtAlgorithm | undefined) ?? JwtAlgorithm.ES256,
    publicJwk,
    privateJwk: asJwtPrivateJwk({
      ...publicJwk,
      d: data.d,
    }),
    createdAt: data.createdAt,
    activatesAt: data.createdAt,
    retiresAt: data.expiresAt
      ? new Date(
          data.expiresAt.getTime() - getAuthJwksGracePeriodSeconds() * 1000,
        )
      : null,
    expiresAt: data.expiresAt ?? null,
  };
}

async function toBetterAuthJwkRecord(
  key: JwtKeyRecord,
  ctx: BetterAuthJwtAdapterContext,
  options: BetterAuthJwtAdapterOptions,
) {
  const privateWebKey = JSON.stringify(key.privateJwk);
  const privateKey = options.disablePrivateKeyEncryption
    ? privateWebKey
    : JSON.stringify(
        await symmetricEncrypt({
          key:
            ctx.context?.secretConfig ??
            (() => {
              throw new Error(
                'Missing Better Auth secret config for privateKey encryption',
              );
            })(),
          data: privateWebKey,
        }),
      );

  return {
    id: key.kid,
    alg: key.algorithm,
    crv: key.publicJwk.crv,
    publicKey: JSON.stringify(key.publicJwk),
    privateKey,
    createdAt: key.createdAt,
    expiresAt: key.expiresAt ?? undefined,
  };
}

function mapRowToRecord(row: {
  id: string;
  jwtService: {
    issuer: string;
  };
  publicJwk: unknown;
  privateJwk: unknown;
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
    publicJwk: asJwtPublicJwk(row.publicJwk as JwtPublicJwk),
    privateJwk: asJwtPrivateJwk(row.privateJwk as JwtPrivateJwk),
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
    update: {},
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
        publicJwk: key.publicJwk as any,
        privateJwk: key.privateJwk as any,
        alg: key.algorithm,
        createdAt: key.createdAt,
        expiresAt: key.expiresAt,
      },
      create: {
        id: key.kid,
        jwtServiceId: localService.id,
        publicJwk: key.publicJwk as any,
        privateJwk: key.privateJwk as any,
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

export function createBetterAuthJwtAdapter(
  options: BetterAuthJwtAdapterOptions = {},
) {
  return {
    getJwks: async (_ctx: BetterAuthJwtAdapterContext) => {
      const keys = await authJwtPersistence.listKeys({
        issuer: getAuthJwtIssuer(),
      });
      return Promise.all(
        keys.map(key => toBetterAuthJwkRecord(key, _ctx, options)),
      );
    },
    createJwk: async (
      data: BetterAuthSerializedJwkPayload | BetterAuthDirectJwkPayload,
      _ctx: BetterAuthJwtAdapterContext,
    ) => {
      const key = await toJwtKeyRecord(data, _ctx);

      await authJwtPersistence.saveKey({
        issuer: getAuthJwtIssuer(),
        key,
      });

      return toBetterAuthJwkRecord(key, _ctx, options);
    },
  };
}
