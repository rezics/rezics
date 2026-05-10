import { beforeEach, describe, expect, mock, test } from "bun:test";
import { configureApi } from "../config";

const fetchMock = mock();

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

configureApi({
  apiBaseUrl: "http://api.example",
  authBaseUrl: "http://api.example",
  reactionServiceUrl: "http://reaction.example",
});

describe("authApi", () => {
  beforeEach(() => {
    fetchMock.mockClear();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    globalThis.window = {
      dispatchEvent: () => true,
    } as unknown as Window & typeof globalThis;
    globalThis.localStorage = createMemoryStorage() as Storage;
  });

  test("keeps legacy token helper pointed at the blocked main auth boundary", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ token: "jwt-token" }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );

    const { authApi } = await import("./auth.api");
    const response = await authApi.getToken();

    expect(response).toEqual({ token: "jwt-token" });

    const [url, options] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://api.example/auth/token");
    expect(options).toMatchObject({
      credentials: "include",
    });
  });

  test("reads normalized auth session state from the main auth boundary", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          session: {
            id: "session-1",
            token: "session-token",
            expiresAt: "2026-03-10T00:00:00.000Z",
            userId: "user-1",
          },
          user: {
            id: "user-1",
            name: "Reader",
            role: "user",
            email: "reader@example.com",
            emailVerified: false,
            createdAt: "2026-03-10T00:00:00.000Z",
            updatedAt: "2026-03-10T00:00:00.000Z",
          },
          authSession: {
            email: "reader@example.com",
            emailVerified: false,
            mainUserExists: false,
            registrationComplete: false,
            canAcquireMemberToken: false,
            readinessStatus: "pending-verification",
            pendingRegistration: {
              active: true,
              step: "verify-email",
              email: "reader@example.com",
              emailVerified: false,
              requiresEmailVerification: true,
              requiresMainAccountSetup: false,
            },
            hasPassword: false,
            canSetPassword: true,
            providerIds: ["google"],
          },
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    const { authApi } = await import("./auth.api");
    const response = await authApi.getSessionState();

    expect(response.authSession.emailVerified).toBe(false);

    const [url, options] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://api.example/auth/get-session-state");
    expect(options).toMatchObject({
      credentials: "include",
    });
  });

  test("posts social sign-in initiation to the main auth boundary", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ url: "http://oauth.example", redirect: false }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    const { authApi } = await import("./auth.api");

    const response = await authApi.signInSocial({
      provider: "google",
      disableRedirect: true,
    });

    expect(response).toEqual({
      url: "http://oauth.example",
      redirect: false,
    });

    const [url, options] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://api.example/auth/sign-in/social");
    expect(options).toMatchObject({
      method: "POST",
      credentials: "include",
      body: JSON.stringify({
        provider: "google",
        disableRedirect: true,
      }),
    });
  });

  test("posts verification and account setup actions to the main auth boundary", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: true }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: true }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: true }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }),
      );

    const { authApi } = await import("./auth.api");

    await authApi.sendVerificationEmail({
      email: "reader@example.com",
    });
    await authApi.changeEmail({
      newEmail: "reader+new@example.com",
    });
    await authApi.setPassword({
      newPassword: "new-password",
    });
    await authApi.setupProfile({
      displayName: "Reader",
      slug: "reader",
    });

    expect(fetchMock.mock.calls[0]![0]).toBe(
      "http://api.example/auth/send-verification-email",
    );
    expect(fetchMock.mock.calls[1]![0]).toBe(
      "http://api.example/auth/change-email",
    );
    expect(fetchMock.mock.calls[2]![0]).toBe(
      "http://api.example/auth/set-password",
    );
    expect(fetchMock.mock.calls[3]![0]).toBe(
      "http://api.example/auth/account/profile-setup",
    );
  });

  test("materializes account and renews profile setup token through main boundary", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }),
      );

    const { authApi } = await import("./auth.api");

    await authApi.materializeAccount();
    await authApi.renewProfileSetupToken();

    expect(fetchMock.mock.calls[0]![0]).toBe(
      "http://api.example/auth/account/materialize",
    );
    expect(fetchMock.mock.calls[1]![0]).toBe(
      "http://api.example/auth/account/profile-setup-token/renew",
    );
  });

  test("checks slug availability through the main-owned route", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ available: true, normalized: "reader" }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );

    const { authApi } = await import("./auth.api");

    await expect(authApi.checkAccountSlug("reader")).resolves.toEqual({
      available: true,
      normalized: "reader",
    });

    expect(fetchMock.mock.calls[0]![0]).toBe(
      "http://api.example/auth/account/slug-availability?slug=reader",
    );
  });

  test("posts password reset requests to the auth service", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: true, message: "queued" }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );

    const { authApi } = await import("./auth.api");

    const response = await authApi.requestPasswordReset({
      email: "reader@example.com",
      redirectTo: "http://localhost:3000/reset-password",
    });

    expect(response).toEqual({
      status: true,
      message: "queued",
    });

    const [url, options] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://api.example/auth/request-password-reset");
    expect(options).toMatchObject({
      method: "POST",
      credentials: "include",
      body: JSON.stringify({
        email: "reader@example.com",
        redirectTo: "http://localhost:3000/reset-password",
      }),
    });
  });

  test("posts password reset completion to the auth service", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: true }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );

    const { authApi } = await import("./auth.api");

    const response = await authApi.resetPassword({
      token: "reset-token",
      newPassword: "new-password",
    });

    expect(response).toEqual({ status: true });

    const [url, options] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://api.example/auth/reset-password");
    expect(options).toMatchObject({
      method: "POST",
      credentials: "include",
      body: JSON.stringify({
        token: "reset-token",
        newPassword: "new-password",
      }),
    });
  });
});
