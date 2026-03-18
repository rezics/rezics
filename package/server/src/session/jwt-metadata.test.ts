import {beforeEach, describe, expect, mock, test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??=
  'postgresql://postgres:postgres@localhost:5432/rezics_book';
process.env.JWT_SECRET ??=
  'server-jwt-secret-for-tests-abcdefghijklmnopqrstuvwxyz';
process.env.REFRESH_TOKEN_SECRET ??=
  'server-refresh-secret-for-tests-abcdefghijklmnopqrstuvwxyz';

const jwtServiceUpsert = mock();

mock.module('../../prisma/client', () => ({
  prisma: {
    jwtService: {
      upsert: jwtServiceUpsert,
    },
  },
}));

describe('server jwt metadata registry', () => {
  beforeEach(() => {
    process.env.PORT = '3000';
    process.env.MAIN_SESSION_JWT_ISSUER = 'http://localhost:3000';
    process.env.MAIN_SESSION_JWT_AUDIENCE = 'rezics-main-server';
    process.env.AUTH_JWT_ISSUER = 'http://localhost:35003';
    process.env.AUTH_JWT_AUDIENCE = 'rezics-api';
    delete process.env.AUTH_JWKS_URL;
    jwtServiceUpsert.mockReset();
  });

  test('upserts the local server jwt service metadata from bootstrap env', async () => {
    jwtServiceUpsert.mockResolvedValue({
      id: 'server-local-id',
      serviceKey: 'server-local',
    });

    const {ensureLocalServerJwtServiceRecord} = await import('./jwt-metadata');
    await ensureLocalServerJwtServiceRecord();

    expect(jwtServiceUpsert).toHaveBeenCalledTimes(1);
    expect(jwtServiceUpsert.mock.calls[0]?.[0]).toMatchObject({
      where: {
        serviceKey: 'server-local',
      },
      update: {
        issuer: 'http://localhost:3000',
        audience: 'rezics-main-server',
        jwksUrl: 'http://localhost:3000/api/session/jwks',
        jwksPath: '/api/session/jwks',
        isLocalIssuer: true,
        isActive: true,
      },
      create: {
        serviceKey: 'server-local',
        issuer: 'http://localhost:3000',
        audience: 'rezics-main-server',
        jwksUrl: 'http://localhost:3000/api/session/jwks',
        jwksPath: '/api/session/jwks',
        isLocalIssuer: true,
        isActive: true,
      },
    });
  });

  test('upserts trusted auth jwt metadata with canonical auth jwks defaults', async () => {
    jwtServiceUpsert.mockResolvedValue({
      id: 'auth-upstream-id',
      serviceKey: 'auth-upstream',
    });

    const {ensureTrustedAuthJwtServiceRecord} = await import('./jwt-metadata');
    await ensureTrustedAuthJwtServiceRecord();

    expect(jwtServiceUpsert).toHaveBeenCalledTimes(1);
    expect(jwtServiceUpsert.mock.calls[0]?.[0]).toMatchObject({
      where: {
        serviceKey: 'auth-upstream',
      },
      update: {
        issuer: 'http://localhost:35003',
        audience: 'rezics-api',
        jwksUrl: 'http://localhost:35003/api/auth/session/jwks',
        jwksPath: '/api/auth/session/jwks',
        isLocalIssuer: false,
        isActive: true,
      },
    });
  });

  test('keeps migration bootstrap rows for local and trusted services', () => {
    const migrationPath = join(
      import.meta.dir,
      '../../prisma/migrations/20260317121500_add_jwt_service_registry/migration.sql',
    );
    const migrationSql = readFileSync(migrationPath, 'utf8');

    expect(migrationSql).toContain('CREATE TABLE "JwtService"');
    expect(migrationSql).toContain('CREATE TABLE "Jwks"');
    expect(migrationSql).toContain(`'server-local'`);
    expect(migrationSql).toContain(`'auth-upstream'`);
    expect(migrationSql).toContain(
      'FOREIGN KEY ("jwtServiceId") REFERENCES "JwtService"("id")',
    );
  });
});
