import { beforeEach, describe, expect, mock, test } from "bun:test";
import { configureApi } from "@rezics/api/config";

// Required for @rezics/app env.ts validation
process.env.VITE_API_URL ??= "http://api.example";
process.env.VITE_TURNSTILE_SITE_KEY ??= "turnstile-test-key";

configureApi({
  apiBaseUrl: "http://api.example",
  authBaseUrl: "http://api.example",
});

const fetchMock = mock();
const signInMock = mock(async () => ({
  user: {
    id: "user-1",
    email: "reader@example.com",
  },
  session: {
    id: "session-1",
    token: "better-auth-session-token",
  },
}));
const signUpMock = mock(async () => ({
  user: {
    id: "user-1",
    email: "reader@example.com",
  },
  session: {
    id: "session-1",
    token: "better-auth-session-token",
  },
}));
const signOutMock = mock(async () => ({ success: true }));
const getContextTokenMock = mock(async () => ({
  token: "context-token",
  claims: {
    id: "user-1",
    unitId: "user-1",
    sub: "user-1",
    slug: "reader",
    name: "Reader",
    avatar: null,
    emailVerified: true,
    verificationStatus: "verified",
  },
}));
const ensureMock = mock(async () => ({
  user: { unitId: "user-1", name: "Reader" },
  alreadyCreated: false,
}));
const issueSessionTokenMock = mock(async () => ({ token: "member-token" }));
const removeQueriesMock = mock(() => undefined);
const clearProfileMock = mock(() => undefined);
const clearAuthSessionStateMock = mock(() => undefined);
const syncBusinessTokenMock = mock(() => undefined);
const resetAuthSessionStoreMock = mock(() => undefined);
const setUserMock = mock(() => undefined);
const hydrateAuthSessionStateMock = mock(async () => ({
  session: { id: "session-1" },
  user: { id: "user-1" },
  authSession: {
    canAcquireMemberToken: true,
    mainUserExists: true,
    registrationComplete: true,
  },
}));

mock.module("@rezics/api/auth/auth.api", () => ({
  authApi: {
    signIn: signInMock,
    signUp: signUpMock,
    signOut: signOutMock,
    getContextToken: getContextTokenMock,
  },
}));

mock.module("@rezics/api/auth/auth.keys", () => ({
  authKeys: {
    all: () => ["auth"],
  },
}));

mock.module("@rezics/api/user/user.keys", () => ({
  userKeys: {
    all: () => ["user"],
  },
}));

mock.module("@rezics/api/user/user.api", () => ({
  userApi: {
    me: mock(),
    ensure: ensureMock,
    issueSessionToken: issueSessionTokenMock,
  },
}));

mock.module("@/app/providers/reactQueryUtil", () => ({
  qc: {
    removeQueries: removeQueriesMock,
  },
}));

mock.module("@/user/states", () => ({
  clearAuthSessionState: clearAuthSessionStateMock,
  hydrateAuthSessionState: hydrateAuthSessionStateMock,
  useAuthSessionStore: {
    getState: () => ({
      hasBusinessToken: false,
      reset: resetAuthSessionStoreMock,
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

describe("auth handlers", () => {
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
      cookie: "",
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
    resetAuthSessionStoreMock.mockClear();
    setUserMock.mockClear();
  });

  test("login refreshes the main cookie-backed session through main", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));

    const { login } = await import("./handler");

    const result = await login("reader@example.com", "secret");

    expect(signInMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://api.example/auth/session/refresh",
    );
    expect(result.token).toBeNull();
    expect(hydrateAuthSessionStateMock).toHaveBeenCalledWith({
      requirePresence: false,
    });
  });

  test("registration hydrates pending auth state without refreshing main session", async () => {
    const { register } = await import("./handler");

    const result = await register("reader@example.com", "secret");

    expect(signUpMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.token).toBeNull();
    expect(hydrateAuthSessionStateMock).toHaveBeenCalledWith({
      requirePresence: false,
    });
  });

  test("clears auth-session, profile, and cached auth queries on logout", async () => {
    const { logout } = await import("./handler");

    await logout(true);

    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(clearAuthSessionStateMock).toHaveBeenCalledTimes(1);
    expect(resetAuthSessionStoreMock).toHaveBeenCalledTimes(1);
    expect(clearProfileMock).toHaveBeenCalledTimes(1);
    expect(removeQueriesMock).toHaveBeenCalledTimes(2);
    const calls = removeQueriesMock.mock.calls as unknown as Array<
      [{ queryKey: string[] }]
    >;
    expect(calls[0]?.[0]).toEqual({ queryKey: ["auth"] });
    expect(calls[1]?.[0]).toEqual({ queryKey: ["user"] });
  });
});
