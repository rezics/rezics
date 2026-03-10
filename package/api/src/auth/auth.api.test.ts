import {beforeEach, describe, expect, mock, test} from 'bun:test';

const fetchMock = mock();

mock.module('@package/app/env', () => ({
  env: {
    VITE_API_URL: 'http://api.example',
    VITE_AUTH_API_URL: 'http://auth.example',
  },
}));

describe('authApi', () => {
  beforeEach(() => {
    fetchMock.mockClear();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
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
