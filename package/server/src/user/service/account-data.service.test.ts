import { beforeEach, describe, expect, mock, test } from "bun:test";
import { installPrismaClientMock, prismaMock } from "@/test/prisma-client-mock";

installPrismaClientMock();

mock.module("@/infra/slug-scopes", () => ({
  requireSlugScopeId: () => "user-scope",
}));

// `@/block` is intentionally NOT mocked at the module level — doing so leaks
// across files in bun's global mock registry. The real `blockService` runs
// against `prisma.userBlock.deleteMany` (mocked below).
const userBlockDeleteMany = mock(async () => ({ count: 1 }));

const unsubscribe = mock(async (_a: string, _b: string) => true);
mock.module("@/subscription/subscription.service", () => ({
  subscriptionService: { unsubscribe },
}));

const userUpdate = mock(async () => ({}));
const unitUpdate = mock(async () => ({}));
const userUnitCollectionDeleteMany = mock(async () => ({ count: 1 }));
const userTagApplicationDeleteMany = mock(async () => ({ count: 1 }));

beforeEach(() => {
  userBlockDeleteMany.mockClear();
  unsubscribe.mockClear();
  userUpdate.mockClear();
  unitUpdate.mockClear();
  userUnitCollectionDeleteMany.mockClear();
  userTagApplicationDeleteMany.mockClear();

  Object.assign(prismaMock, {
    $transaction: mock(async (fn: any) => fn(prismaMock)),
    unit: {
      findFirst: mock(async () => ({ slug: "alice" })),
      update: unitUpdate,
    },
    user: {
      findUniqueOrThrow: mock(async () => ({
        unitId: "me",
        name: "Alice",
        email: "alice@example.com",
        bio: "hi",
        avatar: null,
        joinDate: new Date("2026-01-01T00:00:00.000Z"),
        settings: { notifications: { follow: false } },
      })),
      update: userUpdate,
    },
    post: {
      findMany: mock(async () => [
        {
          unitId: "post-1",
          kind: "REVIEW",
          createdAt: new Date("2026-02-01T00:00:00.000Z"),
          unit: { translations: [{ title: "A review" }] },
        },
      ]),
      deleteMany: mock(async () => ({ count: 0 })),
    },
    shelf: {
      findMany: mock(async () => [
        {
          unitId: "shelf-1",
          updatedAt: new Date("2026-03-01T00:00:00.000Z"),
          unit: { translations: [{ title: "Favourites" }] },
        },
      ]),
    },
    subscription: {
      findMany: mock(async ({ where }: any) =>
        where.subscriberUnitId === "me"
          ? [
              {
                targetUnitId: "peer",
                channels: ["*"],
                createdAt: new Date("2026-01-15T00:00:00.000Z"),
              },
            ]
          : [],
      ),
    },
    userUnitCollection: {
      findMany: mock(async () => [
        {
          unitId: "book-1",
          searchText: "private alias",
          createdAt: new Date("2026-02-15T00:00:00.000Z"),
          updatedAt: new Date("2026-02-16T00:00:00.000Z"),
        },
      ]),
      deleteMany: userUnitCollectionDeleteMany,
    },
    userTagApplication: {
      findMany: mock(async () => [
        {
          unitId: "book-1",
          tagUnitId: "tag-1",
          position: "00000000",
          createdAt: new Date("2026-02-17T00:00:00.000Z"),
          updatedAt: new Date("2026-02-18T00:00:00.000Z"),
        },
      ]),
      deleteMany: userTagApplicationDeleteMany,
    },
    userBlock: {
      findMany: mock(async () => [
        {
          blockedId: "blocked-1",
          createdAt: new Date("2026-04-01T00:00:00.000Z"),
        },
      ]),
      deleteMany: userBlockDeleteMany,
    },
  });
});

describe("exportUserData", () => {
  test("returns the documented export scope", async () => {
    const { exportUserData } = await import("./account-data.service");
    const data = await exportUserData("me");

    expect(data.profile).toMatchObject({
      unitId: "me",
      handle: "alice",
      email: "alice@example.com",
    });
    expect(data.settings).toEqual({ notifications: { follow: false } });
    expect(data.posts).toEqual([
      {
        unitId: "post-1",
        kind: "REVIEW",
        title: "A review",
        createdAt: "2026-02-01T00:00:00.000Z",
      },
    ]);
    expect(data.shelves[0]?.title).toBe("Favourites");
    expect(data.userUnitCollections).toEqual([
      {
        unitId: "book-1",
        searchText: "private alias",
        createdAt: "2026-02-15T00:00:00.000Z",
        updatedAt: "2026-02-16T00:00:00.000Z",
      },
    ]);
    expect(data.userTagApplications).toEqual([
      {
        unitId: "book-1",
        tagUnitId: "tag-1",
        position: "00000000",
        createdAt: "2026-02-17T00:00:00.000Z",
        updatedAt: "2026-02-18T00:00:00.000Z",
      },
    ]);
    expect(data.follows[0]?.targetUnitId).toBe("peer");
    expect(data.blocks[0]?.blockedId).toBe("blocked-1");
    expect(typeof data.exportedAt).toBe("string");
  });
});

describe("deleteAccount", () => {
  test("rejects when confirmation does not match the handle and makes no changes", async () => {
    const { deleteAccount, DeletionNotConfirmedError } = await import(
      "./account-data.service"
    );

    await expect(deleteAccount("me", "wrong-handle")).rejects.toBeInstanceOf(
      DeletionNotConfirmedError,
    );
    expect(userUpdate).not.toHaveBeenCalled();
    expect(unitUpdate).not.toHaveBeenCalled();
    expect(userBlockDeleteMany).not.toHaveBeenCalled();
    expect(userUnitCollectionDeleteMany).not.toHaveBeenCalled();
    expect(userTagApplicationDeleteMany).not.toHaveBeenCalled();
  });

  test("anonymizes the account and removes safety/social state on confirmation", async () => {
    const { deleteAccount } = await import("./account-data.service");

    await deleteAccount("me", "alice");

    // PII scrubbed; profile hidden; blocks + follow edges removed.
    const userData = (userUpdate.mock.calls[0] as any[])[0].data;
    expect(userData.email).toBeNull();
    expect(userData.name).toBeNull();
    expect(userData.extra.deletedAt).toBeDefined();
    expect((unitUpdate.mock.calls[0] as any[])[0].data.status).toBe("DELETED");
    // blockService.removeAllForUser runs for real -> deletes both-side rows.
    expect((userBlockDeleteMany.mock.calls[0] as any[])[0].where.OR).toEqual([
      { blockerId: "me" },
      { blockedId: "me" },
    ]);
    expect(unsubscribe).toHaveBeenCalledWith("me", "peer");
    expect(userUnitCollectionDeleteMany).toHaveBeenCalledWith({
      where: { userId: "me" },
    });
    expect(userTagApplicationDeleteMany).toHaveBeenCalledWith({
      where: { userId: "me" },
    });

    // Retained: authored content is never deleted.
    expect((prismaMock as any).post.deleteMany).not.toHaveBeenCalled();
  });
});
