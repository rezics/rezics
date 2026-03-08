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
