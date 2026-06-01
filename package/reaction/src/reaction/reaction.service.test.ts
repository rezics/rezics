import { beforeAll, describe, expect, mock, test } from "bun:test";

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
const summaries = new Map<
  string,
  { targetId: string; reaction: string; scopeKey: string; count: number }
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

const findManyMock = mock(async (args: any) => {
  const where = args?.where ?? {};
  let rows = [...allRows];

  if (typeof where.userId === "string") {
    rows = rows.filter((r) => r.userId === where.userId);
  } else if (where.userId?.not) {
    rows = rows.filter((r) => r.userId !== where.userId.not);
  }
  if (where.targetId?.in) {
    const set = new Set<string>(where.targetId.in);
    rows = rows.filter((r) => set.has(r.targetId));
  }
  if (where.reaction?.in) {
    const set = new Set<string>(where.reaction.in);
    rows = rows.filter((r) => set.has(r.reaction));
  }
  if (typeof where.scopeKey === "string") {
    rows = rows.filter((r) => r.scopeKey === where.scopeKey);
  }

  if (Array.isArray(where.OR)) {
    const cursorBranch = where.OR.find((b: any) => b.createdAt?.lt);
    const cursorEqualBranch = where.OR.find((b: any) => Array.isArray(b.AND));
    if (cursorBranch && cursorEqualBranch) {
      const cutoff: Date = cursorBranch.createdAt.lt;
      const equalAnd = cursorEqualBranch.AND;
      const equalDate: Date = equalAnd[0].createdAt;
      const idLt: string = equalAnd[1].id.lt;
      rows = rows.filter(
        (r) =>
          r.createdAt.getTime() < cutoff.getTime() ||
          (r.createdAt.getTime() === equalDate.getTime() && r.id < idLt),
      );
    }
  }

  rows.sort((a, b) => {
    const t = b.createdAt.getTime() - a.createdAt.getTime();
    if (t !== 0) return t;
    return b.id.localeCompare(a.id);
  });

  if (typeof args?.take === "number") rows = rows.slice(0, args.take);
  return rows;
});

const prismaMock: any = {
  $transaction: async (fn: any) => fn(prismaMock),
  reaction: {
    findMany: findManyMock,
    findUnique: mock(async ({ where }: any) => {
      const compound = where.userId_targetId_reaction_scopeKey;
      return (
        allRows.find((row) => reactionKey(row) === reactionKey(compound)) ??
        null
      );
    }),
    create: mock(async ({ data }: any) => {
      const created = row(allRows.length + 1, {
        id: `created-${allRows.length + 1}`,
        userId: data.userId,
        targetId: data.targetId,
        reaction: data.reaction,
        scopeKey: data.scopeKey,
      });
      allRows.push(created);
      return created;
    }),
    delete: mock(async ({ where }: any) => {
      const compound = where.userId_targetId_reaction_scopeKey;
      const index = allRows.findIndex(
        (row) => reactionKey(row) === reactionKey(compound),
      );
      const [deleted] = allRows.splice(index, 1);
      return deleted;
    }),
  },
  reactionSummary: {
    findMany: mock(async ({ where }: any) => {
      let rows = Array.from(summaries.values());
      if (where?.targetId?.in) {
        const ids = new Set(where.targetId.in);
        rows = rows.filter((row) => ids.has(row.targetId));
      }
      if (where?.scopeKey) {
        rows = rows.filter((row) => row.scopeKey === where.scopeKey);
      }
      return rows;
    }),
    groupBy: mock(async ({ where }: any) => {
      const ids = new Set(where.targetId.in);
      const grouped = new Map<
        string,
        { targetId: string; reaction: string; _sum: { count: number } }
      >();
      for (const row of summaries.values()) {
        if (!ids.has(row.targetId)) continue;
        const key = `${row.targetId}|${row.reaction}`;
        const current = grouped.get(key) ?? {
          targetId: row.targetId,
          reaction: row.reaction,
          _sum: { count: 0 },
        };
        current._sum.count += row.count;
        grouped.set(key, current);
      }
      return Array.from(grouped.values());
    }),
    upsert: mock(async ({ where, create, update }: any) => {
      const key = summaryKey(where.targetId_reaction_scopeKey);
      const current = summaries.get(key);
      if (current) {
        current.count += update.count.increment;
        return current;
      }
      summaries.set(key, { ...create });
      return summaries.get(key);
    }),
    update: mock(async ({ where, data }: any) => {
      const key = summaryKey(where.targetId_reaction_scopeKey);
      const current = summaries.get(key);
      if (!current) throw new Error("summary missing");
      current.count += data.count.decrement;
      return current;
    }),
  },
  reactionTargetUsage: {
    fields: { maxActive: Symbol("maxActive") },
    upsert: mock(async ({ where, create }: any) => {
      const key = usageKey(where.userId_targetId);
      const current = usages.get(key);
      if (current) return current;
      usages.set(key, { ...create });
      return usages.get(key);
    }),
    updateMany: mock(async ({ where, data }: any) => {
      const key = usageKey(where);
      const current = usages.get(key);
      if (!current || current.activeCount >= current.maxActive)
        return { count: 0 };
      current.activeCount += data.activeCount.increment;
      return { count: 1 };
    }),
    update: mock(async ({ where, data }: any) => {
      const current = usages.get(usageKey(where.userId_targetId));
      if (!current) throw new Error("usage missing");
      current.activeCount -= data.activeCount.decrement;
      return current;
    }),
  },
};

mock.module("#/prisma/client", () => ({
  prisma: prismaMock,
}));

let service: any;
let TargetIdsOverflowError: any;
let MalformedCursorError: any;
let ReactionQuotaExceededError: any;
let encodeCursor: any;

beforeAll(async () => {
  const mod = await import("./reaction.service");
  service = mod.reactionService;
  TargetIdsOverflowError = mod.TargetIdsOverflowError;
  MalformedCursorError = mod.MalformedCursorError;
  ReactionQuotaExceededError = mod.ReactionQuotaExceededError;
  const cursorMod = await import("./cursor");
  encodeCursor = cursorMod.encodeCursor;
});

function seed(rows: FakeReactionRow[]) {
  allRows = rows;
  summaries.clear();
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
    reaction: "like",
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
      cursor: first.nextCursor,
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
      row(1, { id: "id-a", userId: "u", reaction: "like" }),
      row(2, { id: "id-b", userId: "u", reaction: "dislike" }),
    ]);
    const result = await service.listGiven({
      userId: "u",
      reactions: ["like"],
    });
    expect(result.items.map((r: any) => r.reaction)).toEqual(["like"]);
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
        reaction: "like",
      }),
      row(2, {
        id: "id-b",
        userId: "alice",
        targetId: "t-1",
        reaction: "like",
      }),
      row(3, {
        id: "id-c",
        userId: "bob",
        targetId: "t-1",
        reaction: "dislike",
      }),
    ]);
    const result = await service.listByUser({
      targetIds: ["t-1"],
      excludeUserId: "owner",
      reactions: ["like"],
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
      cursor: first.nextCursor,
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

    await service.create("u", "t-1", "like");
    await service.create("u", "t-1", "like", "realm:realm-1");
    await service.create("u", "t-1", "like", "realm:realm-2");

    await expect(service.getUserReactions("u", ["t-1"])).resolves.toEqual({
      "t-1": ["like"],
    });
    await expect(
      service.getUserReactions("u", ["t-1"], "realm:realm-1"),
    ).resolves.toEqual({ "t-1": ["like"] });
    await expect(service.getSummary(["t-1"])).resolves.toEqual({
      "t-1": { like: 3 },
    });
    await expect(service.getSummary(["t-1"], "realm:realm-2")).resolves.toEqual(
      {
        "t-1": { like: 1 },
      },
    );
  });

  test("rejects active quota overflow across scopes and releases quota on delete", async () => {
    seed([]);

    await service.create("u", "t-1", "like");
    await service.create("u", "t-1", "dislike", "realm:realm-1");
    await service.create("u", "t-1", "like", "realm:realm-2");

    await expect(
      service.create("u", "t-1", "dislike", "realm:realm-3"),
    ).rejects.toBeInstanceOf(ReactionQuotaExceededError);

    await service.remove("u", "t-1", "like", "realm:realm-2");
    await expect(
      service.create("u", "t-1", "dislike", "realm:realm-3"),
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
