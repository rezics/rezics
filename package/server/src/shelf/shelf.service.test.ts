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

  test("addItem syncs containedUnitIds to Meilisearch after the canonical write", async () => {
    patchContentContainedUnitIdsToMeiliMock.mockClear();

    Object.assign(prismaMock, {
      unit: {
        findUnique: async () => ({ type: "BOOK", post: null }),
      },
      shelfItem: {
        findFirst: async () => null,
        findUniqueOrThrow: async () => ({
          shelfUnitId: "shelf-1",
          itemRef: "book-1",
          kind: "book",
          position: "a0",
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      },
      $transaction: async (fn: any) =>
        fn({
          shelfItem: {
            createMany: async () => ({ count: 1 }),
            findUniqueOrThrow: async () => ({
              shelfUnitId: "shelf-1",
              itemRef: "book-1",
              kind: "book",
              position: "a0",
              createdAt: new Date(),
              updatedAt: new Date(),
            }),
          },
          shelf: {
            update: async () => ({}),
          },
          shelfUnit: {
            upsert: async () => ({}),
          },
        }),
    });

    // buildShelfItemProjection reads shelfUnit + unit; its mapper tolerates undefined.
    Object.assign(prismaMock, {
      ...prismaMock,
      shelfUnit: {
        findMany: async () => [],
      },
    });

    const { shelfService } = await import("./shelf.service");
    await shelfService.addItem("shelf-1", { itemRef: "book-1", kind: "book" });

    expect(patchContentContainedUnitIdsToMeiliMock).toHaveBeenCalledTimes(1);
    expect(patchContentContainedUnitIdsToMeiliMock).toHaveBeenCalledWith(
      "shelf-1",
    );
  });

  test("addItem rejects direct self-containment", async () => {
    const { shelfService } = await import("./shelf.service");

    await expect(
      shelfService.addItem("shelf-1", { itemRef: "shelf-1", kind: "shelf" }),
    ).rejects.toThrow(/cannot contain itself/);
  });

  test("mapUnitToKind maps shelves to shelf items", async () => {
    const { mapUnitToKind } = await import("./shelf.service");

    expect(mapUnitToKind("SHELF" as any, null)).toBe("shelf");
  });

  test("applyBatch rejects payloads above the configured cap", async () => {
    const { shelfService, SHELF_ITEM_BATCH_OP_CAP } = await import(
      "./shelf.service"
    );

    const ops = Array.from({ length: SHELF_ITEM_BATCH_OP_CAP + 1 }, (_, i) => ({
      op: "delete" as const,
      itemRef: `i-${i}`,
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
          shelfItem: {
            createMany: async (_args: any) => {
              applied.push("createMany");
              return { count: 1 };
            },
            deleteMany: async (_args: any) => {
              applied.push("deleteMany");
              return { count: 1 };
            },
            update: async (_args: any) => {
              applied.push("update");
              return {
                shelfUnitId: "shelf-1",
                itemRef: "b-1",
                kind: "book",
                position: "z0",
                createdAt: new Date(),
                updatedAt: new Date(),
              };
            },
            findUniqueOrThrow: async (_args: any) => ({
              shelfUnitId: "shelf-1",
              itemRef: "b-1",
              kind: "book",
              position: "a0",
              createdAt: new Date(),
              updatedAt: new Date(),
            }),
          },
          shelf: {
            update: async () => ({}),
          },
          shelfUnit: {
            upsert: async () => ({}),
            findMany: async () => [],
            deleteMany: async () => ({ count: 0 }),
            create: async () => ({}),
          },
        }),
      shelfItem: {
        findUnique: async () => ({
          shelfUnitId: "shelf-1",
          itemRef: "b-1",
          kind: "book",
          position: "z0",
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      },
      shelfUnit: {
        findMany: async () => [],
      },
    });

    const { shelfService } = await import("./shelf.service");
    const results = await shelfService.applyBatch("shelf-1", [
      { op: "delete", itemRef: "old" },
      { op: "add", itemRef: "b-1", kind: "book", position: "a0" },
      { op: "reorder", itemRef: "b-1", position: "z0" },
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
          shelfItem: {
            deleteMany: async () => ({ count: 1 }),
            update: async () => {
              throw new Error("Record to update not found");
            },
            findUniqueOrThrow: async () => ({
              shelfUnitId: "shelf-1",
              itemRef: "x",
              kind: "book",
              position: "a0",
              createdAt: new Date(),
              updatedAt: new Date(),
            }),
          },
          shelf: { update: async () => ({}) },
          shelfUnit: {
            upsert: async () => ({}),
            findMany: async () => [],
          },
        }),
      shelfItem: {
        findUnique: async () => null,
      },
      shelfUnit: { findMany: async () => [] },
    });

    const { shelfService } = await import("./shelf.service");
    const results = await shelfService.applyBatch("shelf-1", [
      { op: "delete", itemRef: "x" },
      { op: "reorder", itemRef: "missing", position: "a1" },
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
          shelfItem: {
            findMany: async ({ skip, take }: any) => {
              if (skip === 0 && take === 1) return [{ position: "m" }];
              return [];
            },
            update: async ({ data }: any) => ({
              shelfUnitId: "shelf-1",
              itemRef: "moved",
              kind: "book",
              position: data.position,
              createdAt: new Date(),
              updatedAt: new Date(),
            }),
          },
          shelf: { update: async () => ({}) },
          shelfUnit: { findMany: async () => [] },
        }),
      shelfItem: {
        findUnique: async () => ({
          shelfUnitId: "shelf-1",
          itemRef: "moved",
          kind: "book",
          position: "a",
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      },
      shelfUnit: { findMany: async () => [] },
    });

    const { shelfService } = await import("./shelf.service");
    const results = await shelfService.applyBatch("shelf-1", [
      {
        op: "reorderToPage",
        itemRef: "moved",
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
        itemRef: "moved",
        toPage: 99,
        edge: "first",
        pageSize: 20,
        order: "asc",
      },
    ]);
    expect(oor[0]!.status).toBe("failed");
  });

  test("removeItem syncs containedUnitIds to Meilisearch after the canonical delete", async () => {
    patchContentContainedUnitIdsToMeiliMock.mockClear();

    Object.assign(prismaMock, {
      $transaction: async (fn: any) =>
        fn({
          shelfItem: {
            deleteMany: async () => ({ count: 1 }),
          },
          shelf: {
            update: async () => ({}),
          },
        }),
    });

    const { shelfService } = await import("./shelf.service");
    await shelfService.removeItem("shelf-1", "book-1");

    expect(patchContentContainedUnitIdsToMeiliMock).toHaveBeenCalledTimes(1);
    expect(patchContentContainedUnitIdsToMeiliMock).toHaveBeenCalledWith(
      "shelf-1",
    );
  });
});
