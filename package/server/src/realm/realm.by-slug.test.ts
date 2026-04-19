import { describe, expect, mock, test } from "bun:test";
import { Elysia } from "elysia";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/rezics_book";
process.env.AUTH_BASE_URL ??= "http://localhost:3001";

mock.module("@/middleware", () => ({
  authMacro: new Elysia({ name: "macro/auth" }).macro("requireLogin", {
    resolve: () => ({
      identity: { unitId: "t", permission: { role: "ADMIN" } },
    }),
  }),
  tryResolveIdentity: async () => null,
  isAdminRole: () => false,
  verifyAdminFromDb: async () => true,
}));

const realmDTOStub = {
  unitId: "realm-1",
  slug: "rezics",
  isPublic: true,
  isOfficial: true,
  memberCount: 1,
};

mock.module("@/unit/unit.service", () => ({
  unitService: {
    getBySlug: async (slug: string) => {
      if (slug === "rezics") return { id: "realm-1", type: "REALM" };
      if (slug === "book") return { id: "tag-1", type: "TAG" };
      return null;
    },
  },
}));

mock.module("./realm.service", () => ({
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
