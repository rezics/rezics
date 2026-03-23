import {describe, expect, mock, test} from 'bun:test';
import {Elysia} from 'elysia';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??=
  'postgresql://postgres:postgres@localhost:5432/rezics_book';
process.env.JWT_SECRET ??=
  'server-jwt-secret-for-tests-abcdefghijklmnopqrstuvwxyz';
process.env.REFRESH_TOKEN_SECRET ??=
  'server-refresh-secret-for-tests-abcdefghijklmnopqrstuvwxyz';

const getMainSessionPublicJwks = mock(async () => ({
  keys: [
    {
      kty: 'EC',
      use: 'sig',
      alg: 'ES256',
      kid: 'server-kid',
      crv: 'P-256',
      x: 'x-coordinate',
      y: 'y-coordinate',
    },
  ],
}));

mock.module('@/src/auth/context', () => ({
  identityContextPlugin: new Elysia().derive(() => ({
    identity: {
      unitId: 'user-1',
    },
  })),
}));

mock.module('@/src/user/service/user.service', () => ({
  userService: {
    getByUnitId: async () => ({
      unitId: 'user-1',
      permission: {role: ['USER']},
    }),
  },
}));

mock.module('./jwt/jwt.service', () => ({
  mainSessionJwtPlugin: new Elysia().decorate('jwt', {
    sign: async () => 'signed-token',
  }),
  getMainSessionPublicJwks,
  buildRezicsSessionClaims: () => ({
    unitId: 'user-1',
    permission: {role: 'USER'},
  }),
  REZICS_SESSION_HEADER: 'x-rezics_session_token',
  getMainSessionJwtContext: () => ({}),
}));

describe('session jwks route', () => {
  test('publishes the canonical public jwks document without auth', async () => {
    const {sessionApi} = await import('./session.api');

    const response = await sessionApi.handle(
      new Request('http://localhost/session/jwks'),
    );

    expect(response.status).toBe(200);
    expect(getMainSessionPublicJwks).toHaveBeenCalledTimes(1);
    expect(await response.json()).toEqual({
      keys: [
        {
          kty: 'EC',
          use: 'sig',
          alg: 'ES256',
          kid: 'server-kid',
          crv: 'P-256',
          x: 'x-coordinate',
          y: 'y-coordinate',
        },
      ],
    });
  });

  test('keeps jwks public while session token issuance remains credentialed', async () => {
    const {sessionApi} = await import('./session.api');

    const jwksResponse = await sessionApi.handle(
      new Request('http://localhost/session/jwks', {
        headers: {
          Origin: 'https://rezics.com',
        },
      }),
    );
    const tokenResponse = await sessionApi.handle(
      new Request('http://localhost/session/token', {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://rezics.com',
          'Access-Control-Request-Method': 'POST',
        },
      }),
    );

    expect(jwksResponse.status).toBe(200);
    expect(tokenResponse.status).toBe(204);
    expect(jwksResponse.headers.get('access-control-allow-origin')).toBe(
      'https://rezics.com',
    );
    expect(
      jwksResponse.headers.get('access-control-allow-credentials'),
    ).toBeNull();
    expect(tokenResponse.headers.get('access-control-allow-origin')).toBe(
      'https://rezics.com',
    );
    expect(tokenResponse.headers.get('access-control-allow-credentials')).toBe(
      'true',
    );
  });
});
