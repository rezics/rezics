import {beforeEach, describe, expect, mock, test} from 'bun:test';
import {JwtAlgorithm} from '@package/jwt';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??=
  'postgresql://postgres:postgres@localhost:5432/rezics_book';
process.env.AUTH_BASE_URL ??= 'http://localhost:3001';

const jwtServiceUpsert = mock();
const jwksFindMany = mock();
const jwksFindUnique = mock();
const jwksUpsert = mock();
const jwksUpdate = mock();

mock.module('../../prisma/client', () => ({
  prisma: {
    jwtService: {
      upsert: jwtServiceUpsert,
    },
    jwks: {
      findMany: jwksFindMany,
      findUnique: jwksFindUnique,
      upsert: jwksUpsert,
      update: jwksUpdate,
    },
  },
}));

describe('server jwt persistence', () => {
  beforeEach(() => {
    process.env.PORT = '3000';
    process.env.MAIN_SESSION_JWT_ISSUER = 'http://localhost:3000';
    process.env.MAIN_SESSION_JWT_AUDIENCE = 'rezics-main-server';
    jwtServiceUpsert.mockReset();
    jwksFindMany.mockReset();
    jwksFindUnique.mockReset();
    jwksUpsert.mockReset();
    jwksUpdate.mockReset();
    jwtServiceUpsert.mockResolvedValue({
      id: 'server-local-id',
      serviceKey: 'server-local',
      issuer: 'http://localhost:3000',
      audience: 'rezics-main-server',
      jwksUrl: 'http://localhost:3000/api/session/jwks',
      jwksPath: '/api/session/jwks',
      isLocalIssuer: true,
      isActive: true,
    });
  });

  test('lists local server signing keys via the local jwt service record', async () => {
    jwksFindMany.mockResolvedValue([
      {
        id: 'server-kid',
        publicJwk: {
          kid: 'server-kid',
          kty: 'EC',
          crv: 'P-256',
          x: 'public-x',
          y: 'public-y',
          alg: JwtAlgorithm.ES256,
          use: 'sig',
        },
        privateJwk: {
          kid: 'server-kid',
          kty: 'EC',
          crv: 'P-256',
          x: 'public-x',
          y: 'public-y',
          d: 'private-d',
          alg: JwtAlgorithm.ES256,
          use: 'sig',
        },
        alg: 'ES256',
        createdAt: new Date('2026-03-17T00:00:00.000Z'),
        expiresAt: null,
        jwtService: {
          issuer: 'http://localhost:3000',
        },
      },
    ]);

    const {serverJwtPersistence} = await import('./jwt-persistence');
    const keys = await serverJwtPersistence.listKeys({
      issuer: 'http://localhost:3000',
    });

    expect(keys).toHaveLength(1);
    expect(jwksFindMany.mock.calls[0]?.[0]).toMatchObject({
      where: {
        jwtServiceId: 'server-local-id',
      },
    });
  });

  test('links saved keys to the local server jwt service record', async () => {
    jwksUpsert.mockResolvedValue({});

    const {serverJwtPersistence} = await import('./jwt-persistence');
    await serverJwtPersistence.saveKey({
      issuer: 'http://localhost:3000',
      key: {
        issuer: 'http://localhost:3000',
        kid: 'server-kid',
        algorithm: JwtAlgorithm.ES256,
        publicJwk: {
          kid: 'server-kid',
          kty: 'EC',
          crv: 'P-256',
          x: 'public-x',
          y: 'public-y',
          alg: JwtAlgorithm.ES256,
          use: 'sig',
        },
        privateJwk: {
          kid: 'server-kid',
          kty: 'EC',
          crv: 'P-256',
          x: 'public-x',
          y: 'public-y',
          d: 'private-d',
          alg: JwtAlgorithm.ES256,
          use: 'sig',
        },
        createdAt: new Date('2026-03-17T00:00:00.000Z'),
        activatesAt: new Date('2026-03-17T00:00:00.000Z'),
        retiresAt: null,
        expiresAt: null,
      },
    });

    expect(jwksUpsert.mock.calls[0]?.[0]).toMatchObject({
      update: {
        jwtServiceId: 'server-local-id',
      },
      create: {
        jwtServiceId: 'server-local-id',
      },
    });
  });

  test('marks local keys retiring through the server jwks table', async () => {
    const expiresAt = new Date('2026-03-18T00:00:00.000Z');

    const {serverJwtPersistence} = await import('./jwt-persistence');
    await serverJwtPersistence.markKeyRetiring({
      issuer: 'http://localhost:3000',
      kid: 'server-kid',
      retiresAt: new Date('2026-03-17T23:00:00.000Z'),
      expiresAt,
    });

    expect(jwksUpdate).toHaveBeenCalledTimes(1);
    expect(jwksUpdate.mock.calls[0]?.[0]).toMatchObject({
      where: {id: 'server-kid'},
      data: {expiresAt},
    });
  });
});
