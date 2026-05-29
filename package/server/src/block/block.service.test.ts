import { beforeEach, describe, expect, mock, test } from "bun:test";
import { installPrismaClientMock, prismaMock } from "@/test/prisma-client-mock";

installPrismaClientMock();

type Row = {
  id: string;
  blockerId: string;
  blockedId: string;
  createdAt: Date;
};

let rows: Row[] = [];

/** Minimal matcher for the `where` shapes block.service uses. */
function matches(row: Row, where: any): boolean {
  if (!where) return true;
  if (where.OR) return where.OR.some((clause: any) => matches(row, clause));
  if (where.blockerId !== undefined && row.blockerId !== where.blockerId) {
    return false;
  }
  if (where.blockedId !== undefined && row.blockedId !== where.blockedId) {
    return false;
  }
  return true;
}

beforeEach(() => {
  rows = [];
  Object.assign(prismaMock, {
    userBlock: {
      findMany: mock(async ({ where }: any = {}) =>
        rows.filter((r) => matches(r, where)),
      ),
      findFirst: mock(
        async ({ where }: any = {}) =>
          rows.find((r) => matches(r, where)) ?? null,
      ),
      upsert: mock(async ({ create }: any) => {
        const existing = rows.find(
          (r) =>
            r.blockerId === create.blockerId &&
            r.blockedId === create.blockedId,
        );
        if (existing) return existing;
        const row: Row = {
          id: `block-${rows.length + 1}`,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          ...create,
        };
        rows.push(row);
        return row;
      }),
      deleteMany: mock(async ({ where }: any = {}) => {
        const before = rows.length;
        rows = rows.filter((r) => !matches(r, where));
        return { count: before - rows.length };
      }),
    },
  });
});

describe("BlockService", () => {
  test("blockedUserIds lists who the blocker has blocked", async () => {
    const { blockService } = await import("./block.service");
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
    const { blockService } = await import("./block.service");
    await blockService.add("me", "peer");
    await blockService.add("me", "peer");
    expect(await blockService.blockedUserIds("me")).toEqual(["peer"]);
  });

  test("isBlockedEitherWay is symmetric", async () => {
    const { blockService } = await import("./block.service");
    await blockService.add("me", "peer");

    expect(await blockService.isBlockedEitherWay("me", "peer")).toBe(true);
    // Reverse direction is also blocked even though only `me` blocked `peer`.
    expect(await blockService.isBlockedEitherWay("peer", "me")).toBe(true);
    expect(await blockService.isBlockedEitherWay("me", "stranger")).toBe(false);
  });

  test("unblock removes the block so content/DM are restored", async () => {
    const { blockService } = await import("./block.service");
    await blockService.add("me", "peer");
    expect(await blockService.blockedUserIds("me")).toEqual(["peer"]);
    expect(await blockService.isBlockedEitherWay("me", "peer")).toBe(true);

    await blockService.remove("me", "peer");

    // On next fetch the peer is no longer hidden and DM is permitted again.
    expect(await blockService.blockedUserIds("me")).toEqual([]);
    expect(await blockService.isBlockedEitherWay("me", "peer")).toBe(false);
  });

  test("removeAllForUser clears blocks on both sides (account deletion)", async () => {
    const { blockService } = await import("./block.service");
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
