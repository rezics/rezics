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

class UnitServiceStub {}

mock.module("@/unit/unit.service", () => ({
  UnitService: UnitServiceStub,
  unitService: {
    getBySlug: async (_scope: string, slug: string) => {
      if (slug === "book") return { id: "tag-1", type: "TAG" };
      if (slug === "rezics") return { id: "realm-1", type: "REALM" };
      return null;
    },
  },
}));

const tagStub = { id: "tag-1", slug: "book", type: "TAG", translations: [] };
const prismaMock = {
  unitTag: {
    findMany: async () => [],
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
      return prismaMock.unitTag.findMany({
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
      return prismaMock.unitTag.findMany({
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
