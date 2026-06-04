import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { AccountDataRepository } from "./account-data.service";

const removeAllForUser = mock(async (_userId: string) => undefined);
mock.module("../../block/block.service", () => ({
  blockService: {
    removeAllForUser,
  },
}));

const unsubscribe = mock(async (_a: string, _b: string) => true);
mock.module("../../subscription/subscription.service", () => ({
  subscriptionService: { unsubscribe },
}));

const scrubDeletedAccount = mock(
  async (_userId: string, _deletedAt: Date) => undefined,
);

function repository(): AccountDataRepository {
  return {
    getHandle: mock(async () => "alice"),
    getExportUser: mock(async () => ({
      unitId: "me",
      name: "Alice",
      email: "alice@example.com",
      bio: "hi",
      avatar: null,
      joinDate: new Date("2026-01-01T00:00:00.000Z"),
      settings: { notifications: { follow: false } },
    })),
    listExportPosts: mock(async () => [
      {
        unitId: "post-1",
        kind: "REVIEW",
        title: "A review",
        createdAt: new Date("2026-02-01T00:00:00.000Z"),
      },
    ]),
    listExportShelves: mock(async () => [
      {
        unitId: "shelf-1",
        title: "Favourites",
        updatedAt: new Date("2026-03-01T00:00:00.000Z"),
      },
    ]),
    listUserUnitCollections: mock(async () => [
      {
        unitId: "book-1",
        searchText: "private alias",
        createdAt: new Date("2026-02-15T00:00:00.000Z"),
        updatedAt: new Date("2026-02-16T00:00:00.000Z"),
      },
    ]),
    listUserTagApplications: mock(async () => [
      {
        unitId: "book-1",
        tagUnitId: "tag-1",
        position: "00000000",
        createdAt: new Date("2026-02-17T00:00:00.000Z"),
        updatedAt: new Date("2026-02-18T00:00:00.000Z"),
      },
    ]),
    listFollows: mock(async () => [
      {
        subscribedUnitId: "peer",
        channels: ["*"],
        createdAt: new Date("2026-01-15T00:00:00.000Z"),
      },
    ]),
    listFollowers: mock(async () => []),
    listBlocks: mock(async () => [
      {
        blockedId: "blocked-1",
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
      },
    ]),
    scrubDeletedAccount,
  };
}

beforeEach(() => {
  removeAllForUser.mockClear();
  unsubscribe.mockClear();
  scrubDeletedAccount.mockClear();
});

describe("exportUserData", () => {
  test("returns the documented export scope", async () => {
    const { exportUserData } = await import("./account-data.service");
    const data = await exportUserData("me", repository());

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
    const repo = repository();

    await expect(
      deleteAccount("me", "wrong-handle", repo),
    ).rejects.toBeInstanceOf(DeletionNotConfirmedError);
    expect(removeAllForUser).not.toHaveBeenCalled();
    expect(unsubscribe).not.toHaveBeenCalled();
    expect(scrubDeletedAccount).not.toHaveBeenCalled();
  });

  test("anonymizes the account and removes safety/social state on confirmation", async () => {
    const { deleteAccount } = await import("./account-data.service");
    const repo = repository();

    await deleteAccount("me", "alice", repo);

    // PII scrubbed; profile hidden; blocks + follow edges removed.
    expect(scrubDeletedAccount).toHaveBeenCalledWith("me", expect.any(Date));
    expect(removeAllForUser).toHaveBeenCalledWith("me");
    expect(unsubscribe).toHaveBeenCalledWith("me", "peer");
  });
});
