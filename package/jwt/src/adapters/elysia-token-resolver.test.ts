import {describe, test, expect} from 'bun:test';
import {Elysia} from 'elysia';
import {createTokenResolver} from './elysia-token-resolver';
import type {VerifiedJwt} from '../core/verification';

function mockVerifier<T>(payload: T) {
  return async (token: string | undefined) => {
    if (!token) throw new Error('Missing token');
    return {
      token: token!,
      payload: payload as any,
      protectedHeader: {alg: 'ES256'},
    } as VerifiedJwt<any>;
  };
}

function failingVerifier() {
  return async () => {
    throw new Error('Verification failed');
  };
}

describe('createTokenResolver', () => {
  test('absent header returns null', async () => {
    const app = new Elysia()
      .use(
        createTokenResolver('authIdentityToken', {
          headerName: 'Authorization',
          usesBearer: true,
          verifier: mockVerifier({sub: 'user-1'}),
        }),
      )
      .get('/', ({authIdentityToken}) => ({token: authIdentityToken}));

    const res = await app.handle(new Request('http://localhost/'));
    const body = await res.json();
    expect(body.token).toBeNull();
  });

  test('valid bearer token returns payload', async () => {
    const payload = {sub: 'user-1', unitId: 'u1'};
    const app = new Elysia()
      .use(
        createTokenResolver('authIdentityToken', {
          headerName: 'Authorization',
          usesBearer: true,
          verifier: mockVerifier(payload),
        }),
      )
      .get('/', ({authIdentityToken}) => ({token: authIdentityToken}));

    const res = await app.handle(
      new Request('http://localhost/', {
        headers: {Authorization: 'Bearer test-jwt'},
      }),
    );
    const body = await res.json();
    expect(body.token).toEqual(payload);
  });

  test('invalid token resolves to null', async () => {
    const app = new Elysia()
      .use(
        createTokenResolver('authIdentityToken', {
          headerName: 'Authorization',
          usesBearer: true,
          verifier: failingVerifier() as any,
        }),
      )
      .get('/', ({authIdentityToken}) => ({token: authIdentityToken}));

    const res = await app.handle(
      new Request('http://localhost/', {
        headers: {Authorization: 'Bearer bad-token'},
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token).toBeNull();
  });

  test('passes raw header value to verifier (bearer extraction is verifier responsibility)', async () => {
    let receivedToken = '';
    const verifier = async (token: string | undefined) => {
      receivedToken = token!;
      return {
        token: token!,
        payload: {sub: 'user-1'} as any,
        protectedHeader: {alg: 'ES256'},
      } as VerifiedJwt<any>;
    };

    const app = new Elysia()
      .use(
        createTokenResolver('authIdentityToken', {
          headerName: 'Authorization',
          usesBearer: true,
          verifier,
        }),
      )
      .get('/', ({authIdentityToken}) => ({token: authIdentityToken}));

    await app.handle(
      new Request('http://localhost/', {
        headers: {Authorization: 'Bearer my-jwt-token'},
      }),
    );
    expect(receivedToken).toBe('Bearer my-jwt-token');
  });

  test('non-bearer passes raw value to verifier', async () => {
    let receivedToken = '';
    const verifier = async (token: string | undefined) => {
      receivedToken = token!;
      return {
        token: token!,
        payload: {unitId: 'u1'} as any,
        protectedHeader: {alg: 'ES256'},
      } as VerifiedJwt<any>;
    };

    const app = new Elysia()
      .use(
        createTokenResolver('rezicsSessionToken', {
          headerName: 'x-rezics-session-token',
          usesBearer: false,
          verifier,
        }),
      )
      .get('/', ({rezicsSessionToken}) => ({token: rezicsSessionToken}));

    await app.handle(
      new Request('http://localhost/', {
        headers: {'x-rezics-session-token': 'raw-jwt'},
      }),
    );
    expect(receivedToken).toBe('raw-jwt');
  });

  test('multiple resolvers compose independently', async () => {
    const app = new Elysia()
      .use(
        createTokenResolver('authIdentityToken', {
          headerName: 'Authorization',
          usesBearer: true,
          verifier: mockVerifier({sub: 'user-1'}),
        }),
      )
      .use(
        createTokenResolver('rezicsSessionToken', {
          headerName: 'x-rezics-session-token',
          usesBearer: false,
          verifier: mockVerifier({unitId: 'u1', permission: {role: 'USER'}}),
        }),
      )
      .get('/', ({authIdentityToken, rezicsSessionToken}) => ({
        identity: authIdentityToken,
        session: rezicsSessionToken,
      }));

    const res = await app.handle(
      new Request('http://localhost/', {
        headers: {
          Authorization: 'Bearer identity-jwt',
          'x-rezics-session-token': 'session-jwt',
        },
      }),
    );
    const body = await res.json();
    expect(body.identity).toEqual({sub: 'user-1'});
    expect(body.session).toEqual({unitId: 'u1', permission: {role: 'USER'}});
  });

  test('duplicate registration runs resolver only once', async () => {
    let callCount = 0;
    const countingVerifier = async (token: string | undefined) => {
      callCount++;
      return {
        token: token!,
        payload: {sub: 'user-1'} as any,
        protectedHeader: {alg: 'ES256'},
      } as VerifiedJwt<any>;
    };

    const resolver = createTokenResolver('authIdentityToken', {
      headerName: 'Authorization',
      usesBearer: true,
      verifier: countingVerifier,
    });

    const app = new Elysia()
      .use(resolver)
      .use(resolver)
      .get('/', ({authIdentityToken}) => ({token: authIdentityToken}));

    await app.handle(
      new Request('http://localhost/', {
        headers: {Authorization: 'Bearer test-jwt'},
      }),
    );
    expect(callCount).toBe(1);
  });
});
