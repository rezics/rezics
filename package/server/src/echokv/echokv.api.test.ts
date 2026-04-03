import {describe, expect, mock, test} from 'bun:test';
import {Elysia} from 'elysia';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??=
  'postgresql://postgres:postgres@localhost:5432/rezics_book';
process.env.AUTH_BASE_URL ??= 'http://localhost:3001';

mock.module('@/middleware/permission', () => ({
  authMacro: new Elysia({name: 'macro/auth'})
    .macro('requireLogin', {resolve: () => ({identity: {unitId: 'test'}})})
    .macro('requireOwner', {requireLogin: true, resolve: () => ({session: {}, currentUser: {}})})
    .macro('requireAdmin', {requireOwner: true}),
  buildActorFromContext: () => ({}),
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
