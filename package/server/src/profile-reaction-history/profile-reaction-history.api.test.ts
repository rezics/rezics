import { beforeAll, describe, expect, mock, test } from "bun:test";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/rezics_book";
process.env.REACTION_BASE_URL ??= "http://localhost:3003";
process.env.REACTION_INTERNAL_SECRET ??= "test-secret";

interface FakeUser {
  userId: string;
  slug?: string;
  name?: string;
  avatar?: string | null;
  bio?: string | null;
  description?: string | null;
}

interface FakeUnit {
  id: string;
  type: string;
  slug?: string | null;
  userId: string | null;
  translations: Array<{ title: string | null; description: string | null }>;
}

interface FakeReactionRow {
  id: string;
  userId: string;
  targetId: string;
  reaction: string;
  scopeKey: string;
  createdAt: string;
}

const users = new Map<string, FakeUser>();
const units = new Map<string, FakeUnit>();
const givenByUser = new Map<string, FakeReactionRow[]>();
const reactionsByTarget = new Map<string, FakeReactionRow[]>();

let internalCalls = 0;

function resetState() {
  users.clear();
  units.clear();
  givenByUser.clear();
  reactionsByTarget.clear();
  internalCalls = 0;
}

mock.module("#/prisma/client", () => ({
  prisma: {
    user: {
      findUnique: async ({ where, select }: any) => {
        const u = users.get(where.unitId ?? where.userId);
        if (!u) return null;
        if (select?.userId && Object.keys(select).length === 1) {
          return { userId: u.userId };
        }
        return { ...u, unitId: u.userId };
      },
      findMany: async ({ where, select: _select }: any) => {
        const ids = where?.unitId?.in ?? where?.userId?.in;
        if (ids) {
          const set = new Set<string>(ids);
          return Array.from(users.values())
            .filter((u) => set.has(u.userId))
            .map((u) => ({ ...u, unitId: u.userId }));
        }
        return Array.from(users.values()).map((u) => ({
          ...u,
          unitId: u.userId,
        }));
      },
    },
    unit: {
      findMany: async ({ where, select: _select, orderBy: _orderBy }: any) => {
        let rows = Array.from(units.values());
        if (where?.userId) {
          rows = rows.filter((u) => u.userId === where.userId);
        }
        if (where?.id?.in) {
          const set = new Set<string>(where.id.in);
          rows = rows.filter((u) => set.has(u.id));
        }
        if (where?.type) {
          rows = rows.filter((u) => u.type === where.type);
        }
        return rows.map((u) => ({
          id: u.id,
          type: u.type,
          slug: u.slug ?? null,
          userId: u.userId,
          translations: u.translations,
        }));
      },
    },
  },
}));

mock.module("@/middleware", () => ({
  tryResolveIdentity: async (auth: string | undefined) => {
    if (!auth) return null;
    if (auth === "Bearer alice") return { userId: "alice" };
    if (auth === "Bearer bob") return { userId: "bob" };
    return null;
  },
}));

mock.module("@/infra/slug-scopes", () => ({
  requireSlugScopeId: () => "user-scope",
}));

mock.module("@/reaction-boundary/reaction-boundary.client", () => ({
  listGivenReactions: async (q: {
    userId: string;
    cursor?: string;
    limit?: number;
  }) => {
    const all = givenByUser.get(q.userId) ?? [];
    const limit = q.limit ?? 20;
    const sliced = all.slice(0, limit);
    return {
      items: sliced,
      nextCursor: all.length > limit ? "next-given" : null,
    };
  },
  listByUser: async (body: {
    targetIds: string[];
    excludeUserId?: string;
    cursor?: string;
    limit?: number;
  }) => {
    internalCalls++;
    const set = new Set<string>(body.targetIds);
    let rows: FakeReactionRow[] = [];
    for (const t of set) rows.push(...(reactionsByTarget.get(t) ?? []));
    if (body.excludeUserId) {
      rows = rows.filter((r) => r.userId !== body.excludeUserId);
    }
    rows.sort((a, b) => {
      const t = b.createdAt.localeCompare(a.createdAt);
      if (t !== 0) return t;
      return b.id.localeCompare(a.id);
    });
    if (body.cursor) {
      rows = rows.filter((r) => r.id < body.cursor!);
    }
    const limit = body.limit ?? 20;
    return { items: rows.slice(0, limit), nextCursor: null };
  },
}));

let api: any;

beforeAll(async () => {
  const mod = await import("./profile-reaction-history.api");
  api = mod.profileReactionHistoryApi;
});

function row(
  i: number,
  partial: Partial<FakeReactionRow> = {},
): FakeReactionRow {
  return {
    id: `r${String(i).padStart(4, "0")}`,
    userId: "u-actor",
    targetId: "t-1",
    reaction: "like",
    scopeKey: "direct",
    createdAt: `2026-01-01T00:00:${String(i).padStart(2, "0")}.000Z`,
    ...partial,
  };
}

describe("GET /profile/:userId/reaction/given", () => {
  test("public profile returns hydrated rows", async () => {
    resetState();
    users.set("u1", { userId: "u1", slug: "u1", name: "U One" });
    units.set("t-1", {
      id: "t-1",
      type: "POST",
      userId: "someone-else",
      translations: [{ title: "Hello", description: "World snippet" }],
    });
    units.set("t-2", {
      id: "t-2",
      type: "BOOK",
      userId: null,
      translations: [],
    });
    givenByUser.set("u1", [
      row(2, { id: "r2", userId: "u1", targetId: "t-2" }),
      row(1, { id: "r1", userId: "u1", targetId: "t-1" }),
    ]);

    const res = await api.handle(
      new Request("http://localhost/profile/u1/reaction/given"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items.length).toBe(2);
    expect(body.items[0].target).toMatchObject({ unitId: "t-2", kind: "book" });
    expect(body.items[1].target).toMatchObject({
      unitId: "t-1",
      kind: "post",
      title: "Hello",
    });
  });

  test("403 when assertProfileViewable denies access", async () => {
    resetState();
    users.set("u-private", { userId: "u-private" });
    const svc = await import("./profile-reaction-history.service");
    const original = svc.profileReactionHistoryService.listGiven.bind(
      svc.profileReactionHistoryService,
    );
    const spy = mock(async () => {
      const { AppError } = await import("@/utils/errors");
      throw new AppError(403, "Forbidden: profile is private");
    });
    svc.profileReactionHistoryService.listGiven = spy as any;
    try {
      const res = await api.handle(
        new Request("http://localhost/profile/u-private/reaction/given"),
      );
      expect(res.status).toBe(403);
    } finally {
      svc.profileReactionHistoryService.listGiven = original;
    }
  });

  test("404 when profile user does not exist", async () => {
    resetState();
    const res = await api.handle(
      new Request("http://localhost/profile/missing/reaction/given"),
    );
    expect(res.status).toBe(404);
  });

  test("renders deleted target as null", async () => {
    resetState();
    users.set("u1", { userId: "u1" });
    givenByUser.set("u1", [
      row(1, { id: "r1", userId: "u1", targetId: "deleted" }),
    ]);

    const res = await api.handle(
      new Request("http://localhost/profile/u1/reaction/given"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items[0].target).toBeNull();
  });

  test("links realm-scoped post reactions to the realm-context route", async () => {
    resetState();
    users.set("u1", { userId: "u1" });
    units.set("realm-1", {
      id: "realm-1",
      type: "REALM",
      slug: "fiction",
      userId: null,
      translations: [],
    });
    units.set("post-1", {
      id: "post-1",
      type: "POST",
      userId: "someone-else",
      translations: [{ title: "Scoped", description: null }],
    });
    givenByUser.set("u1", [
      row(1, {
        id: "r1",
        userId: "u1",
        targetId: "post-1",
        scopeKey: "realm:realm-1",
      }),
    ]);

    const res = await api.handle(
      new Request("http://localhost/profile/u1/reaction/given"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items[0].target.href).toBe("/r/fiction/post/post-1");
  });
});

describe("GET /profile/:userId/reaction/received", () => {
  test("excludes self-reactions and hydrates actor + target", async () => {
    resetState();
    users.set("u1", { userId: "u1", slug: "u1", name: "U One" });
    users.set("alice", { userId: "alice", slug: "alice", name: "Alice" });
    units.set("t-1", {
      id: "t-1",
      type: "POST",
      userId: "u1",
      translations: [{ title: "Owned", description: null }],
    });
    reactionsByTarget.set("t-1", [
      row(1, { id: "r1", userId: "u1", targetId: "t-1" }),
      row(2, { id: "r2", userId: "alice", targetId: "t-1" }),
    ]);

    const res = await api.handle(
      new Request("http://localhost/profile/u1/reaction/received"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items.length).toBe(1);
    expect(body.items[0].actor.userId).toBe("alice");
    expect(body.items[0].target.unitId).toBe("t-1");
  });

  test("returns empty when user owns no units", async () => {
    resetState();
    users.set("u1", { userId: "u1" });
    const res = await api.handle(
      new Request("http://localhost/profile/u1/reaction/received"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ items: [], nextCursor: null });
  });

  test("paginates across multiple ownership chunks", async () => {
    resetState();
    users.set("u1", { userId: "u1" });
    users.set("alice", { userId: "alice", slug: "alice" });
    // Synthesise 1500 owned units to force two ownership chunks.
    for (let i = 0; i < 1500; i++) {
      const id = `u-${String(i).padStart(5, "0")}`;
      units.set(id, {
        id,
        type: "POST",
        userId: "u1",
        translations: [],
      });
    }
    reactionsByTarget.set("u-00000", [
      row(1, { id: "r-chunk0", userId: "alice", targetId: "u-00000" }),
    ]);
    reactionsByTarget.set("u-01200", [
      row(2, { id: "r-chunk1", userId: "alice", targetId: "u-01200" }),
    ]);

    const res = await api.handle(
      new Request("http://localhost/profile/u1/reaction/received"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    const ids = body.items.map((it: any) => it.id).sort();
    expect(ids).toEqual(["r-chunk0", "r-chunk1"]);
    expect(internalCalls).toBe(2);
  });
});
