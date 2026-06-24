import { describe, expect, mock, test } from "bun:test";
import { Elysia } from "elysia";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/rezics_book";
process.env.AUTH_BASE_URL ??= "http://localhost:3001";

mock.module("@/middleware", () => ({
  authMacro: new Elysia({ name: "macro/auth" }).macro("requireLogin", {
    resolve: () => ({
      identity: {
        sub: "t",
        userId: "t",
        permission: { role: "ADMIN" },
      },
    }),
  }),
  tryResolveIdentity: async () => null,
  isAdminRole: () => true,
  verifyAdminFromDb: async () => true,
  verifyRootFromDb: async () => true,
}));

mock.module("@/governance", () => ({
  governanceRoutePolicyService: {
    decideForIdentity: async () => ({ allowed: true }),
  },
  realmPolicyActions: new Proxy({}, { get: (_target, key) => key }),
}));

function buildUnitWhereClause(options: Record<string, any>) {
  const andWhere: Array<Record<string, unknown>> = [];
  if (options.q?.trim()) {
    const q = options.q.trim();
    andWhere.push({
      OR: [
        { id: q },
        { slug: { contains: q, mode: "insensitive" } },
        {
          translations: {
            some: { title: { contains: q, mode: "insensitive" } },
          },
        },
      ],
    });
  }
  if (options.id?.trim()) andWhere.push({ id: options.id.trim() });
  if (options.slug?.trim()) {
    andWhere.push({
      slug: { contains: options.slug.trim(), mode: "insensitive" },
    });
  }
  if (options.title?.trim()) {
    andWhere.push({
      translations: {
        some: {
          title: { contains: options.title.trim(), mode: "insensitive" },
        },
      },
    });
  }
  const typeList = (options.types ?? options.type ?? "")
    .split(",")
    .map((s: string) => s.trim())
    .filter(Boolean);
  if (typeList.length > 0) andWhere.push({ type: { in: typeList } });
  else andWhere.push({ NOT: { type: "LABEL" } });
  const statusList = (options.statuses ?? options.status ?? "")
    .split(",")
    .map((s: string) => s.trim())
    .filter(Boolean);
  if (statusList.length > 0) andWhere.push({ status: { in: statusList } });
  if (options.visibility?.trim()) {
    andWhere.push({ visibility: options.visibility });
  }
  const userList = (options.userIds ?? options.userId ?? "")
    .split(",")
    .map((s: string) => s.trim())
    .filter(Boolean);
  if (userList.length > 0) andWhere.push({ userId: { in: userList } });
  if (options.catalogEntryKind !== undefined) {
    andWhere.push({ catalogEntryKind: options.catalogEntryKind ?? null });
  }
  if (options.targetUnitId !== undefined) {
    andWhere.push({ targetUnitId: options.targetUnitId ?? null });
  }
  return { AND: andWhere };
}

class UnitServiceStub {
  constructor(private readonly repository?: any) {}
  async create(input: any) {
    const row = await this.repository?.create(input);
    if (row?.id) {
      const { serverJobProducer } = await import("@/job/job-boundary");
      await serverJobProducer.enqueue({
        kind: "search.content.sync",
        payload: { unitId: row.id },
        source: { type: "server" as const, service: "unit" },
      } as any);
    }
    return row;
  }
  async update(unitId: string, input: any) {
    const row = await this.repository?.update(unitId, input);
    const fields = Object.fromEntries(
      ["rating", "visibility", "catalogEntryKind", "targetUnitId"]
        .filter((key) => key in input)
        .map((key) => [key, input[key]]),
    );
    if (Object.keys(fields).length > 0) {
      const { serverJobProducer } = await import("@/job/job-boundary");
      await serverJobProducer.enqueue({
        kind: "search.content.patchMetadata",
        payload: { targetId: unitId, fields },
        source: { type: "server" as const, service: "unit" },
      } as any);
    }
    return row;
  }
  async delete(unitId: string) {
    await this.repository?.delete(unitId);
    const [{ serverJobProducer }, { cleanupReactions }] = await Promise.all([
      import("@/job/job-boundary"),
      import("@/reaction-boundary/reaction-boundary.client"),
    ]);
    await serverJobProducer.enqueue({
      kind: "search.content.delete",
      payload: { unitId },
      source: { type: "server" as const, service: "unit" },
    } as any);
    void cleanupReactions(unitId);
  }
}

mock.module("@/unit/unit.service", () => ({
  UnitService: UnitServiceStub,
  buildUnitWhereClause,
  unitService: {
    getBySlug: async (_scope: string, slug: string) => {
      if (slug === "book") return { id: "tag-1", type: "TAG" };
      if (slug === "rezics") return { id: "realm-1", type: "REALM" };
      return null;
    },
  },
}));

const tagStub = { id: "tag-1", slug: "book", type: "TAG", translations: [] };
const legacyDbMock = {
  unitTag: {
    findMany: async (_args?: unknown) => [],
  },
};

mock.module("./tag.mapper", () => ({
  mapTagUnitToDTO: (unit: unknown) => unit,
  mapUnitTagToDTO: (u: unknown) => u,
}));

mock.module("./tag.service", () => ({
  VISIBILITY_THRESHOLD: -100,
  TagService: class {
    async getTagsForUnit(
      unitId: string,
      opts?: { includeBelowThreshold?: boolean },
    ) {
      return legacyDbMock.unitTag.findMany({
        where: opts?.includeBelowThreshold
          ? { unitId }
          : { unitId, score: { gt: -100 } },
        orderBy: [
          { pinned: "desc" },
          { position: "asc" },
          { score: "desc" },
          { tagUnitId: "asc" },
        ],
      });
    }
    async listLowScoreUnitTags(threshold: number, limit: number) {
      return legacyDbMock.unitTag.findMany({
        where: { score: { lte: threshold } },
        orderBy: [{ score: "asc" }, { unitId: "asc" }, { tagUnitId: "asc" }],
        take: Math.max(1, Math.min(limit, 200)),
      });
    }
  },
  tagService: {
    getByUnitId: async () => tagStub,
  },
}));

mock.module("./tag-context.service", () => ({
  getTagContext: async () => ({}),
}));

describe("GET /tag/by-slug/:slug", () => {
  test("returns tag when slug resolves to TAG", async () => {
    const { tagApi } = await import("./tag.api");
    const res = await tagApi.handle(
      new Request("http://localhost/tag/by-slug/book"),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(tagStub);
  });

  test("returns 404 when slug does not exist", async () => {
    const { tagApi } = await import("./tag.api");
    const res = await tagApi.handle(
      new Request("http://localhost/tag/by-slug/does-not-exist"),
    );
    expect(res.status).toBe(404);
  });

  test("returns 404 when slug resolves to non-TAG unit", async () => {
    const { tagApi } = await import("./tag.api");
    const res = await tagApi.handle(
      new Request("http://localhost/tag/by-slug/rezics"),
    );
    expect(res.status).toBe(404);
  });
});
