import {describe, expect, test} from 'bun:test';

process.env.NODE_ENV ??= 'test';
process.env.PORT ??= '35003';
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@localhost:5432/rezics_auth';
process.env.BETTER_AUTH_URL ??= 'http://localhost:35003';
process.env.BETTER_AUTH_SECRET ??= 'this-is-a-long-auth-secret-for-tests-123456';
process.env.AUTH_INTERNAL_TOKEN_GATEWAY_SECRET ??= 'internal-test-secret';
process.env.AUTH_JWT_AUDIENCE ??= 'rezics-api';
process.env.AUTH_JWT_ISSUER ??= 'http://localhost:35003';
process.env.SMTP_HOST ??= 'smtp.example.com';
process.env.SMTP_USER ??= 'smtp-user';
process.env.SMTP_PASSWORD ??= 'smtp-password';
process.env.SMTP_USER_NAME ??= 'Rezics Auth';
process.env.AUTH_INVITATION_FROM_EMAIL ??= 'invite@example.com';
process.env.AUTH_PASSWORD_RESET_FROM_EMAIL ??= 'reset@example.com';
process.env.AUTH_VERIFICATION_FROM_EMAIL ??= 'verify@example.com';
process.env.GOOGLE_CLIENT_ID ??= 'google-client';
process.env.GOOGLE_CLIENT_SECRET ??= 'google-secret';
process.env.MICROSOFT_CLIENT_ID ??= 'microsoft-client';
process.env.MICROSOFT_CLIENT_SECRET ??= 'microsoft-secret';
process.env.GITHUB_CLIENT_ID ??= 'github-client';
process.env.GITHUB_CLIENT_SECRET ??= 'github-secret';
process.env.TWITTER_CLIENT_ID ??= 'twitter-client';
process.env.TWITTER_CLIENT_SECRET ??= 'twitter-secret';
process.env.TELEGRAM_CLIENT_ID ??= 'telegram-client';
process.env.TELEGRAM_CLIENT_SECRET ??= 'telegram-secret';

describe('Auth discovery routes', () => {
  test('serves openid and oauth metadata', async () => {
    const {
      handleOpenIdConfigRequest,
      handleOAuthAuthorizationServerRequest,
    } = await import('./routes');

    const openIdResponse = await handleOpenIdConfigRequest(
      new Request('http://localhost:35003/.well-known/openid-configuration'),
    );

    expect(openIdResponse.status).toBe(200);

    const openIdJson = await openIdResponse.json();
    expect(openIdJson.issuer).toBe('http://localhost:35003');
    expect(openIdJson.userinfo_endpoint).toBeDefined();
    expect(openIdJson.id_token_signing_alg_values_supported).toContain('ES256');

    const oauthResponse = await handleOAuthAuthorizationServerRequest(
      new Request('http://localhost:35003/.well-known/oauth-authorization-server'),
    );

    expect(oauthResponse.status).toBe(200);

    const oauthJson = await oauthResponse.json();
    expect(oauthJson.issuer).toBe('http://localhost:35003');
    expect(oauthJson.authorization_endpoint).toBeDefined();
    expect(oauthJson.token_endpoint).toBeDefined();
  });

  test('configures required external providers', async () => {
    const {auth} = await import('./instance');
    const options = (auth as any).options;

    const providers = options?.socialProviders;
    const pluginIds = options?.plugins?.map((plugin: {id: string}) => plugin.id);

    expect(providers.google).toBeDefined();
    expect(providers.microsoft).toBeDefined();
    expect(providers.github).toBeDefined();
    expect(providers.twitter).toBeDefined();
    expect(pluginIds).toContain('generic-oauth');
  });

  test('configures notification-backed auth email handlers', async () => {
    const {auth} = await import('./instance');
    const options = (auth as any).options;

    expect(options.emailAndPassword.sendResetPassword).toBeDefined();
    expect(options.emailVerification.sendVerificationEmail).toBeDefined();
    expect(options.user.changeEmail.sendChangeEmailConfirmation).toBeDefined();
  });
});
