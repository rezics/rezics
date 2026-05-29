import { beforeEach, describe, expect, mock, test } from "bun:test";

// Stubbed Prisma surface. Each test reassigns the delegate methods it needs.
const prismaMock: Record<string, any> = {};

mock.module("#/prisma/client", () => ({ prisma: prismaMock }));

async function importService() {
  return import("./dm.service");
}

beforeEach(() => {
  for (const key of Object.keys(prismaMock)) delete prismaMock[key];
});

describe("read-receipt flow", () => {
  test("markReadUpTo returns null when the caller is not a participant", async () => {
    prismaMock.conversation = {
      findUnique: mock(async () => ({
        id: "c1",
        participantA: "alice",
        participantB: "bob",
      })),
    };
    const updateMany = mock(async () => ({ count: 0 }));
    prismaMock.message = { findFirst: mock(async () => null), updateMany };

    const { markReadUpTo } = await importService();
    const result = await markReadUpTo("c1", "carol", "m1");

    expect(result).toBeNull();
    // No write should happen for a non-participant.
    expect(updateMany).not.toHaveBeenCalled();
  });

  test("markReadUpTo returns null when the target message is missing", async () => {
    prismaMock.conversation = {
      findUnique: mock(async () => ({
        id: "c1",
        participantA: "alice",
        participantB: "bob",
      })),
    };
    const updateMany = mock(async () => ({ count: 0 }));
    prismaMock.message = { findFirst: mock(async () => null), updateMany };

    const { markReadUpTo } = await importService();
    const result = await markReadUpTo("c1", "alice", "missing");

    expect(result).toBeNull();
    expect(updateMany).not.toHaveBeenCalled();
  });

  test("markReadUpTo marks peer messages read and returns a receipt", async () => {
    prismaMock.conversation = {
      findUnique: mock(async () => ({
        id: "c1",
        participantA: "alice",
        participantB: "bob",
      })),
    };
    const updateMany = mock(async () => ({ count: 2 }));
    prismaMock.message = {
      findFirst: mock(async () => ({
        id: "m5",
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
      })),
      updateMany,
    };

    const { markReadUpTo } = await importService();
    const result = await markReadUpTo("c1", "alice", "m5");

    expect(result).toMatchObject({
      conversationId: "c1",
      userId: "alice",
      lastReadMessageId: "m5",
    });
    expect(typeof result?.readAt).toBe("string");
    // Only the peer's unread messages up to the target are flipped.
    const where = updateMany.mock.calls[0]?.[0]?.where;
    expect(where.senderId).toEqual({ not: "alice" });
    expect(where.readAt).toBeNull();
    expect(where.createdAt).toEqual({
      lte: new Date("2026-01-02T00:00:00.000Z"),
    });
  });

  test("getReadReceipt reports the peer's latest read message id", async () => {
    prismaMock.message = {
      findFirst: mock(async () => ({
        id: "m9",
        readAt: new Date("2026-01-03T00:00:00.000Z"),
      })),
    };

    const { getReadReceipt } = await importService();
    const receipt = await getReadReceipt("c1", "alice", "bob");

    expect(receipt).toEqual({
      conversationId: "c1",
      userId: "bob",
      lastReadMessageId: "m9",
      readAt: "2026-01-03T00:00:00.000Z",
    });
  });

  test("getReadReceipt returns null id when nothing has been read", async () => {
    prismaMock.message = { findFirst: mock(async () => null) };

    const { getReadReceipt } = await importService();
    const receipt = await getReadReceipt("c1", "alice", "bob");

    expect(receipt.lastReadMessageId).toBeNull();
  });
});

describe("block flow", () => {
  function blockFindUnique(blocked: Set<string>) {
    return mock(async ({ where }: any) => {
      const { blockerId, blockedId } = where.blockerId_blockedId;
      return blocked.has(`${blockerId}->${blockedId}`)
        ? { id: "b", blockerId, blockedId }
        : null;
    });
  }

  test("setBlock(true) upserts and reports peerBlocked", async () => {
    const blocked = new Set<string>();
    const upsert = mock(async ({ where }: any) => {
      const { blockerId, blockedId } = where.blockerId_blockedId;
      blocked.add(`${blockerId}->${blockedId}`);
      return {};
    });
    const deleteMany = mock(async () => ({ count: 0 }));
    prismaMock.conversationBlock = {
      upsert,
      deleteMany,
      findUnique: blockFindUnique(blocked),
    };

    const { setBlock } = await importService();
    const state = await setBlock("alice", "bob", true);

    expect(upsert).toHaveBeenCalledTimes(1);
    expect(deleteMany).not.toHaveBeenCalled();
    expect(state).toEqual({
      peerId: "bob",
      peerBlocked: true,
      blockedByPeer: false,
    });
  });

  test("setBlock(false) deletes the block row", async () => {
    const blocked = new Set<string>();
    const upsert = mock(async () => ({}));
    const deleteMany = mock(async () => ({ count: 1 }));
    prismaMock.conversationBlock = {
      upsert,
      deleteMany,
      findUnique: blockFindUnique(blocked),
    };

    const { setBlock } = await importService();
    const state = await setBlock("alice", "bob", false);

    expect(deleteMany).toHaveBeenCalledTimes(1);
    expect(upsert).not.toHaveBeenCalled();
    expect(state.peerBlocked).toBe(false);
  });

  test("getBlockState resolves both directions independently", async () => {
    const blocked = new Set(["bob->alice"]); // peer blocked me
    prismaMock.conversationBlock = { findUnique: blockFindUnique(blocked) };

    const { getBlockState } = await importService();
    const state = await getBlockState("alice", "bob");

    expect(state).toEqual({
      peerId: "bob",
      peerBlocked: false,
      blockedByPeer: true,
    });
  });

  test("isBlockedEitherWay is true when either party blocks", async () => {
    const blocked = new Set(["alice->bob"]);
    prismaMock.conversationBlock = { findUnique: blockFindUnique(blocked) };

    const { isBlockedEitherWay } = await importService();
    expect(await isBlockedEitherWay("alice", "bob")).toBe(true);
  });

  test("getConversationViewerState combines unread count and block flags", async () => {
    const blocked = new Set<string>();
    prismaMock.conversationBlock = { findUnique: blockFindUnique(blocked) };
    prismaMock.message = { count: mock(async () => 3) };

    const { getConversationViewerState } = await importService();
    const state = await getConversationViewerState("c1", "alice", "bob");

    expect(state).toEqual({
      unreadCount: 3,
      peerBlocked: false,
      blockedByPeer: false,
    });
  });
});
