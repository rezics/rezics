import { beforeEach, describe, expect, mock, test } from "bun:test";
import { installPrismaClientMock, prismaMock } from "@/test/prisma-client-mock";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/rezics_book";
process.env.SERVER_INTERNAL_SECRET = "test-secret";

const mockUserCreate = mock(async () => ({
  userId: "user-1",
  slug: "testuser",
  name: "Test User",
}));

const mockUserFindUnique = mock(async () => null as { userId: string } | null);
const mockUnitFindUnique = mock(async () => null);
const mockBootstrapSystemShelves = mock(async () => {});

const mockRealmMemberCreate = mock(async () => ({
  realmUnitId: "realm-1",
  userId: "user-1",
  roleKey: "member",
}));

installPrismaClientMock();
Object.assign(prismaMock, {
  $transaction: mock(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      user: {
        findUnique: mockUserFindUnique,
        create: mockUserCreate,
      },
    }),
  ),
  user: { findUnique: mockUserFindUnique, create: mockUserCreate },
  unit: { findUnique: mockUnitFindUnique },
  realmMember: { create: mockRealmMemberCreate },
});

mock.module("@/meili/user/sync", () => ({
  syncUserToMeili: mock(async () => {}),
}));

mock.module("@/shelf/system-shelves", () => ({
  bootstrapSystemShelves: mockBootstrapSystemShelves,
}));

mock.module("../env", () => ({
  env: {
    SERVER_INTERNAL_SECRET: "test-secret",
  },
}));

const mockGetDefaultRealmId = mock(() => "realm-1" as string | null);

mock.module("../infra/default-realm", () => ({
  getDefaultRealmId: mockGetDefaultRealmId,
}));

describe("POST /internal/users/provision", () => {
  beforeEach(() => {
    mockUserCreate.mockClear();
    mockUserFindUnique.mockClear();
    mockUserFindUnique.mockResolvedValue(null);
    mockBootstrapSystemShelves.mockClear();
    mockRealmMemberCreate.mockClear();
    mockGetDefaultRealmId.mockClear();
    mockGetDefaultRealmId.mockReturnValue("realm-1");
  });

  test("creates a new user on first provision", async () => {
    const { internalApi } = await import("./internal.api");

    const response = await internalApi.handle(
      new Request("http://localhost/internal/users/provision", {
        method: "POST",
        headers: {
          "x-internal-secret": "test-secret",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          userId: "user-1",
          slug: "testuser",
          name: "Test User",
        }),
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ok: true });
    expect(mockUserCreate).toHaveBeenCalled();
    expect(mockBootstrapSystemShelves).toHaveBeenCalled();
    const [bootstrapArgs] = mockBootstrapSystemShelves.mock.calls as any[];
    expect(bootstrapArgs[0]).toBe("user-1");
    expect(bootstrapArgs[1]).toBe("testuser");
  });

  test("new user joins default realm", async () => {
    const { internalApi } = await import("./internal.api");

    await internalApi.handle(
      new Request("http://localhost/internal/users/provision", {
        method: "POST",
        headers: {
          "x-internal-secret": "test-secret",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          userId: "user-1",
          slug: "testuser",
          name: "Test User",
        }),
      }),
    );

    expect(mockGetDefaultRealmId).toHaveBeenCalled();
    expect(mockRealmMemberCreate).toHaveBeenCalledWith({
      data: {
        realmUnitId: "realm-1",
        userId: "user-1",
        roleKey: "member",
      },
    });
  });

  test("existing user silently skips duplicate realm membership", async () => {
    mockRealmMemberCreate.mockRejectedValueOnce(
      new Error("Unique constraint failed"),
    );

    const { internalApi } = await import("./internal.api");

    const response = await internalApi.handle(
      new Request("http://localhost/internal/users/provision", {
        method: "POST",
        headers: {
          "x-internal-secret": "test-secret",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          userId: "user-1",
          slug: "testuser",
          name: "Test User",
        }),
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ok: true });
  });

  test("null realm ID skips auto-join", async () => {
    mockGetDefaultRealmId.mockReturnValue(null);

    const { internalApi } = await import("./internal.api");

    await internalApi.handle(
      new Request("http://localhost/internal/users/provision", {
        method: "POST",
        headers: {
          "x-internal-secret": "test-secret",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          userId: "user-1",
          slug: "testuser",
          name: "Test User",
        }),
      }),
    );

    expect(mockRealmMemberCreate).not.toHaveBeenCalled();
  });

  test("duplicate provision is idempotent", async () => {
    mockUserFindUnique.mockResolvedValueOnce({ userId: "user-1" });

    const { internalApi } = await import("./internal.api");

    const response = await internalApi.handle(
      new Request("http://localhost/internal/users/provision", {
        method: "POST",
        headers: {
          "x-internal-secret": "test-secret",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          userId: "user-1",
          slug: "testuser",
          name: "Test User",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mockUserCreate).not.toHaveBeenCalled();
  });

  test("missing secret returns 401", async () => {
    const { internalApi } = await import("./internal.api");

    const response = await internalApi.handle(
      new Request("http://localhost/internal/users/provision", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          userId: "user-1",
          slug: "testuser",
          name: "Test User",
        }),
      }),
    );

    expect(response.status).toBe(401);
  });
});
