import {beforeEach, describe, expect, mock, test} from 'bun:test';

let currentToken: string | null = null;
const getSessionStateMock = mock();

mock.module('@package/api/react-query/jwt', () => ({
  getToken: () => currentToken,
}));

mock.module('@package/api/auth/auth.api', () => ({
  authApi: {
    getSessionState: getSessionStateMock,
  },
}));

const readySession = {
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
    emailVerified: true,
    createdAt: '2026-03-10T00:00:00.000Z',
    updatedAt: '2026-03-10T00:00:00.000Z',
  },
  authSession: {
    email: 'reader@example.com',
    emailVerified: true,
    needsEmailVerification: false,
    needsOnboarding: false,
    canAcquireMemberToken: true,
    readinessStatus: 'ready' as const,
    hasPassword: true,
    canSetPassword: false,
    providerIds: ['google'],
    primaryProviderId: 'google' as const,
    trustedProviderId: 'google' as const,
  },
};

const guestSession = {
  ...readySession,
  authSession: {
    ...readySession.authSession,
    emailVerified: false,
    needsEmailVerification: true,
    canAcquireMemberToken: false,
    readinessStatus: 'needs-verification' as const,
    trustedProviderId: undefined,
  },
};

describe('authSessionStore', () => {
  beforeEach(async () => {
    currentToken = null;
    getSessionStateMock.mockReset();
    const {clearAuthSessionState, useAuthSessionStore} = await import(
      './authSessionStore'
    );
    clearAuthSessionState();
    useAuthSessionStore.getState().syncBusinessToken(null);
  });

  test('hydrates member-ready state on reload when a business token already exists', async () => {
    currentToken = 'member-token';
    getSessionStateMock.mockResolvedValueOnce(readySession);

    const {hydrateAuthSessionState, useAuthSessionStore} = await import(
      './authSessionStore'
    );

    await hydrateAuthSessionState();

    expect(useAuthSessionStore.getState()).toMatchObject({
      status: 'ready',
      hasAuthSession: true,
      hasBusinessToken: true,
      capabilityLevel: 'member',
      needsVerification: false,
      needsOnboarding: false,
    });
  });

  test('keeps auth-session lifecycle flags intact across token syncs', async () => {
    const {useAuthSessionStore} = await import('./authSessionStore');

    useAuthSessionStore.getState().setSessionState(guestSession);
    currentToken = 'refreshed-token';
    useAuthSessionStore.getState().syncBusinessToken(currentToken);

    expect(useAuthSessionStore.getState()).toMatchObject({
      hasBusinessToken: true,
      needsVerification: true,
      capabilityLevel: 'member',
    });
  });

  test('hydrates authenticated but unverified sessions as guest-capable', async () => {
    currentToken = null;
    getSessionStateMock.mockResolvedValueOnce(guestSession);

    const {hydrateAuthSessionState, useAuthSessionStore} = await import(
      './authSessionStore'
    );

    await hydrateAuthSessionState();

    expect(useAuthSessionStore.getState()).toMatchObject({
      status: 'ready',
      hasAuthSession: true,
      hasBusinessToken: false,
      capabilityLevel: 'guest',
      needsVerification: true,
    });
  });
});
