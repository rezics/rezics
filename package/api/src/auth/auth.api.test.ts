import {beforeEach, describe, expect, mock, test} from 'bun:test';
import {NormalizedTokenName} from '@package/contract';

const fetchMock = mock();
const identityToken =
  'eyJhbGciOiJub25lIn0.eyJzdWIiOiJ1c2VyLTEiLCJleHAiOjQ3NjYwMDAwMDB9.c2ln';

type MemoryStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
};

function createMemoryStorage(): MemoryStorage {
  const store = new Map<string, string>();

  return {
    getItem(key) {
      return store.get(key) ?? null;
    },
    setItem(key, value) {
      store.set(key, value);
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

process.env.VITE_API_URL ??= 'http://api.example';
process.env.VITE_AUTH_API_URL ??= 'http://auth.example';
process.env.VITE_TURNSTILE_SITE_KEY ??= 'turnstile-test-key';

describe('authApi', () => {
  beforeEach(() => {
    fetchMock.mockClear();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    globalThis.window = {
      dispatchEvent: () => true,
    } as unknown as Window & typeof globalThis;
    globalThis.localStorage = createMemoryStorage() as Storage;
  });

  test('reads browser session tokens from the auth service', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({token: 'jwt-token'}), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    );

    const {authApi} = await import('./auth.api');
    const response = await authApi.getToken();

    expect(response).toEqual({token: 'jwt-token'});

    const [url, options] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://auth.example/api/auth/token');
    expect(options).toMatchObject({
      credentials: 'include',
    });
  });

  test('reads auth context tokens from the auth service', async () => {
    const {setToken} = await import('../react-query/jwt');
    setToken(identityToken, NormalizedTokenName.AUTH_IDENTITY);

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          token: 'context-token',
          claims: {
            id: 'user-1',
            sub: 'user-1',
            unitId: 'user-1',
            slug: 'reader',
            name: 'Reader',
            avatar: null,
            emailVerified: false,
            verificationStatus: 'pending',
          },
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    const {authApi} = await import('./auth.api');
    const response = await authApi.getContextToken();

    expect(response.token).toBe('context-token');
    expect(response.claims.slug).toBe('reader');

    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://auth.example/api/auth/context-token');
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      headers: {
        Authorization: `Bearer ${identityToken}`,
      },
    });
  });

  test('reads normalized auth session state from the auth service', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          session: {
            id: 'session-1',
            token: 'session-token',
            expiresAt: '2026-03-10T00:00:00.000Z',
            userId: 'user-1',
          },
          user: {
            id: 'user-1',
            name: 'Reader',
            role: 'user',
            email: 'reader@example.com',
            emailVerified: false,
            createdAt: '2026-03-10T00:00:00.000Z',
            updatedAt: '2026-03-10T00:00:00.000Z',
          },
          authSession: {
            email: 'reader@example.com',
            emailVerified: false,
            needsEmailVerification: true,
            needsOnboarding: true,
            canAcquireMemberToken: false,
            readinessStatus: 'needs-onboarding',
            hasPassword: false,
            canSetPassword: true,
            providerIds: ['google'],
          },
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    const {authApi} = await import('./auth.api');
    const response = await authApi.getSessionState();

    expect(response.authSession.needsEmailVerification).toBe(true);

    const [url, options] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://auth.example/api/auth/get-session-state');
    expect(options).toMatchObject({
      credentials: 'include',
    });
  });

  test('posts social sign-in initiation to the auth service', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({url: 'http://oauth.example', redirect: false}), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    );

    const {authApi} = await import('./auth.api');

    const response = await authApi.signInSocial({
      provider: 'google',
      disableRedirect: true,
    });

    expect(response).toEqual({
      url: 'http://oauth.example',
      redirect: false,
    });

    const [url, options] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://auth.example/api/auth/sign-in/social');
    expect(options).toMatchObject({
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({
        provider: 'google',
        disableRedirect: true,
      }),
    });
  });

  test('posts verification and profile completion actions to the auth service', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({status: true}), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({status: true}), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({status: true}), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }),
      );

    const {authApi} = await import('./auth.api');

    await authApi.sendVerificationEmail({
      email: 'reader@example.com',
    });
    await authApi.changeEmail({
      newEmail: 'reader+new@example.com',
    });
    await authApi.setPassword({
      newPassword: 'new-password',
    });

    expect(fetchMock.mock.calls[0]![0]).toBe(
      'http://auth.example/api/auth/send-verification-email',
    );
    expect(fetchMock.mock.calls[1]![0]).toBe(
      'http://auth.example/api/auth/change-email',
    );
    expect(fetchMock.mock.calls[2]![0]).toBe(
      'http://auth.example/api/auth/set-password',
    );
  });

  test('posts password reset requests to the auth service', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({status: true, message: 'queued'}), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    );

    const {authApi} = await import('./auth.api');

    const response = await authApi.requestPasswordReset({
      email: 'reader@example.com',
      redirectTo: 'http://localhost:3000/reset-password',
    });

    expect(response).toEqual({
      status: true,
      message: 'queued',
    });

    const [url, options] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://auth.example/api/auth/request-password-reset');
    expect(options).toMatchObject({
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({
        email: 'reader@example.com',
        redirectTo: 'http://localhost:3000/reset-password',
      }),
    });
  });

  test('posts password reset completion to the auth service', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({status: true}), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    );

    const {authApi} = await import('./auth.api');

    const response = await authApi.resetPassword({
      token: 'reset-token',
      newPassword: 'new-password',
    });

    expect(response).toEqual({status: true});

    const [url, options] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://auth.example/api/auth/reset-password');
    expect(options).toMatchObject({
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({
        token: 'reset-token',
        newPassword: 'new-password',
      }),
    });
  });
});
