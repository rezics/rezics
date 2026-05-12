import { describe, expect, mock, test } from "bun:test";
import { installPrismaClientMock, prismaMock } from "@/test/prisma-client-mock";

installPrismaClientMock();

const patchContentContainedUnitIdsToMeiliMock = mock(async () => undefined);

mock.module("@/meili/content/sync", () => ({
  patchContentContainedUnitIdsToMeili: patchContentContainedUnitIdsToMeiliMock,
  patchContentMetadataToMeili: async () => undefined,
  patchContentRealmIdsToMeili: async () => undefined,
  patchContentRealmTagKeysToMeili: async () => undefined,
  patchContentTagsToMeili: async () => undefined,
  patchContentCreditsToMeili: async () => undefined,
  patchContentTranslationsToMeili: async () => undefined,
  syncContentToMeili: async () => undefined,
  deleteContentFromMeili: async () => undefined,
}));

Object.assign(prismaMock, {});

function makeShelfUnitRow(overrides: Record<string, unknown> = {}) {
  return {
    shelfId: "shelf-1",
    unitId: "book-1",
    kind: "book",
    position: "a0",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("ShelfService", () => {
  test("rejects reserved system shelf kind keys on create", async () => {
    const { shelfService } = await import("./shelf.service");

    await expect(
      shelfService.create({ title: "Favorites", kindKey: "favorites" }, "u1"),
    ).rejects.toThrow(/reserved/);
    await expect(
      shelfService.create({ title: "Backlog", kindKey: "backlog" }, "u1"),
    ).rejects.toThrow(/reserved/);
  });

  test("addUnit syncs containedUnitIds to Meilisearch after the canonical write", async () => {
    patchContentContainedUnitIdsToMeiliMock.mockClear();

    Object.assign(prismaMock, {
      unit: {
        findUnique: async () => ({ type: "BOOK", post: null }),
      },
      $transaction: async (fn: any) =>
        fn({
          shelfUnit: {
            findFirst: async () => null,
            createMany: async () => ({ count: 1 }),
            findUniqueOrThrow: async () => makeShelfUnitRow(),
          },
          shelf: { update: async () => ({}) },
        }),
    });

    const { shelfService } = await import("./shelf.service");
    await shelfService.addUnit("shelf-1", { unitId: "book-1", kind: "book" });

    expect(patchContentContainedUnitIdsToMeiliMock).toHaveBeenCalledTimes(1);
    expect(patchContentContainedUnitIdsToMeiliMock).toHaveBeenCalledWith(
      "shelf-1",
    );
  });

  test("addUnit rejects direct self-containment", async () => {
    const { shelfService } = await import("./shelf.service");

    await expect(
      shelfService.addUnit("shelf-1", { unitId: "shelf-1", kind: "shelf" }),
    ).rejects.toThrow(/cannot contain itself/);
  });

  test("mapUnitToKind maps SHELF to shelf kind", async () => {
    const { mapUnitToKind } = await import("./shelf.service");

    expect(mapUnitToKind("SHELF" as any, null)).toBe("shelf");
  });

  test("applyBatch rejects payloads above the configured cap", async () => {
    const { shelfService, SHELF_ITEM_BATCH_OP_CAP } = await import(
      "./shelf.service"
    );

    const ops = Array.from({ length: SHELF_ITEM_BATCH_OP_CAP + 1 }, (_, i) => ({
      op: "delete" as const,
      unitId: `i-${i}`,
    }));

    let status = 0;
    try {
      await shelfService.applyBatch("shelf-1", ops);
    } catch (err) {
      status = (err as { statusCode?: number }).statusCode ?? 0;
    }
    expect(status).toBe(413);
  });

  test("applyBatch applies ops in submitted order and reports per-op results", async () => {
    patchContentContainedUnitIdsToMeiliMock.mockClear();

    const applied: string[] = [];

    Object.assign(prismaMock, {
      $transaction: async (fn: any) =>
        fn({
          shelfUnit: {
            createMany: async () => {
              applied.push("createMany");
              return { count: 1 };
            },
            deleteMany: async () => {
              applied.push("deleteMany");
              return { count: 1 };
            },
            update: async () => {
              applied.push("update");
              return makeShelfUnitRow({ unitId: "b-1", position: "z0" });
            },
            findUniqueOrThrow: async () =>
              makeShelfUnitRow({ unitId: "b-1" }),
          },
          shelf: { update: async () => ({}) },
        }),
      shelfUnit: {
        findUnique: async () =>
          makeShelfUnitRow({ unitId: "b-1", position: "z0" }),
      },
    });

    const { shelfService } = await import("./shelf.service");
    const results = await shelfService.applyBatch("shelf-1", [
      { op: "delete", unitId: "old" },
      { op: "add", unitId: "b-1", kind: "book", position: "a0" },
      { op: "reorder", unitId: "b-1", position: "z0" },
    ]);

    expect(results).toHaveLength(3);
    expect(results[0]!.status).toBe("ok");
    expect(results[0]!.op.op).toBe("delete");
    expect(results[1]!.status).toBe("ok");
    expect(results[1]!.op.op).toBe("add");
    expect(results[2]!.status).toBe("ok");
    expect(results[2]!.op.op).toBe("reorder");
    expect(applied[0]).toBe("deleteMany");
    expect(patchContentContainedUnitIdsToMeiliMock).toHaveBeenCalledTimes(1);
  });

  test("applyBatch records per-op failure without rolling back successful ops", async () => {
    patchContentContainedUnitIdsToMeiliMock.mockClear();

    Object.assign(prismaMock, {
      $transaction: async (fn: any) =>
        fn({
          shelfUnit: {
            deleteMany: async () => ({ count: 1 }),
            update: async () => {
              throw new Error("Record to update not found");
            },
            findUniqueOrThrow: async () => makeShelfUnitRow({ unitId: "x" }),
          },
          shelf: { update: async () => ({}) },
        }),
      shelfUnit: { findUnique: async () => null },
    });

    const { shelfService } = await import("./shelf.service");
    const results = await shelfService.applyBatch("shelf-1", [
      { op: "delete", unitId: "x" },
      { op: "reorder", unitId: "missing", position: "a1" },
    ]);

    expect(results[0]!.status).toBe("ok");
    expect(results[1]!.status).toBe("failed");
    if (results[1]!.status === "failed") {
      expect(results[1]!.reason).toMatch(/not found/i);
    }
  });

  test("applyBatch resolves reorderToPage server-side", async () => {
    patchContentContainedUnitIdsToMeiliMock.mockClear();

    Object.assign(prismaMock, {
      $transaction: async (fn: any) =>
        fn({
          shelfUnit: {
            findMany: async ({ skip, take }: any) => {
              if (skip === 0 && take === 1) return [{ position: "m" }];
              return [];
            },
            update: async ({ data }: any) =>
              makeShelfUnitRow({ unitId: "moved", position: data.position }),
          },
          shelf: { update: async () => ({}) },
        }),
      shelfUnit: {
        findUnique: async () =>
          makeShelfUnitRow({ unitId: "moved", position: "a" }),
      },
    });

    const { shelfService } = await import("./shelf.service");
    const results = await shelfService.applyBatch("shelf-1", [
      {
        op: "reorderToPage",
        unitId: "moved",
        toPage: 1,
        edge: "first",
        pageSize: 20,
        order: "asc",
      },
    ]);
    expect(results[0]!.status).toBe("ok");

    const oor = await shelfService.applyBatch("shelf-1", [
      {
        op: "reorderToPage",
        unitId: "moved",
        toPage: 99,
        edge: "first",
        pageSize: 20,
        order: "asc",
      },
    ]);
    expect(oor[0]!.status).toBe("failed");
  });

  test("applyBatch attach op rejects self-relation", async () => {
    Object.assign(prismaMock, {
      $transaction: async (fn: any) =>
        fn({
          shelfUnit: { findUnique: async () => null },
          shelfUnitRelation: { upsert: async () => ({}) },
        }),
    });

    const { shelfService } = await import("./shelf.service");
    const results = await shelfService.applyBatch("shelf-1", [
      {
        op: "attach",
        parentUnitId: "u-1",
        childUnitId: "u-1",
        childKind: "review",
        role: "review",
      },
    ]);
    expect(results[0]!.status).toBe("failed");
    if (results[0]!.status === "failed") {
      expect(results[0]!.reason).toBe("self_relation_forbidden");
    }
  });

  test("removeUnit syncs containedUnitIds to Meilisearch after the canonical delete", async () => {
    patchContentContainedUnitIdsToMeiliMock.mockClear();

    Object.assign(prismaMock, {
      $transaction: async (fn: any) =>
        fn({
          shelfUnit: { deleteMany: async () => ({ count: 1 }) },
          shelf: { update: async () => ({}) },
        }),
    });

    const { shelfService } = await import("./shelf.service");
    await shelfService.removeUnit("shelf-1", "book-1");

    expect(patchContentContainedUnitIdsToMeiliMock).toHaveBeenCalledTimes(1);
    expect(patchContentContainedUnitIdsToMeiliMock).toHaveBeenCalledWith(
      "shelf-1",
    );
  });
});
