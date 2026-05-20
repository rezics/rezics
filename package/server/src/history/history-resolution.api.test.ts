import { beforeEach, describe, expect, mock, test } from "bun:test";
import { installPrismaClientMock, prismaMock } from "@/test/prisma-client-mock";

mock.module("@/infra/slug-scopes", () => ({
  requireSlugScopeId: () => "user-scope",
}));

mock.module("@/middleware", () => ({
  isAdminRole: (identity: any) => identity?.permission?.role === "ADMIN",
  tryResolveIdentity: async () => ({
    userId: "viewer-1",
    permission: { role: "USER" },
  }),
}));

const userFindMany = mock(async () => [
  { unitId: "actor-1", name: "Alice", avatar: null },
]);
const unitFindMany = mock(async ({ where }: any) => {
  const ids = where.id.in as string[];
  if (where.type === "USER") {
    return ids.includes("actor-1")
      ? [{ id: "actor-1", slug: "alice", status: "PUBLISHED" }]
      : [];
  }
  return [
    {
      id: "unit-public",
      type: "BOOK",
      slug: "public-book",
      status: "PUBLISHED",
      visibility: "PUBLIC",
      userId: "owner-1",
      translations: [{ title: "Public Book", language: "en" }],
    },
    {
      id: "unit-private",
      type: "BOOK",
      slug: "private-book",
      status: "PUBLISHED",
      visibility: "PRIVATE",
      userId: "owner-1",
      translations: [{ title: "Private Book", language: "en" }],
    },
    {
      id: "unit-deleted",
      type: "BOOK",
      slug: "deleted-book",
      status: "DELETED",
      visibility: "PUBLIC",
      userId: "owner-1",
      translations: [{ title: "Deleted Book", language: "en" }],
    },
  ].filter((row) => ids.includes(row.id));
});

installPrismaClientMock();
Object.assign(prismaMock, {
  user: { findMany: userFindMany },
  unit: { findMany: unitFindMany },
});

describe("historyResolutionApi", () => {
  beforeEach(() => {
    userFindMany.mockClear();
    unitFindMany.mockClear();
  });

  test("resolves actors with deleted fallback", async () => {
    const { historyResolutionApi } = await import("./history-resolution.api");
    const response = await historyResolutionApi.handle(
      new Request("http://localhost/history/resolve/actors", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: ["actor-1", "missing-actor"] }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      actors: {
        "actor-1": {
          actorUserId: "actor-1",
          status: "OK",
          displayName: "Alice",
          handle: "alice",
          avatarUrl: null,
        },
        "missing-actor": {
          actorUserId: "missing-actor",
          status: "DELETED",
        },
      },
    });
  });

  test("resolves Unit references with OK, deleted, gone, and restricted states", async () => {
    const { historyResolutionApi } = await import("./history-resolution.api");
    const response = await historyResolutionApi.handle(
      new Request("http://localhost/history/resolve/units", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ids: ["unit-public", "unit-private", "unit-deleted", "unit-gone"],
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      units: {
        "unit-public": {
          unitId: "unit-public",
          status: "OK",
          title: "Public Book",
          unitType: "BOOK",
          slug: "public-book",
        },
        "unit-private": { unitId: "unit-private", status: "RESTRICTED" },
        "unit-deleted": { unitId: "unit-deleted", status: "DELETED" },
        "unit-gone": { unitId: "unit-gone", status: "GONE" },
      },
    });
  });
});
