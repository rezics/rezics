import { beforeEach, describe, expect, mock, test } from "bun:test";

process.env.NODE_ENV ??= "test";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/rezics_auth";
process.env.BETTER_AUTH_URL ??= "http://localhost:35003";
process.env.BETTER_AUTH_SECRET ??=
  "this-is-a-long-auth-secret-for-tests-123456";
process.env.AUTH_INTERNAL_TOKEN_GATEWAY_SECRET ??= "internal-test-secret";

const findAuthUserForRegistrationCancel = mock(
  async (_args?: unknown): Promise<any> => ({
    id: "auth-user-1",
    email: "reader@example.com",
    emailVerified: false,
  }),
);
const findStaleUnverifiedUsers = mock(async (_args?: unknown) => [
  { id: "stale-user-1", email: "stale@example.com" },
]);
const deleteAuthRegistration = mock(async () => {});
const cleanupStaleRegistrations = mock(async () => {});
const findVerifiedFactsUser = mock(async () => ({
  id: "auth-user-1",
  email: "reader@example.com",
  emailVerified: false,
  updatedAt: new Date("2026-05-07T00:00:00.000Z"),
  accounts: [] as Array<{ providerId: string }>,
}));
const findAuthUserId = mock(async () => ({ id: "auth-user-1" }));
const updateAuthUserName = mock(async () => {});
const deleteAuthSessionForUser = mock(async () => 1);
const deleteAuthSessionsForUser = mock(async () => 1);
const listActiveAuthSessions = mock(async () => [
  {
    id: "session-1",
    userId: "auth-user-1",
    expiresAt: new Date("2026-06-28T00:00:00.000Z"),
    ipAddress: "203.0.113.10",
    userAgent: "Mozilla/5.0",
    impersonatedBy: null,
    createdAt: new Date("2026-05-28T00:00:00.000Z"),
    updatedAt: new Date("2026-05-28T00:00:00.000Z"),
  },
]);
const findImpersonationUsers = mock(async () => ({
  actor: { id: "actor-auth-user-1", role: "owner" },
  target: { id: "target-auth-user-1", role: "user", banned: false },
}));
const createImpersonationSession = mock(async () => ({
  id: "session-impersonation-1",
  token: "impersonation-token",
  userId: "target-auth-user-1",
  impersonatedBy: "actor-auth-user-1",
  createdAt: new Date("2026-05-28T00:00:00.000Z"),
  expiresAt: new Date("2026-05-28T00:15:00.000Z"),
}));

mock.module("../auth/storage", () => ({
  cleanupStaleRegistrations,
  createImpersonationSession,
  deleteAuthRegistration,
  deleteAuthSessionForUser,
  deleteAuthSessionsForUser,
  findAuthUserForRegistrationCancel,
  findAuthUserId,
  findImpersonationUsers,
  findStaleUnverifiedUsers,
  findVerifiedFactsUser,
  listActiveAuthSessions,
  updateAuthUserName,
}));

mock.module("../env", () => ({
  env: {
    AUTH_INTERNAL_TOKEN_GATEWAY_SECRET: "internal-test-secret",
  },
}));

describe("auth internal registration lifecycle", () => {
  beforeEach(() => {
    (globalThis as any).__authStorageMocks = {
      cleanupStaleRegistrations,
      createImpersonationSession,
      deleteAuthRegistration,
      deleteAuthSessionForUser,
      deleteAuthSessionsForUser,
      findAuthUserForRegistrationCancel,
      findAuthUserId,
      findImpersonationUsers,
      findStaleUnverifiedUsers,
      findVerifiedFactsUser,
      listActiveAuthSessions,
      updateAuthUserName,
    };
    findAuthUserForRegistrationCancel.mockReset();
    findAuthUserForRegistrationCancel.mockResolvedValue({
      id: "auth-user-1",
      email: "reader@example.com",
      emailVerified: false,
    });
    findStaleUnverifiedUsers.mockReset();
    findStaleUnverifiedUsers.mockResolvedValue([
      { id: "stale-user-1", email: "stale@example.com" },
    ]);
    deleteAuthRegistration.mockClear();
    cleanupStaleRegistrations.mockClear();
    findVerifiedFactsUser.mockReset();
    findVerifiedFactsUser.mockResolvedValue({
      id: "auth-user-1",
      email: "reader@example.com",
      emailVerified: false,
      updatedAt: new Date("2026-05-07T00:00:00.000Z"),
      accounts: [] as Array<{ providerId: string }>,
    });
    findAuthUserId.mockReset();
    findAuthUserId.mockResolvedValue({ id: "auth-user-1" });
    updateAuthUserName.mockClear();
    deleteAuthSessionForUser.mockReset();
    deleteAuthSessionForUser.mockResolvedValue(1);
    deleteAuthSessionsForUser.mockReset();
    deleteAuthSessionsForUser.mockResolvedValue(1);
    listActiveAuthSessions.mockClear();
    findImpersonationUsers.mockReset();
    findImpersonationUsers.mockResolvedValue({
      actor: { id: "actor-auth-user-1", role: "owner" },
      target: { id: "target-auth-user-1", role: "user", banned: false },
    });
    createImpersonationSession.mockClear();
  });

  test("cancels an unverified registration and invalidates related auth state", async () => {
    const { authInternalApi } = await import("./internal.api");

    const response = await authInternalApi.handle(
      new Request("http://localhost/internal/registration/cancel", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-secret": "internal-test-secret",
        },
        body: JSON.stringify({ authUserId: "auth-user-1" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      canceled: true,
    });
    expect(deleteAuthRegistration).toHaveBeenCalledWith({
      id: "auth-user-1",
      email: "reader@example.com",
      emailVerified: false,
    });
  });

  test("rejects verified cancellation unless main explicitly allows it", async () => {
    findAuthUserForRegistrationCancel.mockResolvedValueOnce({
      id: "auth-user-1",
      email: "reader@example.com",
      emailVerified: true,
    });

    const { authInternalApi } = await import("./internal.api");

    const response = await authInternalApi.handle(
      new Request("http://localhost/internal/registration/cancel", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-secret": "internal-test-secret",
        },
        body: JSON.stringify({ authUserId: "auth-user-1" }),
      }),
    );

    expect(response.status).toBe(409);
    expect(deleteAuthRegistration).not.toHaveBeenCalled();
    expect((await response.json()).error.code).toBe(
      "VERIFIED_ACCOUNT_REQUIRES_MAIN_APPROVAL",
    );
  });

  test("cleans up stale unverified registration accounts", async () => {
    const { authInternalApi } = await import("./internal.api");

    const response = await authInternalApi.handle(
      new Request("http://localhost/internal/registration/cleanup-stale", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-secret": "internal-test-secret",
        },
        body: JSON.stringify({ olderThanHours: 24 }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      deleted: 1,
    });
    expect(findStaleUnverifiedUsers.mock.calls[0]?.[0]).toBeInstanceOf(Date);
    expect(cleanupStaleRegistrations).toHaveBeenCalledWith({
      userIds: ["stale-user-1"],
      emails: ["stale@example.com"],
    });
  });

  test("returns verified registration facts for main materialization", async () => {
    const updatedAt = new Date("2026-05-07T00:00:00.000Z");
    findVerifiedFactsUser.mockResolvedValueOnce({
      id: "auth-user-1",
      email: "reader@example.com",
      emailVerified: true,
      updatedAt,
      accounts: [{ providerId: "github" }],
    });

    const { authInternalApi } = await import("./internal.api");

    const response = await authInternalApi.handle(
      new Request("http://localhost/internal/registration/verified-facts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-secret": "internal-test-secret",
        },
        body: JSON.stringify({ authUserId: "auth-user-1" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      facts: {
        authUserId: "auth-user-1",
        email: "reader@example.com",
        emailVerified: true,
        verifiedAt: updatedAt.toISOString(),
        verificationSource: "github",
        trustedProviderId: "github",
      },
    });
  });

  test("rejects verified facts before registration verification", async () => {
    findVerifiedFactsUser.mockResolvedValueOnce({
      id: "auth-user-1",
      email: "reader@example.com",
      emailVerified: false,
      updatedAt: new Date("2026-05-07T00:00:00.000Z"),
      accounts: [],
    });

    const { authInternalApi } = await import("./internal.api");

    const response = await authInternalApi.handle(
      new Request("http://localhost/internal/registration/verified-facts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-secret": "internal-test-secret",
        },
        body: JSON.stringify({ authUserId: "auth-user-1" }),
      }),
    );

    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe(
      "REGISTRATION_NOT_VERIFIED",
    );
  });

  test("projects main slug into auth technical name", async () => {
    findAuthUserId.mockResolvedValueOnce({ id: "auth-user-1" });
    const { authInternalApi } = await import("./internal.api");

    const response = await authInternalApi.handle(
      new Request("http://localhost/internal/users/project-slug", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-secret": "internal-test-secret",
        },
        body: JSON.stringify({ authUserId: "auth-user-1", slug: "reader" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(updateAuthUserName).toHaveBeenCalledWith("auth-user-1", "reader");
  });

  test("revokes all sessions for a main-requested auth user", async () => {
    findAuthUserId.mockResolvedValueOnce({ id: "auth-user-1" });
    deleteAuthSessionsForUser.mockResolvedValueOnce(2);
    const { authInternalApi } = await import("./internal.api");

    const response = await authInternalApi.handle(
      new Request("http://localhost/internal/users/revoke-sessions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-secret": "internal-test-secret",
        },
        body: JSON.stringify({
          authUserId: "auth-user-1",
          reason: "account ban",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      revokedSessions: 2,
    });
    expect(deleteAuthSessionsForUser).toHaveBeenCalledWith("auth-user-1");
  });

  test("lists safe session metadata for a main-requested auth user", async () => {
    const { authInternalApi } = await import("./internal.api");

    const response = await authInternalApi.handle(
      new Request("http://localhost/internal/users/list-sessions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-secret": "internal-test-secret",
        },
        body: JSON.stringify({ authUserId: "auth-user-1" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      sessions: [
        {
          id: "session-1",
          authUserId: "auth-user-1",
          createdAt: "2026-05-28T00:00:00.000Z",
          updatedAt: "2026-05-28T00:00:00.000Z",
          expiresAt: "2026-06-28T00:00:00.000Z",
          ipAddress: "203.0.113.10",
          userAgent: "Mozilla/5.0",
          impersonatedBy: null,
        },
      ],
    });
  });

  test("revokes one session for a main-requested auth user", async () => {
    const { authInternalApi } = await import("./internal.api");

    const response = await authInternalApi.handle(
      new Request("http://localhost/internal/users/revoke-session", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-secret": "internal-test-secret",
        },
        body: JSON.stringify({
          authUserId: "auth-user-1",
          sessionId: "session-1",
          reason: "operator review",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      revokedSessions: 1,
    });
    expect(deleteAuthSessionForUser).toHaveBeenCalledWith(
      "auth-user-1",
      "session-1",
    );
  });

  test("creates an owner impersonation session for a main-requested auth user", async () => {
    findImpersonationUsers.mockResolvedValueOnce({
      actor: { id: "actor-auth-user-1", role: "owner" },
      target: {
        id: "target-auth-user-1",
        role: "user",
        banned: false,
      },
    });
    const { authInternalApi } = await import("./internal.api");

    const response = await authInternalApi.handle(
      new Request("http://localhost/internal/users/impersonate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-secret": "internal-test-secret",
        },
        body: JSON.stringify({
          actorAuthUserId: "actor-auth-user-1",
          targetAuthUserId: "target-auth-user-1",
          reason: "support review",
          durationSeconds: 900,
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      session: {
        id: "session-impersonation-1",
        token: "impersonation-token",
        authUserId: "target-auth-user-1",
        impersonatedBy: "actor-auth-user-1",
        startedAt: "2026-05-28T00:00:00.000Z",
        expiresAt: "2026-05-28T00:15:00.000Z",
        durationSeconds: 900,
      },
    });
    expect(createImpersonationSession).toHaveBeenCalledWith({
      userId: "target-auth-user-1",
      token: expect.any(String),
      expiresAt: expect.any(Date),
      impersonatedBy: "actor-auth-user-1",
    });
  });

  test("denies impersonation when the actor is not an owner", async () => {
    findImpersonationUsers.mockResolvedValueOnce({
      actor: { id: "actor-auth-user-1", role: "admin" },
      target: {
        id: "target-auth-user-1",
        role: "user",
        banned: false,
      },
    });
    const { authInternalApi } = await import("./internal.api");

    const response = await authInternalApi.handle(
      new Request("http://localhost/internal/users/impersonate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-secret": "internal-test-secret",
        },
        body: JSON.stringify({
          actorAuthUserId: "actor-auth-user-1",
          targetAuthUserId: "target-auth-user-1",
          reason: "support review",
          durationSeconds: 900,
        }),
      }),
    );

    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("OWNER_REQUIRED");
    expect(createImpersonationSession).not.toHaveBeenCalled();
  });

  test("denies impersonation of banned auth users", async () => {
    findImpersonationUsers.mockResolvedValueOnce({
      actor: { id: "actor-auth-user-1", role: "owner" },
      target: {
        id: "target-auth-user-1",
        role: "user",
        banned: true,
      },
    });
    const { authInternalApi } = await import("./internal.api");

    const response = await authInternalApi.handle(
      new Request("http://localhost/internal/users/impersonate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-secret": "internal-test-secret",
        },
        body: JSON.stringify({
          actorAuthUserId: "actor-auth-user-1",
          targetAuthUserId: "target-auth-user-1",
          reason: "support review",
          durationSeconds: 900,
        }),
      }),
    );

    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("TARGET_AUTH_USER_BANNED");
    expect(createImpersonationSession).not.toHaveBeenCalled();
  });
});
