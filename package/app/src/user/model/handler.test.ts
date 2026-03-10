import {beforeEach, describe, expect, mock, test} from 'bun:test';

const signOutMock = mock(async () => ({success: true}));
const removeQueriesMock = mock(() => undefined);
const clearAuthMock = mock(() => undefined);
const clearProfileMock = mock(() => undefined);
const clearAuthSessionStateMock = mock(() => undefined);

mock.module('@package/api/auth/auth.api', () => ({
  authApi: {
    signOut: signOutMock,
  },
}));

mock.module('@package/api/auth/auth.keys', () => ({
  authKeys: {
    all: () => ['auth'],
  },
}));

mock.module('@package/api/user/user.keys', () => ({
  userKeys: {
    all: () => ['user'],
  },
}));

mock.module('@package/api/user/user.api', () => ({
  userApi: {
    me: mock(),
  },
}));

mock.module('@/app/provider/reactQueryUtil', () => ({
  qc: {
    removeQueries: removeQueriesMock,
  },
}));

mock.module('@/user/state', () => ({
  clearAuthSessionState: clearAuthSessionStateMock,
  hydrateAuthSessionState: mock(),
  useAuthSessionStore: {
    getState: () => ({hasBusinessToken: false}),
  },
  useAuthStore: {
    getState: () => ({
      clearAuth: clearAuthMock,
      setToken: mock(),
    }),
  },
  useUserProfileStore: {
    getState: () => ({
      clearProfile: clearProfileMock,
      setUser: mock(),
    }),
  },
}));

describe('logout', () => {
  beforeEach(() => {
    signOutMock.mockClear();
    removeQueriesMock.mockClear();
    clearAuthMock.mockClear();
    clearProfileMock.mockClear();
    clearAuthSessionStateMock.mockClear();
  });

  test('clears auth, auth-session, profile, and cached auth queries', async () => {
    const {logout} = await import('./handler');

    await logout(true);

    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(clearAuthMock).toHaveBeenCalledTimes(1);
    expect(clearAuthSessionStateMock).toHaveBeenCalledTimes(1);
    expect(clearProfileMock).toHaveBeenCalledTimes(1);
    expect(removeQueriesMock.mock.calls).toEqual([
      [{queryKey: ['auth']}],
      [{queryKey: ['user']}],
    ]);
  });
});
