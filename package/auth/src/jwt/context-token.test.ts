import {beforeEach, describe, expect, mock, test} from 'bun:test';

process.env.DATABASE_URL ??=
  'postgresql://postgres:postgres@localhost:5432/rezics_auth';
process.env.BETTER_AUTH_URL ??= 'http://localhost:35003';
process.env.BETTER_AUTH_SECRET ??=
  'better-auth-secret-for-tests-abcdefghijklmnopqrstuvwxyz';
process.env.AUTH_INTERNAL_TOKEN_GATEWAY_SECRET ??=
  'internal-auth-gateway-test';

const findFirst = mock();

mock.module('../auth/prisma', () => ({
  prisma: {
    jwks: {
      findFirst,
    },
  },
}));

describe('auth context token signing', () => {
  beforeEach(() => {
    findFirst.mockReset();
  });

  test('builds verified onboarding claims from auth user data', async () => {
    const {generateKeyPairSync} = await import('node:crypto');
    const {privateKey} = generateKeyPairSync('ec', {
      namedCurve: 'P-256',
    });

    findFirst.mockResolvedValue({
      id: 'kid-context',
      alg: 'ES256',
      privateKey: privateKey.export({type: 'pkcs8', format: 'pem'}).toString(),
    });

    const {buildAuthContextClaims, signAuthContextToken} = await import(
      './context-token'
    );

    const claims = buildAuthContextClaims({
      id: 'user-1',
      name: 'Reader',
      emailVerified: false,
      image: 'https://example.com/image.png',
      profile: {
        slug: 'reader',
        avatar: null,
      },
    });

    expect(claims).toMatchObject({
      id: 'user-1',
      slug: 'reader',
      name: 'Reader',
      avatar: 'https://example.com/image.png',
      verificationStatus: 'pending',
    });

    const signed = await signAuthContextToken({
      id: 'user-1',
      name: 'Reader',
      emailVerified: true,
      profile: {
        slug: 'reader',
        avatar: 'https://example.com/avatar.png',
      },
    });

    expect(signed.claims.verificationStatus).toBe('verified');
    expect(signed.claims.avatar).toBe('https://example.com/avatar.png');
    expect(typeof signed.token).toBe('string');
  });
});
