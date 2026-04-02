import {beforeEach, describe, expect, mock, test} from 'bun:test';
import {NormalizedTokenName} from '@package/contract';
import {configureApi} from '@package/api/config';

// Required for @package/app env.ts validation
process.env.VITE_API_URL ??= 'http://api.example';
process.env.VITE_AUTH_API_URL ??= 'http://auth.example';
process.env.VITE_TURNSTILE_SITE_KEY ??= 'turnstile-test-key';

configureApi({
  apiBaseUrl: 'http://api.example',
  authBaseUrl: 'http://auth.example',
});

const fetchMock = mock();
const signInMock = mock(async () => ({
  user: {
    id: 'user-1',
    email: 'reader@example.com',
  },
  session: {
    id: 'session-1',
    token: 'better-auth-session-token',
  },
}));
const signUpMock = mock(async () => ({
  user: {
    id: 'user-1',
    email: 'reader@example.com',
  },
  session: {
    id: 'session-1',
    token: 'better-auth-session-token',
  },
}));
const signOutMock = mock(async () => ({success: true}));
const getContextTokenMock = mock(async () => ({
  token: 'context-token',
  claims: {
    id: 'user-1',
    unitId: 'user-1',
    sub: 'user-1',
    slug: 'reader',
    name: 'Reader',
    avatar: null,
    emailVerified: true,
    verificationStatus: 'verified',
  },
}));
const ensureMock = mock(async () => ({
  user: {unitId: 'user-1', name: 'Reader'},
  alreadyCreated: false,
}));
const issueSessionTokenMock = mock(async () => ({token: 'member-token'}));
const removeQueriesMock = mock(() => undefined);
const clearProfileMock = mock(() => undefined);
const clearAuthSessionStateMock = mock(() => undefined);
const syncBusinessTokenMock = mock(() => undefined);
const setUserMock = mock(() => undefined);
const hydrateAuthSessionStateMock = mock(async () => ({
  session: {id: 'session-1'},
  user: {id: 'user-1'},
  authSession: {
    canAcquireMemberToken: true,
    needsOnboarding: false,
    needsEmailVerification: false,
  },
}));

mock.module('@package/api/auth/auth.api', () => ({
  authApi: {
    signIn: signInMock,
    signUp: signUpMock,
    signOut: signOutMock,
    getContextToken: getContextTokenMock,
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
    ensure: ensureMock,
    issueSessionToken: issueSessionTokenMock,
  },
}));

mock.module('@/app/provider/reactQueryUtil', () => ({
  qc: {
    removeQueries: removeQueriesMock,
  },
}));

mock.module('@/user/state', () => ({
  clearAuthSessionState: clearAuthSessionStateMock,
  hydrateAuthSessionState: hydrateAuthSessionStateMock,
  useAuthSessionStore: {
    getState: () => ({
      hasBusinessToken: false,
      syncBusinessToken: syncBusinessTokenMock,
    }),
  },
  useUserProfileStore: {
    getState: () => ({
      clearProfile: clearProfileMock,
      setUser: setUserMock,
    }),
  },
}));

describe('auth handlers', () => {
  beforeEach(() => {
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    globalThis.window = {
      dispatchEvent: () => true,
      location: {
        reload: () => undefined,
      },
    } as unknown as Window & typeof globalThis;
    globalThis.localStorage = (() => {
      const store = new Map<string, string>();
      return {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value);
        },
        removeItem: (key: string) => {
          store.delete(key);
        },
        clear: () => {
          store.clear();
        },
      };
    })() as Storage;
    globalThis.document = {
      cookie: '',
    } as Document;
    fetchMock.mockClear();
    signInMock.mockClear();
    signUpMock.mockClear();
    signOutMock.mockClear();
    getContextTokenMock.mockClear();
    ensureMock.mockClear();
    issueSessionTokenMock.mockClear();
    hydrateAuthSessionStateMock.mockClear();
    removeQueriesMock.mockClear();
    clearProfileMock.mockClear();
    clearAuthSessionStateMock.mockClear();
    syncBusinessTokenMock.mockClear();
    setUserMock.mockClear();
  });

  test('login acquires auth identity from the token endpoint instead of session.token', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          token:
            'eyJhbGciOiJub25lIn0.eyJzdWIiOiJ1c2VyLTEiLCJleHAiOjQ3NjYwMDAwMDB9.c2ln',
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    const {login} = await import('./handler');
    const {getToken} = await import('@package/api/react-query/jwt');

    const result = await login('reader@example.com', 'secret');

    expect(signInMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://auth.example/api/auth/token');
    expect(result.token).toBe(
      'eyJhbGciOiJub25lIn0.eyJzdWIiOiJ1c2VyLTEiLCJleHAiOjQ3NjYwMDAwMDB9.c2ln',
    );
    expect(getToken(NormalizedTokenName.AUTH_IDENTITY)).toBe(
      'eyJhbGciOiJub25lIn0.eyJzdWIiOiJ1c2VyLTEiLCJleHAiOjQ3NjYwMDAwMDB9.c2ln',
    );
  });

  test('registration acquires auth identity from the token endpoint instead of session.token', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          token:
            'eyJhbGciOiJub25lIn0.eyJzdWIiOiJ1c2VyLTIiLCJleHAiOjQ3NjYwMDAwMDB9.c2ln',
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    const {register} = await import('./handler');
    const {getToken} = await import('@package/api/react-query/jwt');

    const result = await register('reader@example.com', 'secret');

    expect(signUpMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://auth.example/api/auth/token');
    expect(result.token).toBe(
      'eyJhbGciOiJub25lIn0.eyJzdWIiOiJ1c2VyLTIiLCJleHAiOjQ3NjYwMDAwMDB9.c2ln',
    );
    expect(getToken(NormalizedTokenName.AUTH_IDENTITY)).toBe(
      'eyJhbGciOiJub25lIn0.eyJzdWIiOiJ1c2VyLTIiLCJleHAiOjQ3NjYwMDAwMDB9.c2ln',
    );
  });

  test('establishBusinessSession fetches context, ensures user, and issues session token', async () => {
    const {establishBusinessSession} = await import('./handler');
    const {getToken, setToken} = await import('@package/api/react-query/jwt');

    setToken(
      'eyJhbGciOiJub25lIn0.eyJzdWIiOiJ1c2VyLTEiLCJleHAiOjQ3NjYwMDAwMDB9.c2ln',
      NormalizedTokenName.AUTH_IDENTITY,
    );

    await establishBusinessSession();

    expect(getContextTokenMock).toHaveBeenCalledTimes(1);
    expect(ensureMock).toHaveBeenCalledTimes(1);
    expect(ensureMock).toHaveBeenCalledWith('context-token');
    expect(issueSessionTokenMock).toHaveBeenCalledTimes(1);
    expect(getToken(NormalizedTokenName.REZICS_SESSION)).toBe('member-token');
    expect(syncBusinessTokenMock).toHaveBeenCalledWith('member-token');
    expect(setUserMock).toHaveBeenCalledWith({
      unitId: 'user-1',
      name: 'Reader',
    });
  });

  test('AUTH_CONTEXT is not persisted after establishBusinessSession', async () => {
    const {establishBusinessSession} = await import('./handler');
    const {getToken, setToken} = await import('@package/api/react-query/jwt');

    setToken(
      'eyJhbGciOiJub25lIn0.eyJzdWIiOiJ1c2VyLTEiLCJleHAiOjQ3NjYwMDAwMDB9.c2ln',
      NormalizedTokenName.AUTH_IDENTITY,
    );

    await establishBusinessSession();

    // AUTH_CONTEXT should not be in localStorage (no storage key configured)
    expect(getToken(NormalizedTokenName.AUTH_CONTEXT)).toBeNull();
  });

  test('clears auth-session, profile, and cached auth queries on logout', async () => {
    const {logout} = await import('./handler');
    const {getToken, setToken} = await import('@package/api/react-query/jwt');

    setToken('identity-token', NormalizedTokenName.AUTH_IDENTITY);
    setToken('member-token', NormalizedTokenName.REZICS_SESSION);

    await logout(true);

    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(getToken(NormalizedTokenName.AUTH_IDENTITY)).toBeNull();
    expect(getToken(NormalizedTokenName.REZICS_SESSION)).toBeNull();
    expect(syncBusinessTokenMock).toHaveBeenCalledWith(null);
    expect(clearAuthSessionStateMock).toHaveBeenCalledTimes(1);
    expect(clearProfileMock).toHaveBeenCalledTimes(1);
    expect(removeQueriesMock).toHaveBeenCalledTimes(2);
    const calls = removeQueriesMock.mock.calls as unknown as Array<
      [{queryKey: string[]}]
    >;
    expect(calls[0]?.[0]).toEqual({queryKey: ['auth']});
    expect(calls[1]?.[0]).toEqual({queryKey: ['user']});
  });
});
