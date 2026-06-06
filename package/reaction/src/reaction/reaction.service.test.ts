import { describe, expect, test } from "bun:test";
import type {
  CreateReactionInput,
  ListReactionRowsInput,
  ReactionRepository,
  RemoveReactionInput,
} from "./reaction.repository";

process.env.NODE_ENV = "test";
process.env.REACTION_DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/rezics_reaction";
process.env.REACTION_INTERNAL_SECRET ??= "test-secret";
process.env.SERVER_JWKS_URL ??= "http://localhost:3000/.well-known/jwks.json";
process.env.SERVER_ISSUER ??= "rezics-server";

interface FakeReactionRow {
  id: string;
  userId: string;
  targetId: string;
  reaction: string;
  scopeKey: string;
  createdAt: Date;
}

let allRows: FakeReactionRow[] = [];
const shareRows = new Set<string>();
const summaries = new Map<
  string,
  { targetId: string; reaction: string; scopeKey: string; count: number }
>();
const shareSummaries = new Map<
  string,
  { targetId: string; shareCount: number }
>();
const usages = new Map<
  string,
  { userId: string; targetId: string; activeCount: number; maxActive: number }
>();

function reactionKey(input: {
  userId: string;
  targetId: string;
  reaction: string;
  scopeKey: string;
}) {
  return `${input.userId}|${input.targetId}|${input.reaction}|${input.scopeKey}`;
}

function summaryKey(input: {
  targetId: string;
  reaction: string;
  scopeKey: string;
}) {
  return `${input.targetId}|${input.reaction}|${input.scopeKey}`;
}

function usageKey(input: { userId: string; targetId: string }) {
  return `${input.userId}|${input.targetId}`;
}

function shareKey(input: { userId: string; targetId: string }) {
  return `${input.userId}|${input.targetId}`;
}

class InMemoryReactionRepository implements ReactionRepository {
  async getSummaryRows(targetIds: string[], scopeKey: string | undefined) {
    const ids = new Set(targetIds);
    if (scopeKey === undefined) {
      const grouped = new Map<
        string,
        { targetId: string; reaction: string; count: number }
      >();
      for (const row of summaries.values()) {
        if (!ids.has(row.targetId)) continue;
        const key = `${row.targetId}|${row.reaction}`;
        const current = grouped.get(key) ?? {
          targetId: row.targetId,
          reaction: row.reaction,
          count: 0,
        };
        current.count += row.count;
        grouped.set(key, current);
      }
      return Array.from(grouped.values());
    }

    return Array.from(summaries.values()).filter(
      (row) => ids.has(row.targetId) && row.scopeKey === scopeKey,
    );
  }

  async getUserReactionRows(
    userId: string,
    targetIds: string[],
    scopeKey: string,
  ) {
    const ids = new Set(targetIds);
    return allRows
      .filter(
        (row) =>
          row.userId === userId &&
          ids.has(row.targetId) &&
          row.scopeKey === scopeKey,
      )
      .map((row) => ({ targetId: row.targetId, reaction: row.reaction }));
  }

  async listRows(input: ListReactionRowsInput) {
    let rows = [...allRows];

    if (input.userId) {
      rows = rows.filter((row) => row.userId === input.userId);
    }
    if (input.excludeUserId) {
      rows = rows.filter((row) => row.userId !== input.excludeUserId);
    }
    if (input.targetIds) {
      const ids = new Set(input.targetIds);
      rows = rows.filter((row) => ids.has(row.targetId));
    }
    if (input.reactions && input.reactions.length > 0) {
      const reactions = new Set(input.reactions);
      rows = rows.filter((row) => reactions.has(row.reaction));
    }
    if (input.scopeKey) {
      rows = rows.filter((row) => row.scopeKey === input.scopeKey);
    }
    if (input.cursor) {
      rows = rows.filter(
        (row) =>
          row.createdAt.getTime() < input.cursor!.createdAt.getTime() ||
          (row.createdAt.getTime() === input.cursor!.createdAt.getTime() &&
            row.id < input.cursor!.id),
      );
    }

    rows.sort((a, b) => {
      const t = b.createdAt.getTime() - a.createdAt.getTime();
      if (t !== 0) return t;
      return b.id.localeCompare(a.id);
    });

    return rows.slice(0, input.take);
  }

  async createReaction(input: CreateReactionInput) {
    const existing =
      allRows.find((row) => reactionKey(row) === reactionKey(input)) ?? null;
    if (existing) {
      return { reaction: existing, created: false, quotaExceeded: false };
    }

    const key = usageKey(input);
    const usage =
      usages.get(key) ??
      ({
        userId: input.userId,
        targetId: input.targetId,
        activeCount: 0,
        maxActive: input.defaultQuota,
      } satisfies {
        userId: string;
        targetId: string;
        activeCount: number;
        maxActive: number;
      });
    usages.set(key, usage);
    if (usage.activeCount >= usage.maxActive) {
      return {
        reaction: null as never,
        created: false,
        quotaExceeded: true,
      };
    }
    usage.activeCount += 1;

    const created = row(allRows.length + 1, {
      id: `created-${allRows.length + 1}`,
      userId: input.userId,
      targetId: input.targetId,
      reaction: input.reaction,
      scopeKey: input.scopeKey,
    });
    allRows.push(created);

    const sk = summaryKey(input);
    const summary =
      summaries.get(sk) ??
      ({
        targetId: input.targetId,
        reaction: input.reaction,
        scopeKey: input.scopeKey,
        count: 0,
      } satisfies {
        targetId: string;
        reaction: string;
        scopeKey: string;
        count: number;
      });
    summary.count += 1;
    summaries.set(sk, summary);

    return { reaction: created, created: true, quotaExceeded: false };
  }

  async removeReaction(input: RemoveReactionInput) {
    const index = allRows.findIndex(
      (row) => reactionKey(row) === reactionKey(input),
    );
    if (index < 0) return { deleted: false };

    allRows.splice(index, 1);
    const summary = summaries.get(summaryKey(input));
    if (summary) summary.count -= 1;
    const usage = usages.get(usageKey(input));
    if (usage) usage.activeCount -= 1;
    return { deleted: true };
  }

  async cleanupTarget(targetId: string) {
    const before = allRows.length;
    allRows = allRows.filter((row) => row.targetId !== targetId);
    for (const key of summaries.keys()) {
      if (key.startsWith(`${targetId}|`)) summaries.delete(key);
    }
    for (const [key, usage] of usages) {
      if (usage.targetId === targetId) usages.delete(key);
    }
    for (const key of [...shareRows]) {
      if (key.endsWith(`|${targetId}`)) shareRows.delete(key);
    }
    shareSummaries.delete(targetId);
    return { count: before - allRows.length };
  }

  async getShareSummaryRows(targetIds: string[]) {
    const ids = new Set(targetIds);
    return [...shareSummaries.values()].filter((row) => ids.has(row.targetId));
  }

  async recordShare(input: { userId: string; targetId: string }) {
    const key = shareKey(input);
    const created = !shareRows.has(key);
    if (created) {
      shareRows.add(key);
      const summary = shareSummaries.get(input.targetId) ?? {
        targetId: input.targetId,
        shareCount: 0,
      };
      summary.shareCount += 1;
      shareSummaries.set(input.targetId, summary);
    }
    return {
      targetId: input.targetId,
      shareCount: shareSummaries.get(input.targetId)?.shareCount ?? 0,
      created,
    };
  }
}

const {
  MalformedCursorError,
  ReactionQuotaExceededError,
  ReactionService,
  TargetIdsOverflowError,
} = await import("./reaction.service");
const { encodeCursor } = await import("./cursor");

const service = new ReactionService(new InMemoryReactionRepository());

function seed(rows: FakeReactionRow[]) {
  allRows = rows;
  shareRows.clear();
  summaries.clear();
  shareSummaries.clear();
  usages.clear();
  for (const r of rows) {
    const sk = summaryKey(r);
    const current = summaries.get(sk) ?? {
      targetId: r.targetId,
      reaction: r.reaction,
      scopeKey: r.scopeKey,
      count: 0,
    };
    current.count += 1;
    summaries.set(sk, current);
    const uk = usageKey(r);
    const usage = usages.get(uk) ?? {
      userId: r.userId,
      targetId: r.targetId,
      activeCount: 0,
      maxActive: 3,
    };
    usage.activeCount += 1;
    usages.set(uk, usage);
  }
}

function row(
  i: number,
  partial: Partial<FakeReactionRow> = {},
): FakeReactionRow {
  return {
    id: `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
    userId: "u-actor",
    targetId: "t-1",
    reaction: "upvote",
    scopeKey: "direct",
    createdAt: new Date(2026, 0, 1, 0, 0, i),
    ...partial,
  };
}

describe("reactionService.listGiven", () => {
  test("returns empty for a user with no reactions", async () => {
    seed([]);
    const result = await service.listGiven({ userId: "nobody" });
    expect(result).toEqual({ items: [], nextCursor: null });
  });

  test("returns a full page with no nextCursor when nothing remains", async () => {
    seed([
      row(1, { id: "id-a", userId: "u" }),
      row(2, { id: "id-b", userId: "u" }),
    ]);
    const result = await service.listGiven({ userId: "u", limit: 5 });
    expect(result.items.length).toBe(2);
    expect(result.nextCursor).toBeNull();
  });

  test("returns a full page with a nextCursor when more remain", async () => {
    seed([
      row(1, { id: "id-a", userId: "u" }),
      row(2, { id: "id-b", userId: "u" }),
      row(3, { id: "id-c", userId: "u" }),
    ]);
    const result = await service.listGiven({ userId: "u", limit: 2 });
    expect(result.items.length).toBe(2);
    expect(result.nextCursor).not.toBeNull();
  });

  test("cursor continuation returns rows strictly older", async () => {
    const rows = [
      row(1, { id: "id-a", userId: "u" }),
      row(2, { id: "id-b", userId: "u" }),
      row(3, { id: "id-c", userId: "u" }),
    ];
    seed(rows);

    const first = await service.listGiven({ userId: "u", limit: 2 });
    expect(first.items.length).toBe(2);
    const second = await service.listGiven({
      userId: "u",
      limit: 2,
      cursor: first.nextCursor ?? undefined,
    });
    expect(second.items.length).toBe(1);
    expect(second.nextCursor).toBeNull();
  });

  test("rejects malformed cursor", async () => {
    seed([]);
    await expect(
      service.listGiven({ userId: "u", cursor: "@@@not-a-cursor@@@" }),
    ).rejects.toBeInstanceOf(MalformedCursorError);
  });

  test("filters by reaction type allowlist", async () => {
    seed([
      row(1, { id: "id-a", userId: "u", reaction: "upvote" }),
      row(2, { id: "id-b", userId: "u", reaction: "downvote" }),
    ]);
    const result = await service.listGiven({
      userId: "u",
      reactions: ["upvote"],
    });
    expect(result.items.map((r: any) => r.reaction)).toEqual(["upvote"]);
  });

  test("clamps oversized limit to MAX_LIMIT", async () => {
    seed(
      Array.from({ length: 80 }, (_, i) =>
        row(i, { id: `id-${i}`, userId: "u" }),
      ),
    );
    const result = await service.listGiven({ userId: "u", limit: 10000 });
    expect(result.items.length).toBe(50);
  });
});

describe("reactionService.listByUser", () => {
  test("rejects oversized targetIds", async () => {
    seed([]);
    const targetIds = Array.from({ length: 1001 }, (_, i) => `t-${i}`);
    await expect(service.listByUser({ targetIds })).rejects.toBeInstanceOf(
      TargetIdsOverflowError,
    );
  });

  test("returns empty when targetIds is empty", async () => {
    seed([row(1, { id: "id-a", userId: "u" })]);
    const result = await service.listByUser({ targetIds: [] });
    expect(result).toEqual({ items: [], nextCursor: null });
  });

  test("excludes excludeUserId and respects type filter", async () => {
    seed([
      row(1, {
        id: "id-a",
        userId: "owner",
        targetId: "t-1",
        reaction: "upvote",
      }),
      row(2, {
        id: "id-b",
        userId: "alice",
        targetId: "t-1",
        reaction: "upvote",
      }),
      row(3, {
        id: "id-c",
        userId: "bob",
        targetId: "t-1",
        reaction: "downvote",
      }),
    ]);
    const result = await service.listByUser({
      targetIds: ["t-1"],
      excludeUserId: "owner",
      reactions: ["upvote"],
    });
    expect(result.items.map((r: any) => r.userId)).toEqual(["alice"]);
  });

  test("paginates via cursor across multiple calls", async () => {
    seed([
      row(1, { id: "id-a", userId: "alice", targetId: "t-1" }),
      row(2, { id: "id-b", userId: "bob", targetId: "t-1" }),
      row(3, { id: "id-c", userId: "carol", targetId: "t-1" }),
    ]);
    const first = await service.listByUser({
      targetIds: ["t-1"],
      limit: 2,
    });
    expect(first.items.length).toBe(2);
    const second = await service.listByUser({
      targetIds: ["t-1"],
      limit: 2,
      cursor: first.nextCursor ?? undefined,
    });
    expect(second.items.length).toBe(1);
    expect(second.nextCursor).toBeNull();
  });

  test("rejects malformed cursor", async () => {
    seed([row(1, { id: "id-a", targetId: "t-1" })]);
    await expect(
      service.listByUser({ targetIds: ["t-1"], cursor: "garbage~~~" }),
    ).rejects.toBeInstanceOf(MalformedCursorError);
  });
});

describe("reactionService scoped reactions", () => {
  test("allows the same reaction in direct and realm scopes and aggregates globally", async () => {
    seed([]);

    await service.create("u", "t-1", "upvote");
    await service.create("u", "t-1", "upvote", "realm:realm-1");
    await service.create("u", "t-1", "upvote", "realm:realm-2");

    await expect(service.getUserReactions("u", ["t-1"])).resolves.toEqual({
      "t-1": ["upvote"],
    });
    await expect(
      service.getUserReactions("u", ["t-1"], "realm:realm-1"),
    ).resolves.toEqual({ "t-1": ["upvote"] });
    await expect(service.getSummary(["t-1"])).resolves.toEqual({
      "t-1": { upvote: 3 },
    });
    await expect(service.getSummary(["t-1"], "realm:realm-2")).resolves.toEqual(
      {
        "t-1": { upvote: 1 },
      },
    );
  });

  test("rejects active quota overflow across scopes and releases quota on delete", async () => {
    seed([]);

    await service.create("u", "t-1", "upvote");
    await service.create("u", "t-1", "downvote", "realm:realm-1");
    await service.create("u", "t-1", "upvote", "realm:realm-2");

    await expect(
      service.create("u", "t-1", "downvote", "realm:realm-3"),
    ).rejects.toBeInstanceOf(ReactionQuotaExceededError);

    await service.remove("u", "t-1", "upvote", "realm:realm-2");
    await expect(
      service.create("u", "t-1", "downvote", "realm:realm-3"),
    ).resolves.toMatchObject({ created: true });
  });

  test("list filters can select a reaction scope", async () => {
    seed([
      row(1, { id: "direct", userId: "u", scopeKey: "direct" }),
      row(2, { id: "realm", userId: "u", scopeKey: "realm:realm-1" }),
    ]);

    const result = await service.listGiven({
      userId: "u",
      scopeKey: "realm:realm-1",
    });

    expect(result.items.map((item: any) => item.id)).toEqual(["realm"]);
  });
});

// Round-trip the encode helper to keep the cursor predicate honest.
test("encodeCursor produces a string consumable by listGiven", async () => {
  seed([
    row(5, { id: "id-e", userId: "u" }),
    row(4, { id: "id-d", userId: "u" }),
  ]);
  const cursor = encodeCursor({
    createdAt: new Date(2026, 0, 1, 0, 0, 5),
    id: "id-e",
  });
  const result = await service.listGiven({ userId: "u", cursor });
  expect(result.items.map((r: any) => r.id)).toEqual(["id-d"]);
});

describe("reactionService share intent", () => {
  test("records one share per user and target", async () => {
    seed([]);

    await expect(service.recordShare("u-1", "target-1")).resolves.toEqual({
      targetId: "target-1",
      shareCount: 1,
      created: true,
    });
    await expect(service.recordShare("u-1", "target-1")).resolves.toEqual({
      targetId: "target-1",
      shareCount: 1,
      created: false,
    });
    await expect(service.recordShare("u-2", "target-1")).resolves.toEqual({
      targetId: "target-1",
      shareCount: 2,
      created: true,
    });
  });

  test("share recording does not consume active reaction quota", async () => {
    seed([]);

    await service.recordShare("u", "t-1");
    await service.recordShare("u", "t-1");
    await service.create("u", "t-1", "upvote");
    await service.create("u", "t-1", "downvote", "realm:realm-1");
    await expect(
      service.create("u", "t-1", "upvote", "realm:realm-2"),
    ).resolves.toMatchObject({ created: true });
  });

  test("reads batched share summaries with zero defaults", async () => {
    seed([]);

    await service.recordShare("u-1", "target-1");
    await service.recordShare("u-2", "target-1");

    await expect(
      service.getShareSummary(["target-1", "target-2"]),
    ).resolves.toEqual({
      "target-1": { shareCount: 2 },
      "target-2": { shareCount: 0 },
    });
  });
});
