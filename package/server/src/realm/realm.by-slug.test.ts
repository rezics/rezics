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
  isAdminRole: () => false,
  verifyAdminFromDb: async () => true,
  verifyRootFromDb: async () => true,
}));

mock.module("@/governance", () => ({
  governanceRoutePolicyService: {
    decideForIdentity: async () => ({ allowed: true }),
  },
  realmPolicyActions: new Proxy({}, { get: (_target, key) => key }),
}));

mock.module("@/utils/sanitizeUser", () => ({
  sanitizeUser: (user: unknown) => user,
  mapPublicUser: (user: unknown) => user,
}));

const realmDTOStub = {
  unitId: "realm-1",
  slug: "rezics",
  isPublic: true,
  isOfficial: true,
  memberCount: 1,
};
const legacyDbMock = {
  unitRealm: {
    findMany: async (_args?: unknown) => [],
    create: async (input: { data: unknown }) => input.data,
    delete: async (_args?: unknown) => undefined,
  },
  realmTagApplication: {
    findMany: async (_args?: unknown) => [],
  },
};

class UnitServiceStub {}

mock.module("@/unit/unit.service", () => ({
  UnitService: UnitServiceStub,
  unitService: {
    getBySlug: async (_scope: string, slug: string) => {
      if (slug === "rezics") return { id: "realm-1", type: "REALM" };
      if (slug === "book") return { id: "tag-1", type: "TAG" };
      return null;
    },
  },
}));

mock.module("@/unit/language-resolution", () => ({
  resolveEffectiveReadLanguageCandidates: () => ["en"],
}));

mock.module("./realm.service", () => ({
  REALM_TAG_VISIBILITY_THRESHOLD: -100,
  RealmService: class {
    private async patchPostRealmIds(unitId: string) {
      const { patchPostFieldsToMeili } = await import("@/meili/post/sync");
      const rows = await legacyDbMock.unitRealm.findMany({
        where: { unitId },
        select: { realmUnitId: true },
        orderBy: { realmUnitId: "asc" },
      });
      await patchPostFieldsToMeili(unitId, {
        realmIds: rows.map((row: { realmUnitId: string }) => row.realmUnitId),
      });
    }
    async addUnitRealm(realmUnitId: string, unitId: string) {
      const row = await legacyDbMock.unitRealm.create({
        data: { realmUnitId, unitId },
      });
      this.patchPostRealmIds(unitId).catch(() => {});
      return row;
    }
    async removeUnitRealm(realmUnitId: string, unitId: string) {
      await legacyDbMock.unitRealm.delete({
        where: { realmUnitId_unitId: { realmUnitId, unitId } },
      });
      this.patchPostRealmIds(unitId).catch(() => {});
    }
    async listRealmTagsForUnit(
      realmUnitId: string,
      unitId: string,
      opts?: { includeBelowThreshold?: boolean },
    ) {
      return legacyDbMock.realmTagApplication.findMany({
        where: opts?.includeBelowThreshold
          ? { realmUnitId, unitId }
          : { realmUnitId, unitId, score: { gt: -100 } },
        orderBy: [
          { pinned: "desc" },
          { position: "asc" },
          { score: "desc" },
          { tagUnitId: "asc" },
        ],
      });
    }
    async listLowScoreRealmTagApplications(
      threshold: number,
      limit: number,
      realmUnitId?: string,
    ) {
      return legacyDbMock.realmTagApplication.findMany({
        where: {
          score: { lte: threshold },
          ...(realmUnitId ? { realmUnitId } : {}),
        },
        orderBy: [
          { score: "asc" },
          { realmUnitId: "asc" },
          { unitId: "asc" },
          { tagUnitId: "asc" },
        ],
        take: Math.max(1, Math.min(limit, 200)),
      });
    }
  },
  realmService: {
    getByUnitId: async () => realmDTOStub,
  },
}));

describe("GET /realm/by-slug/:slug", () => {
  test("returns realm when slug resolves to REALM", async () => {
    const { realmApi } = await import("./realm.api");
    const res = await realmApi.handle(
      new Request("http://localhost/realm/by-slug/rezics"),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(realmDTOStub);
  });

  test("returns 404 when slug does not exist", async () => {
    const { realmApi } = await import("./realm.api");
    const res = await realmApi.handle(
      new Request("http://localhost/realm/by-slug/does-not-exist"),
    );
    expect(res.status).toBe(404);
  });

  test("returns 404 when slug resolves to non-REALM unit", async () => {
    const { realmApi } = await import("./realm.api");
    const res = await realmApi.handle(
      new Request("http://localhost/realm/by-slug/book"),
    );
    expect(res.status).toBe(404);
  });
});
