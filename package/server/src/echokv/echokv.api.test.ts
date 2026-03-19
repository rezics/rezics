import {describe, expect, mock, test} from 'bun:test';
import {Elysia} from 'elysia';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??=
  'postgresql://postgres:postgres@localhost:5432/rezics_book';
process.env.JWT_SECRET ??=
  'server-jwt-secret-for-tests-abcdefghijklmnopqrstuvwxyz';
process.env.REFRESH_TOKEN_SECRET ??=
  'server-refresh-secret-for-tests-abcdefghijklmnopqrstuvwxyz';

mock.module('@/src/auth/context', () => ({
  identityContextPlugin: new Elysia(),
  sessionContextPlugin: new Elysia(),
}));

mock.module('./echokv.service', () => ({
  echoKvService: {
    listKeys: async () => ['alpha', 'beta'],
    get: async () => ({value: 'ok'}),
    set: async () => ({value: 'ok'}),
  },
}));

describe('echokv router cors', () => {
  test('keeps non-session feature routes on credentialed cors', async () => {
    const {echoKvApi} = await import('./echokv.api');

    const response = await echoKvApi.handle(
      new Request('http://localhost/echokv', {
        headers: {
          Origin: 'https://rezics.com',
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe(
      'https://rezics.com',
    );
    expect(response.headers.get('access-control-allow-credentials')).toBe(
      'true',
    );
    expect(await response.json()).toEqual({
      keys: ['alpha', 'beta'],
    });
  });
});
