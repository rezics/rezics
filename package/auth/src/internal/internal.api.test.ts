import { beforeEach, describe, expect, mock, test } from "bun:test";

process.env.NODE_ENV ??= "test";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/rezics_auth";
process.env.BETTER_AUTH_URL ??= "http://localhost:35003";
process.env.BETTER_AUTH_SECRET ??=
  "this-is-a-long-auth-secret-for-tests-123456";
process.env.AUTH_INTERNAL_TOKEN_GATEWAY_SECRET ??= "internal-test-secret";

const userFindUnique = mock(async () => ({
  id: "auth-user-1",
  email: "reader@example.com",
  emailVerified: false,
}));
const userFindMany = mock(async (_args?: unknown) => [
  { id: "stale-user-1", email: "stale@example.com" },
]);
const userDelete = mock(async () => ({ id: "auth-user-1" }));
const userDeleteMany = mock(async () => ({ count: 1 }));
const deleteMany = mock(async () => ({ count: 1 }));
const transaction = mock(async (operations: Promise<unknown>[]) =>
  Promise.all(operations),
);

mock.module("../auth/prisma", () => ({
  prisma: {
    user: {
      findUnique: userFindUnique,
      findMany: userFindMany,
      delete: userDelete,
      deleteMany: userDeleteMany,
    },
    session: { deleteMany },
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
    userDeleteMany.mockClear();
    deleteMany.mockClear();
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
});
