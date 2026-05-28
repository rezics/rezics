import { beforeEach, describe, expect, mock, test } from "bun:test";

process.env.NODE_ENV ??= "test";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/rezics_auth";
process.env.BETTER_AUTH_URL ??= "http://localhost:35003";
process.env.BETTER_AUTH_SECRET ??=
  "this-is-a-long-auth-secret-for-tests-123456";
process.env.AUTH_INTERNAL_TOKEN_GATEWAY_SECRET ??= "internal-test-secret";

const userFindUnique = mock(
  async (_args?: unknown): Promise<any> => ({
    id: "auth-user-1",
    email: "reader@example.com",
    emailVerified: false,
  }),
);
const userFindMany = mock(async (_args?: unknown) => [
  { id: "stale-user-1", email: "stale@example.com" },
]);
const userUpdate = mock(async () => ({ id: "auth-user-1", name: "reader" }));
const userDelete = mock(async () => ({ id: "auth-user-1" }));
const userDeleteMany = mock(async () => ({ count: 1 }));
const deleteMany = mock(async () => ({ count: 1 }));
const sessionFindMany = mock(async () => [
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
const sessionCreate = mock(async () => ({
  id: "session-impersonation-1",
  token: "impersonation-token",
  userId: "target-auth-user-1",
  impersonatedBy: "actor-auth-user-1",
  createdAt: new Date("2026-05-28T00:00:00.000Z"),
  expiresAt: new Date("2026-05-28T00:15:00.000Z"),
}));
const transaction = mock(async (operations: Promise<unknown>[]) =>
  Promise.all(operations),
);

mock.module("../auth/prisma", () => ({
  prisma: {
    user: {
      findUnique: userFindUnique,
      findMany: userFindMany,
      update: userUpdate,
      delete: userDelete,
      deleteMany: userDeleteMany,
    },
    session: { create: sessionCreate, deleteMany, findMany: sessionFindMany },
    account: { deleteMany },
    verification: { deleteMany },
    oAuthAccessToken: { deleteMany },
    oAuthRefreshToken: { deleteMany },
    oAuthConsent: { deleteMany },
    $transaction: transaction,
  },
}));

mock.module("../env", () => ({
  env: {
    AUTH_INTERNAL_TOKEN_GATEWAY_SECRET: "internal-test-secret",
  },
}));

describe("auth internal registration lifecycle", () => {
  beforeEach(() => {
    userFindUnique.mockReset();
    userFindUnique.mockResolvedValue({
      id: "auth-user-1",
      email: "reader@example.com",
      emailVerified: false,
    });
    userFindMany.mockReset();
    userFindMany.mockResolvedValue([
      { id: "stale-user-1", email: "stale@example.com" },
    ]);
    userDelete.mockClear();
    userUpdate.mockClear();
    userDeleteMany.mockClear();
    deleteMany.mockClear();
    sessionCreate.mockClear();
    sessionFindMany.mockClear();
    transaction.mockClear();
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
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(userDelete).toHaveBeenCalledWith({
      where: { id: "auth-user-1" },
    });
  });

  test("rejects verified cancellation unless main explicitly allows it", async () => {
    userFindUnique.mockResolvedValueOnce({
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
    expect(transaction).not.toHaveBeenCalled();
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
    const findManyArgs = userFindMany.mock.calls[0]?.[0] as unknown as {
      where: { emailVerified: boolean; createdAt: { lt: Date } };
      select: { id: boolean; email: boolean };
    };
    expect(findManyArgs.where.emailVerified).toBe(false);
    expect(findManyArgs.where.createdAt.lt).toBeInstanceOf(Date);
    expect(findManyArgs.select).toEqual({ id: true, email: true });
    expect(userDeleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["stale-user-1"] } },
    });
  });

  test("returns verified registration facts for main materialization", async () => {
    const updatedAt = new Date("2026-05-07T00:00:00.000Z");
    userFindUnique.mockResolvedValueOnce({
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
    userFindUnique.mockResolvedValueOnce({
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
    userFindUnique.mockResolvedValueOnce({ id: "auth-user-1" });
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
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: "auth-user-1" },
      data: { name: "reader" },
    });
  });

  test("revokes all sessions for a main-requested auth user", async () => {
    userFindUnique.mockResolvedValueOnce({ id: "auth-user-1" });
    deleteMany.mockResolvedValueOnce({ count: 2 });
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
    expect(deleteMany).toHaveBeenCalledWith({
      where: { userId: "auth-user-1" },
    });
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
    expect(deleteMany).toHaveBeenCalledWith({
      where: { id: "session-1", userId: "auth-user-1" },
    });
  });

  test("creates an owner impersonation session for a main-requested auth user", async () => {
    userFindUnique
      .mockResolvedValueOnce({ id: "actor-auth-user-1", role: "owner" })
      .mockResolvedValueOnce({
        id: "target-auth-user-1",
        role: "user",
        banned: false,
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
    expect(sessionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "target-auth-user-1",
        impersonatedBy: "actor-auth-user-1",
      }),
      select: expect.any(Object),
    });
  });
});
