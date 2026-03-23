import {describe, expect, test} from 'bun:test';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??=
  'postgresql://postgres:postgres@localhost:5432/rezics_book';
process.env.JWT_SECRET ??=
  'server-jwt-secret-for-tests-abcdefghijklmnopqrstuvwxyz';
process.env.REFRESH_TOKEN_SECRET ??=
  'server-refresh-secret-for-tests-abcdefghijklmnopqrstuvwxyz';

describe('server auth verifier options', () => {
  test('maps trusted auth jwt metadata into verifier options', async () => {
    const {buildTrustedAuthVerifyOptions} = await import('./index');
    const options = buildTrustedAuthVerifyOptions({
      issuer: 'http://localhost:35003',
      audience: 'rezics-api',
      jwksUrl: 'http://localhost:35003/api/auth/session/jwks',
    });

    expect(options).toMatchObject({
      issuer: 'http://localhost:35003',
      audience: 'rezics-api',
      jwksUrl: 'http://localhost:35003/api/auth/session/jwks',
      algorithm: 'ES256',
      requiredScope: 'user',
      tokenName: 'auth-identity-token',
      enforceTransport: true,
    });
    expect(typeof options.clockToleranceSeconds).toBe('number');
  });
});
