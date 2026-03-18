import {describe, expect, test} from 'bun:test';
import {SignJWT, exportJWK, generateKeyPair} from 'jose';
import type {JWTPayload} from '../model/types';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??=
  'postgresql://postgres:postgres@localhost:5432/rezics_book';
process.env.JWT_SECRET ??=
  'server-jwt-secret-for-tests-abcdefghijklmnopqrstuvwxyz';
process.env.REFRESH_TOKEN_SECRET ??=
  'server-refresh-secret-for-tests-abcdefghijklmnopqrstuvwxyz';
process.env.AUTH_JWT_ISSUER = 'http://localhost:3001';
process.env.AUTH_JWT_AUDIENCE = 'rezics-api';
process.env.AUTH_JWT_CLOCK_TOLERANCE_SECONDS = '5';
process.env.BETTER_AUTH_URL ??= 'http://localhost:3001';
process.env.BETTER_AUTH_SECRET ??=
  'better-auth-secret-for-tests-abcdefghijklmnopqrstuvwxyz';
process.env.AUTH_INTERNAL_TOKEN_GATEWAY_SECRET ??= 'internal-auth-gateway-test';

describe('auth bearer e2e flow', () => {
  test('token issuance -> bearer verification with offline jwks', async () => {
    const {publicKey, privateKey} = await generateKeyPair('ES256');
    const publicJwk = await exportJWK(publicKey);

    const jwksServer = Bun.serve({
      port: 0,
      fetch() {
        return Response.json({
          keys: [
            {
              ...publicJwk,
              kid: 'rezics-active',
              alg: 'ES256',
              use: 'sig',
            },
          ],
        });
      },
    });

    process.env.AUTH_JWKS_URL = `http://localhost:${jwksServer.port}/api/auth/session/jwks`;
    const {verifyAuth} = await import('../util/utils');

    const token = await new SignJWT({
      unitId: '4f1af8b5-6c9f-4c32-8c17-9108fb6af001',
      scope: 'user',
    })
      .setProtectedHeader({alg: 'ES256', kid: 'rezics-active'})
      .setIssuer('http://localhost:3001')
      .setAudience('rezics-api')
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(privateKey);

    const set = {status: 200};
    const payload = await verifyAuth<JWTPayload>(`Bearer ${token}`, set, {
      issuer: 'http://localhost:3001',
      audience: 'rezics-api',
      jwksUrl: process.env.AUTH_JWKS_URL!,
    });

    expect(payload.unitId).toBe('4f1af8b5-6c9f-4c32-8c17-9108fb6af001');
    expect(String(payload.scope)).toContain('user');

    jwksServer.stop(true);
  });
});
