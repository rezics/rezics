import {beforeEach, describe, expect, mock, test} from 'bun:test';

process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??=
  'postgresql://postgres:postgres@localhost:5432/rezics_auth';
process.env.BETTER_AUTH_URL ??= 'http://localhost:35003';
process.env.BETTER_AUTH_SECRET ??=
  'this-is-a-long-auth-secret-for-tests-123456';
process.env.AUTH_INTERNAL_TOKEN_GATEWAY_SECRET ??= 'internal-test-secret';
process.env.AUTH_TRUSTED_ORIGINS ??= 'http://localhost:3000';
process.env.AUTH_JWT_AUDIENCE ??= 'rezics-api';
process.env.AUTH_JWT_ISSUER ??= 'http://localhost:35003';

const handleAuthRequest = mock((request: Request) => {
  const url = new URL(request.url);

  return Response.json({
    method: request.method,
    pathname: url.pathname,
    search: url.search,
  });
});

mock.module('../auth/routes', () => ({
  handleAuthRequest,
}));

describe('auth openapi routes', () => {
  beforeEach(() => {
    handleAuthRequest.mockClear();
  });

  test('exposes the browser session token endpoint', async () => {
    const {sessionRouter} = await import('./session');

    const response = await sessionRouter.handle(
      new Request('http://localhost/token'),
    );

    expect(response.status).toBe(200);
    expect(handleAuthRequest).toHaveBeenCalledTimes(1);
    expect(await response.json()).toEqual({
      method: 'GET',
      pathname: '/token',
      search: '',
    });
  });

  test('exposes password reset request and completion endpoints', async () => {
    const {passwordRouter} = await import('./password');

    const requestResetResponse = await passwordRouter.handle(
      new Request('http://localhost/request-password-reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'reader@example.com',
          redirectTo: 'http://localhost:3000/reset-password',
        }),
      }),
    );

    const callbackResponse = await passwordRouter.handle(
      new Request(
        'http://localhost/reset-password/reset-token?callbackURL=http://localhost:3000/reset-password',
      ),
    );

    const resetPasswordResponse = await passwordRouter.handle(
      new Request('http://localhost/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: 'reset-token',
          newPassword: 'new-password',
        }),
      }),
    );

    expect(handleAuthRequest).toHaveBeenCalledTimes(3);
    expect(await requestResetResponse.json()).toEqual({
      method: 'POST',
      pathname: '/request-password-reset',
      search: '',
    });
    expect(await callbackResponse.json()).toEqual({
      method: 'GET',
      pathname: '/reset-password/reset-token',
      search:
        '?callbackURL=http://localhost:3000/reset-password',
    });
    expect(await resetPasswordResponse.json()).toEqual({
      method: 'POST',
      pathname: '/reset-password',
      search: '',
    });
  });

  test('forwards sign-up requests without openapi runtime body validation', async () => {
    const {signInRouter} = await import('./sign-in');

    const response = await signInRouter.handle(
      new Request('http://localhost/sign-up/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'reader@example.com',
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(handleAuthRequest).toHaveBeenCalledTimes(1);
    expect(await response.json()).toEqual({
      method: 'POST',
      pathname: '/sign-up/email',
      search: '',
    });
  });

  test('forwards oauth authorize requests without openapi runtime query validation', async () => {
    const {oauthRouter} = await import('./oauth');

    const response = await oauthRouter.handle(
      new Request('http://localhost/oauth/authorize'),
    );

    expect(response.status).toBe(200);
    expect(handleAuthRequest).toHaveBeenCalledTimes(1);
    expect(await response.json()).toEqual({
      method: 'GET',
      pathname: '/oauth/authorize',
      search: '',
    });
  });

  test('forwards reset-password callback requests without openapi runtime query validation', async () => {
    const {passwordRouter} = await import('./password');

    const response = await passwordRouter.handle(
      new Request('http://localhost/reset-password/reset-token'),
    );

    expect(response.status).toBe(200);
    expect(handleAuthRequest).toHaveBeenCalledTimes(1);
    expect(await response.json()).toEqual({
      method: 'GET',
      pathname: '/reset-password/reset-token',
      search: '',
    });
  });
});
