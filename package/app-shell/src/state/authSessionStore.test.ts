import {beforeEach, describe, expect, mock, test} from 'bun:test';
import type {AuthContextTokenClaims, GetSessionStateResponse} from '@package/contract';
import {NormalizedTokenName} from '@package/contract';

const tokenState: Partial<Record<NormalizedTokenName, string | null>> = {};
let authContextClaims: AuthContextTokenClaims | null = null;
let presence = false;
const getSessionStateMock = mock();

mock.module('@package/api/react-query/jwt', () => ({
  getToken: (tokenName?: NormalizedTokenName) =>
    tokenName ? tokenState[tokenName] ?? null : null,
  getAuthContextClaims: () => authContextClaims,
}));

mock.module('@package/api/react-query/authPresence', () => ({
  hasAuthPresence: () => presence,
  clearAuthPresence: () => {
    presence = false;
  },
}));

mock.module('@package/api/auth/auth.api', () => ({
  authApi: {
    getSessionState: getSessionStateMock,
  },
}));

const readySession: GetSessionStateResponse = {
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
    primaryProviderId: 'google',
    trustedProviderId: 'google',
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

const verifiedAuthContext: AuthContextTokenClaims = {
  id: 'user-1',
  unitId: 'user-1',
  sub: 'user-1',
  slug: 'reader',
  name: 'Reader',
  avatar: null,
  emailVerified: true,
  verificationStatus: 'verified',
};

const pendingAuthContext: AuthContextTokenClaims = {
  ...verifiedAuthContext,
  emailVerified: false,
  verificationStatus: 'pending',
};

describe('authSessionStore', () => {
  beforeEach(async () => {
    tokenState[NormalizedTokenName.AUTH_CONTEXT] = null;
    tokenState[NormalizedTokenName.REZICS_SESSION] = null;
    presence = false;
    authContextClaims = null;
    getSessionStateMock.mockReset();
    const {clearAuthSessionState, useAuthSessionStore} = await import(
      './authSessionStore'
    );
    clearAuthSessionState();
    useAuthSessionStore.getState().syncAuthContext(null);
    useAuthSessionStore.getState().syncBusinessToken(null);
  });

  test('hydrates member-ready state on reload when a business token already exists', async () => {
    tokenState[NormalizedTokenName.AUTH_CONTEXT] = 'context-token';
    tokenState[NormalizedTokenName.REZICS_SESSION] = 'member-token';
    authContextClaims = verifiedAuthContext;
    presence = true;
    getSessionStateMock.mockResolvedValueOnce(readySession);

    const {hydrateAuthSessionState, useAuthSessionStore} = await import(
      './authSessionStore'
    );

    await hydrateAuthSessionState();

    expect(useAuthSessionStore.getState()).toMatchObject({
      status: 'ready',
      hasAuthContext: true,
      hasAuthSession: true,
      hasBusinessToken: true,
      capabilityLevel: 'member',
      needsVerification: false,
      needsOnboarding: false,
    });
  });

  test('keeps auth-context verification flags intact across token syncs', async () => {
    const {useAuthSessionStore} = await import('./authSessionStore');

    useAuthSessionStore.getState().setSessionState(guestSession);
    authContextClaims = pendingAuthContext;
    tokenState[NormalizedTokenName.AUTH_CONTEXT] = 'context-token';
    useAuthSessionStore.getState().syncAuthContext('context-token');
    tokenState[NormalizedTokenName.REZICS_SESSION] = 'refreshed-token';
    useAuthSessionStore.getState().syncBusinessToken('refreshed-token');

    expect(useAuthSessionStore.getState()).toMatchObject({
      authContext: pendingAuthContext,
      hasBusinessToken: true,
      needsVerification: true,
      capabilityLevel: 'member',
    });
  });

  test('hydrates authenticated but unverified sessions as guest-capable', async () => {
    tokenState[NormalizedTokenName.AUTH_CONTEXT] = 'context-token';
    authContextClaims = pendingAuthContext;
    presence = true;
    getSessionStateMock.mockResolvedValueOnce(guestSession);

    const {hydrateAuthSessionState, useAuthSessionStore} = await import(
      './authSessionStore'
    );

    await hydrateAuthSessionState();

    expect(useAuthSessionStore.getState()).toMatchObject({
      status: 'ready',
      hasAuthContext: true,
      hasAuthSession: true,
      hasBusinessToken: false,
      capabilityLevel: 'guest',
      needsVerification: true,
    });
  });

  test('skips passive hydration when no token and no auth presence exist', async () => {
    const {hydrateAuthSessionState, useAuthSessionStore} = await import(
      './authSessionStore'
    );

    const result = await hydrateAuthSessionState();

    expect(result).toBeNull();
    expect(getSessionStateMock).not.toHaveBeenCalled();
    expect(useAuthSessionStore.getState()).toMatchObject({
      status: 'ready',
      capabilityLevel: 'anonymous',
      hasAuthSession: false,
    });
  });

  test('fails closed and clears presence on stale passive auth presence', async () => {
    presence = true;
    getSessionStateMock.mockRejectedValueOnce(new Error('Unauthorized'));

    const {hydrateAuthSessionState, useAuthSessionStore} = await import(
      './authSessionStore'
    );

    await hydrateAuthSessionState();

    expect(presence).toBe(false);
    expect(useAuthSessionStore.getState()).toMatchObject({
      status: 'error',
      hasAuthSession: false,
      capabilityLevel: 'anonymous',
    });
  });
});
