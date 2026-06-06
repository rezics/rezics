import { beforeEach, describe, expect, mock, test } from "bun:test";
import { conversationBlocks, conversations, messages } from "../db/schema";

type Row = Record<string, any>;

const state: {
  conversations: Row[];
  messages: Row[];
  blocks: Row[];
  blockLookupQueue: boolean[];
  unreadCount: number;
  updates: Array<{ table: unknown; set: Row }>;
} = {
  conversations: [],
  messages: [],
  blocks: [],
  blockLookupQueue: [],
  unreadCount: 0,
  updates: [],
};

function selectedRows(table: unknown, fields?: Row): Row[] {
  if (table === conversations) return state.conversations;
  if (table === messages) {
    if (fields?.count)
      return [{ count: state.unreadCount || state.messages.length }];
    return state.messages;
  }
  if (table === conversationBlocks) {
    return state.blockLookupQueue.shift() ? [{ id: "block" }] : [];
  }
  return [];
}

function queryBuilder(fields?: Row) {
  let table: unknown;
  const builder = {
    from(nextTable: unknown) {
      table = nextTable;
      return builder;
    },
    where() {
      return builder;
    },
    orderBy() {
      return builder;
    },
    offset() {
      return builder;
    },
    limit() {
      return builder;
    },
    // biome-ignore lint/suspicious/noThenProperty: Drizzle test double must be awaitable.
    ["then"](resolve: (rows: Row[]) => void, reject: (error: unknown) => void) {
      Promise.resolve(selectedRows(table, fields)).then(resolve, reject);
    },
  };
  return builder;
}

function insertBuilder(table: unknown) {
  let value: Row | undefined;
  const builder = {
    values(nextValue: Row) {
      value = nextValue;
      return builder;
    },
    onConflictDoUpdate() {
      return builder;
    },
    onConflictDoNothing() {
      return builder;
    },
    returning() {
      if (table === conversations) {
        const existing = state.conversations.find(
          (row) =>
            row.participantA === value?.participantA &&
            row.participantB === value?.participantB,
        );
        if (existing) {
          existing.updatedAt = value?.updatedAt;
          return Promise.resolve([{ id: existing.id }]);
        }
        const row = {
          id: `c-${state.conversations.length + 1}`,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          ...value,
        };
        state.conversations.push(row);
        return Promise.resolve([{ id: row.id }]);
      }
      if (table === messages) {
        const row = {
          id: `m-${state.messages.length + 1}`,
          readAt: null,
          createdAt: new Date("2026-01-02T00:00:00.000Z"),
          ...value,
        };
        state.messages.push(row);
        return Promise.resolve([row]);
      }
      return Promise.resolve([]);
    },
    // biome-ignore lint/suspicious/noThenProperty: Drizzle test double must be awaitable.
    ["then"](resolve: (rows: Row[]) => void, reject: (error: unknown) => void) {
      if (table === conversationBlocks && value) {
        state.blocks.push({ id: "block", ...value });
      }
      Promise.resolve([]).then(resolve, reject);
    },
  };
  return builder;
}

function updateBuilder(table: unknown) {
  let value: Row = {};
  const builder = {
    set(nextValue: Row) {
      value = nextValue;
      return builder;
    },
    where() {
      state.updates.push({ table, set: value });
      if (table === messages) {
        for (const message of state.messages) {
          if (message.readAt === null) message.readAt = value.readAt;
        }
      }
      return Promise.resolve([]);
    },
  };
  return builder;
}

function deleteBuilder(table: unknown) {
  return {
    where() {
      if (table === conversationBlocks) state.blocks = [];
      return Promise.resolve([]);
    },
  };
}

const fakeDb: any = {
  $count: () => Symbol("count"),
  select: (fields?: Row) => queryBuilder(fields),
  insert: (table: unknown) => insertBuilder(table),
  update: (table: unknown) => updateBuilder(table),
  delete: (table: unknown) => deleteBuilder(table),
  transaction: async <T>(fn: (tx: typeof fakeDb) => Promise<T>) => fn(fakeDb),
};

mock.module("../db", () => ({ db: fakeDb }));

const dmService = await import("./dm.service");

beforeEach(() => {
  state.conversations = [];
  state.messages = [];
  state.blocks = [];
  state.blockLookupQueue = [];
  state.unreadCount = 0;
  state.updates = [];
});

describe("conversation writes", () => {
  test("upsertConversation orders participants and returns the conversation id", async () => {
    const id = await dmService.upsertConversation("bob", "alice");

    expect(id).toBe("c-1");
    expect(state.conversations[0]).toMatchObject({
      participantA: "alice",
      participantB: "bob",
    });
  });

  test("insertMessage creates a message and touches the conversation", async () => {
    state.conversations = [
      {
        id: "c1",
        participantA: "alice",
        participantB: "bob",
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ];

    const message = await dmService.insertMessage("c1", "alice", "hello");

    expect(message).toMatchObject({ id: "m-1", conversationId: "c1" });
    expect(state.updates.some((entry) => entry.table === conversations)).toBe(
      true,
    );
  });
});

describe("read-receipt flow", () => {
  test("markReadUpTo returns null when the caller is not a participant", async () => {
    state.conversations = [
      { id: "c1", participantA: "alice", participantB: "bob" },
    ];

    const result = await dmService.markReadUpTo("c1", "carol", "m1");

    expect(result).toBeNull();
    expect(state.updates).toEqual([]);
  });

  test("markReadUpTo returns null when the target message is missing", async () => {
    state.conversations = [
      { id: "c1", participantA: "alice", participantB: "bob" },
    ];

    const result = await dmService.markReadUpTo("c1", "alice", "missing");

    expect(result).toBeNull();
    expect(state.updates).toEqual([]);
  });

  test("markReadUpTo marks peer messages read and returns a receipt", async () => {
    state.conversations = [
      { id: "c1", participantA: "alice", participantB: "bob" },
    ];
    state.messages = [
      {
        id: "m5",
        conversationId: "c1",
        senderId: "bob",
        readAt: null,
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
      },
    ];

    const result = await dmService.markReadUpTo("c1", "alice", "m5");

    expect(result).toMatchObject({
      conversationId: "c1",
      userId: "alice",
      lastReadMessageId: "m5",
    });
    expect(state.messages[0]?.readAt).toBeInstanceOf(Date);
  });

  test("getReadReceipt reports the peer's latest read message id", async () => {
    state.messages = [
      {
        id: "m9",
        readAt: new Date("2026-01-03T00:00:00.000Z"),
      },
    ];

    const receipt = await dmService.getReadReceipt("c1", "alice", "bob");

    expect(receipt).toEqual({
      conversationId: "c1",
      userId: "bob",
      lastReadMessageId: "m9",
      readAt: "2026-01-03T00:00:00.000Z",
    });
  });

  test("getReadReceipt returns null id when nothing has been read", async () => {
    const receipt = await dmService.getReadReceipt("c1", "alice", "bob");

    expect(receipt.lastReadMessageId).toBeNull();
  });
});

describe("block flow", () => {
  test("setBlock(true) inserts and reports peerBlocked", async () => {
    state.blockLookupQueue = [true, false];

    const result = await dmService.setBlock("alice", "bob", true);

    expect(state.blocks).toEqual([
      { id: "block", blockerId: "alice", blockedId: "bob" },
    ]);
    expect(result).toEqual({
      peerId: "bob",
      peerBlocked: true,
      blockedByPeer: false,
    });
  });

  test("setBlock(false) deletes the block row", async () => {
    state.blocks = [{ id: "block", blockerId: "alice", blockedId: "bob" }];
    state.blockLookupQueue = [false, false];

    const result = await dmService.setBlock("alice", "bob", false);

    expect(state.blocks).toEqual([]);
    expect(result.peerBlocked).toBe(false);
  });

  test("getBlockState resolves both directions independently", async () => {
    state.blockLookupQueue = [false, true];

    const stateResult = await dmService.getBlockState("alice", "bob");

    expect(stateResult).toEqual({
      peerId: "bob",
      peerBlocked: false,
      blockedByPeer: true,
    });
  });

  test("isBlockedEitherWay is true when either party blocks", async () => {
    state.blockLookupQueue = [true, false];

    expect(await dmService.isBlockedEitherWay("alice", "bob")).toBe(true);
  });

  test("getConversationViewerState combines unread count and block flags", async () => {
    state.unreadCount = 3;
    state.blockLookupQueue = [false, false];

    const result = await dmService.getConversationViewerState(
      "c1",
      "alice",
      "bob",
    );

    expect(result).toEqual({
      unreadCount: 3,
      peerBlocked: false,
      blockedByPeer: false,
    });
  });
});
