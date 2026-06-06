import { beforeEach, describe, expect, mock, test } from "bun:test";

type Row = {
  id: string;
  blockerId: string;
  blockedId: string;
  createdAt: Date;
};

let rows: Row[] = [];

beforeEach(() => {
  rows = [];
});

function inMemoryRepository() {
  return {
    listBlocks: mock(async (blockerId: string) =>
      rows.filter((row) => row.blockerId === blockerId),
    ),
    listUsers: mock(async () => []),
    listUserSlugs: mock(async () => []),
    add: mock(async (blockerId: string, blockedId: string) => {
      const existing = rows.find(
        (row) => row.blockerId === blockerId && row.blockedId === blockedId,
      );
      if (existing) return;
      rows.push({
        id: `block-${rows.length + 1}`,
        blockerId,
        blockedId,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      });
    }),
    remove: mock(async (blockerId: string, blockedId: string) => {
      rows = rows.filter(
        (row) => row.blockerId !== blockerId || row.blockedId !== blockedId,
      );
    }),
    blockedUserIds: mock(async (blockerId: string) =>
      rows
        .filter((row) => row.blockerId === blockerId)
        .map((row) => row.blockedId),
    ),
    isBlockedEitherWay: mock(async (a: string, b: string) =>
      rows.some(
        (row) =>
          (row.blockerId === a && row.blockedId === b) ||
          (row.blockerId === b && row.blockedId === a),
      ),
    ),
    removeAllForUser: mock(async (userId: string) => {
      rows = rows.filter(
        (row) => row.blockerId !== userId && row.blockedId !== userId,
      );
    }),
  };
}

async function createService() {
  const { BlockService } = await import("./block.service");
  return new BlockService(inMemoryRepository());
}

describe("BlockService", () => {
  test("blockedUserIds lists who the blocker has blocked", async () => {
    const blockService = await createService();
    await blockService.add("me", "peer-a");
    await blockService.add("me", "peer-b");

    expect((await blockService.blockedUserIds("me")).sort()).toEqual([
      "peer-a",
      "peer-b",
    ]);
    // Directional: peer-a has blocked nobody.
    expect(await blockService.blockedUserIds("peer-a")).toEqual([]);
  });

  test("add is idempotent", async () => {
    const blockService = await createService();
    await blockService.add("me", "peer");
    await blockService.add("me", "peer");
    expect(await blockService.blockedUserIds("me")).toEqual(["peer"]);
  });

  test("isBlockedEitherWay is symmetric", async () => {
    const blockService = await createService();
    await blockService.add("me", "peer");

    expect(await blockService.isBlockedEitherWay("me", "peer")).toBe(true);
    // Reverse direction is also blocked even though only `me` blocked `peer`.
    expect(await blockService.isBlockedEitherWay("peer", "me")).toBe(true);
    expect(await blockService.isBlockedEitherWay("me", "stranger")).toBe(false);
  });

  test("unblock removes the block so content/DM are restored", async () => {
    const blockService = await createService();
    await blockService.add("me", "peer");
    expect(await blockService.blockedUserIds("me")).toEqual(["peer"]);
    expect(await blockService.isBlockedEitherWay("me", "peer")).toBe(true);

    await blockService.remove("me", "peer");

    // On next fetch the peer is no longer hidden and DM is permitted again.
    expect(await blockService.blockedUserIds("me")).toEqual([]);
    expect(await blockService.isBlockedEitherWay("me", "peer")).toBe(false);
  });

  test("removeAllForUser clears blocks on both sides (account deletion)", async () => {
    const blockService = await createService();
    await blockService.add("gone", "peer-a");
    await blockService.add("peer-b", "gone");
    await blockService.add("peer-c", "peer-d");

    await blockService.removeAllForUser("gone");

    expect(await blockService.blockedUserIds("gone")).toEqual([]);
    expect(await blockService.blockedUserIds("peer-b")).toEqual([]);
    // Unrelated blocks survive.
    expect(await blockService.blockedUserIds("peer-c")).toEqual(["peer-d"]);
  });
});
