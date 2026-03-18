import {beforeEach, describe, expect, mock, test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/rezics_auth';
process.env.BETTER_AUTH_URL = 'http://localhost:35003';
process.env.AUTH_JWT_ISSUER = 'http://localhost:35003';
process.env.AUTH_JWT_AUDIENCE = 'rezics-api';
process.env.BETTER_AUTH_SECRET =
  process.env.BETTER_AUTH_SECRET ??
  'better-auth-secret-for-tests-abcdefghijklmnopqrstuvwxyz';
process.env.AUTH_INTERNAL_TOKEN_GATEWAY_SECRET =
  process.env.AUTH_INTERNAL_TOKEN_GATEWAY_SECRET ??
  'internal-auth-gateway-test';

const jwtServiceUpsert = mock();
const jwksFindMany = mock();
const jwksUpsert = mock();

mock.module('../../auth/prisma', () => ({
  prisma: {
    jwtService: {
      upsert: jwtServiceUpsert,
    },
    jwks: {
      findMany: jwksFindMany,
      upsert: jwksUpsert,
    },
  },
}));

describe('auth jwt prisma adapter', () => {
  beforeEach(() => {
    process.env.BETTER_AUTH_URL = 'http://localhost:35003';
    process.env.AUTH_JWT_ISSUER = 'http://localhost:35003';
    process.env.AUTH_JWT_AUDIENCE = 'rezics-api';
    jwtServiceUpsert.mockReset();
    jwksFindMany.mockReset();
    jwksUpsert.mockReset();
  });

  test('upserts the local auth jwt service metadata from runtime config', async () => {
    jwtServiceUpsert.mockResolvedValue({
      id: 'jwt-service-auth',
      serviceKey: 'auth-local',
      issuer: 'http://localhost:35003',
      audience: 'rezics-api',
      jwksUrl: 'http://localhost:35003/api/auth/session/jwks',
      jwksPath: '/api/auth/session/jwks',
      isLocalIssuer: true,
      isActive: true,
    });

    const {ensureLocalAuthJwtServiceRecord} = await import('./prisma-adapter');
    const record = await ensureLocalAuthJwtServiceRecord();

    expect(record.serviceKey).toBe('auth-local');
    expect(jwtServiceUpsert).toHaveBeenCalledTimes(1);
    expect(jwtServiceUpsert.mock.calls[0]?.[0]).toMatchObject({
      where: {
        serviceKey: 'auth-local',
      },
      update: {
        issuer: 'http://localhost:35003',
        audience: 'rezics-api',
        jwksUrl: 'http://localhost:35003/api/auth/session/jwks',
        jwksPath: '/api/auth/session/jwks',
        isLocalIssuer: true,
        isActive: true,
      },
      create: {
        serviceKey: 'auth-local',
        issuer: 'http://localhost:35003',
        audience: 'rezics-api',
        jwksUrl: 'http://localhost:35003/api/auth/session/jwks',
        jwksPath: '/api/auth/session/jwks',
        isLocalIssuer: true,
        isActive: true,
      },
    });
  });

  test('links saved jwks rows to the local auth jwt service record', async () => {
    jwtServiceUpsert.mockResolvedValue({
      id: 'jwt-service-auth',
      serviceKey: 'auth-local',
      issuer: 'http://localhost:35003',
      audience: 'rezics-api',
      jwksUrl: 'http://localhost:35003/api/auth/session/jwks',
      jwksPath: '/api/auth/session/jwks',
      isLocalIssuer: true,
      isActive: true,
    });
    jwksUpsert.mockResolvedValue({});

    const {authJwtPersistence} = await import('./prisma-adapter');
    await authJwtPersistence.saveKey({
      issuer: 'http://localhost:35003',
      key: {
        issuer: 'http://localhost:35003',
        kid: 'kid-auth',
        algorithm: 'ES256',
        publicKeyPem: 'public-key',
        privateKeyPem: 'private-key',
        createdAt: new Date('2026-03-17T00:00:00.000Z'),
        activatesAt: new Date('2026-03-17T00:00:00.000Z'),
        retiresAt: null,
        expiresAt: null,
      },
    });

    expect(jwksUpsert).toHaveBeenCalledTimes(1);
    expect(jwksUpsert.mock.calls[0]?.[0]).toMatchObject({
      update: {
        jwtServiceId: 'jwt-service-auth',
      },
      create: {
        jwtServiceId: 'jwt-service-auth',
      },
    });
  });

  test('keeps migration bootstrap and backfill steps for legacy jwks rows', () => {
    const migrationPath = join(
      import.meta.dir,
      '../../../prisma/migrations/20260317103000_add_jwt_service_registry/migration.sql',
    );
    const migrationSql = readFileSync(migrationPath, 'utf8');

    expect(migrationSql).toContain('CREATE TABLE "JwtService"');
    expect(migrationSql).toContain(`'auth-local'`);
    expect(migrationSql).toContain(
      'UPDATE "Jwks"\nSET "jwtServiceId" = (SELECT "id" FROM "JwtService" WHERE "serviceKey" = \'auth-local\')',
    );
    expect(migrationSql).toContain(
      'ALTER TABLE "Jwks" ALTER COLUMN "jwtServiceId" SET NOT NULL',
    );
  });
});
