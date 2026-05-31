import { describe, expect, mock, test } from "bun:test";
import { installPrismaClientMock, prismaMock } from "@/test/prisma-client-mock";

installPrismaClientMock();

const SEED_TAG_ID_BY_NAME: Record<string, string> = {
  book: "11111111-1111-1111-1111-111111111111",
  game: "22222222-2222-2222-2222-222222222222",
  media: "33333333-3333-3333-3333-333333333333",
  post: "44444444-4444-4444-4444-444444444444",
  link: "55555555-5555-5555-5555-555555555555",
};

mock.module("@/infra/seed-tags", () => ({
  getSeedTagId: (name: string) => SEED_TAG_ID_BY_NAME[name] ?? null,
  initSeedTagsCache: async () => undefined,
  getSeedTagsSnapshot: () => ({ ...SEED_TAG_ID_BY_NAME }),
}));

const enqueueMock = mock(async (_command: any) => ({ status: "created" }));
const contentSearchMock = mock(async (_query: string, _options?: any) => ({
  hits: [],
}));
const collectionSearchMock = mock(async (_query: string, _options?: any) => ({
  hits: [],
}));

mock.module("@/meili/content/sync", () => ({
  patchContentMetadataToMeili: async () => undefined,
  patchContentRealmIdsToMeili: async () => undefined,
  patchContentRealmTagKeysToMeili: async () => undefined,
  patchContentTagsToMeili: async () => undefined,
  patchContentCreditsToMeili: async () => undefined,
  patchContentTranslationsToMeili: async () => undefined,
  syncContentToMeili: async () => undefined,
  deleteContentFromMeili: async () => undefined,
}));
mock.module("@/job/job-boundary", () => ({
  serverJobProducer: {
    enqueue: enqueueMock,
  },
}));
mock.module("@/meili/search-client", () => ({
  searchClient: {
    contentIndex: { search: contentSearchMock },
    collectionIndex: { search: collectionSearchMock },
  },
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

function makeShelfListRow(overrides: Record<string, unknown> = {}) {
  return {
    unitId: "shelf-1",
    kindKey: "custom",
    extra: null,
    itemCount: 1,
    createdAt: new Date("2026-05-27T00:00:00.000Z"),
    updatedAt: new Date("2026-05-27T00:00:00.000Z"),
    unit: {
      id: "shelf-1",
      slug: "shelf",
      userId: null,
      status: "PUBLISHED",
      visibility: "PUBLIC",
      licenseSlug: null,
      defaultLanguage: "en",
      createdAt: new Date("2026-05-27T00:00:00.000Z"),
      updatedAt: new Date("2026-05-27T00:00:00.000Z"),
      user: null,
      translations: [],
      unitTags: [],
    },
    ...overrides,
  };
}

describe("ShelfService", () => {
  test("list filters public discovery by published public shelves containing the target Unit", async () => {
    let findManyArgs: any;
    Object.assign(prismaMock, {
      shelf: {
        findMany: async (args: any) => {
          findManyArgs = args;
          return [];
        },
        count: async () => 0,
      },
      unitWork: {
        findFirst: async () => null,
      },
    });

    const { shelfService } = await import("./shelf.service");
    await shelfService.list({ containsUnitId: "book-1", limit: 10 });

    expect(findManyArgs.where).toMatchObject({
      AND: [
        {
          unit: {
            type: "SHELF",
            status: "PUBLISHED",
            visibility: "PUBLIC",
          },
        },
        { units: { some: { unitId: "book-1" } } },
      ],
    });
  });

  test("list hydrates the matched contained unit for exact results", async () => {
    Object.assign(prismaMock, {
      shelf: {
        findMany: async () => [makeShelfListRow()],
        count: async () => 1,
      },
      shelfUnit: {
        findMany: async () => [
          {
            shelfId: "shelf-1",
            unitId: "release-1",
            kind: "book",
            unit: {
              defaultLanguage: "en",
              translations: [{ language: "en", title: "Contained Release" }],
            },
          },
        ],
      },
    });

    const { shelfService } = await import("./shelf.service");
    const result = await shelfService.list({
      containsUnitId: "release-1",
      limit: 10,
    });

    expect(result.shelves[0]?.matchedUnit).toEqual({
      unitId: "release-1",
      kind: "book",
      title: "Contained Release",
    });
  });

  test("rejects reserved system shelf kind keys on create", async () => {
    const { shelfService } = await import("./shelf.service");

    await expect(
      shelfService.create({ title: "Favorites", kindKey: "favorites" }, "u1"),
    ).rejects.toThrow(/reserved/);
    await expect(
      shelfService.create({ title: "Backlog", kindKey: "backlog" }, "u1"),
    ).rejects.toThrow(/reserved/);
  });

  test("addUnit enqueues containedUnitIds sync after the canonical write", async () => {
    enqueueMock.mockClear();

    Object.assign(prismaMock, {
      unit: {
        findUnique: async () => ({ type: "BOOK", post: null }),
      },
      shelfUnit: {
        findMany: async () => [],
      },
      unitWork: {
        findMany: async () => [],
        deleteMany: async () => ({ count: 0 }),
        upsert: async () => ({}),
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

    expect(enqueueMock).toHaveBeenCalledTimes(1);
    expect(enqueueMock.mock.calls[0]?.[0]).toMatchObject({
      kind: "search.content.patchContainedUnitIds",
      payload: { unitId: "shelf-1" },
      source: { type: "server", service: "shelf" },
    });
  });

  test("addUnit writes optional user collection metadata", async () => {
    enqueueMock.mockClear();
    const upsert = mock(async () => ({}));
    const deleteMany = mock(async () => ({ count: 0 }));
    const createMany = mock(async () => ({ count: 1 }));

    Object.assign(prismaMock, {
      unit: {
        findUnique: async () => ({ type: "BOOK", post: null }),
      },
      shelfUnit: {
        findMany: async () => [],
      },
      unitWork: {
        findMany: async () => [],
        deleteMany: async () => ({ count: 0 }),
        upsert: async () => ({}),
      },
      $transaction: async (fn: any) =>
        fn({
          shelfUnit: {
            findFirst: async () => null,
            createMany: async () => ({ count: 1 }),
            findUniqueOrThrow: async () => makeShelfUnitRow(),
          },
          shelf: { update: async () => ({}) },
          userUnitCollection: { upsert },
          userTagApplication: { deleteMany, createMany },
        }),
    });

    const { shelfService } = await import("./shelf.service");
    await shelfService.addUnit(
      "shelf-1",
      {
        unitId: "book-1",
        kind: "book",
        tagUnitIds: ["tag-1"],
        searchText: null,
      },
      "user-1",
    );

    expect(upsert).toHaveBeenCalledWith({
      where: { userId_unitId: { userId: "user-1", unitId: "book-1" } },
      create: { userId: "user-1", unitId: "book-1", searchText: null },
      update: { searchText: null },
    });
    expect(deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1", unitId: "book-1" },
    });
    expect(createMany).toHaveBeenCalledWith({
      data: [
        {
          userId: "user-1",
          unitId: "book-1",
          tagUnitId: "tag-1",
          position: "00000000",
        },
      ],
      skipDuplicates: true,
    });
  });

  test("getShelfUnits filters q matches through public content search hits", async () => {
    contentSearchMock.mockClear();
    collectionSearchMock.mockClear();
    contentSearchMock.mockResolvedValueOnce({ hits: [{ id: "book-2" }] });

    let findManyArgs: any;
    Object.assign(prismaMock, {
      shelf: {
        findUnique: async () => ({ unit: { userId: "owner-1" } }),
      },
      shelfUnit: {
        findMany: async (args: any) => {
          findManyArgs = args;
          return [makeShelfUnitRow({ unitId: "book-2" })];
        },
      },
      shelfUnitRelation: { findMany: async () => [] },
    });

    const { shelfService } = await import("./shelf.service");
    const result = await shelfService.getShelfUnits(
      "shelf-1",
      { q: "translated title", limit: 20 },
      { viewerUserId: "viewer-1" },
    );

    expect(result.units.map((unit) => unit.unitId)).toEqual(["book-2"]);
    expect(findManyArgs.where).toEqual({
      shelfId: "shelf-1",
      unitId: { in: ["book-2"] },
    });
    expect(collectionSearchMock).not.toHaveBeenCalled();
  });

  test("getShelfUnits includes owner-private collection q matches for the owner", async () => {
    contentSearchMock.mockClear();
    collectionSearchMock.mockClear();
    contentSearchMock.mockResolvedValueOnce({ hits: [] });
    collectionSearchMock.mockResolvedValueOnce({
      hits: [{ unitId: "book-3" }],
    });

    let findManyArgs: any;
    Object.assign(prismaMock, {
      shelf: {
        findUnique: async () => ({ unit: { userId: "owner-1" } }),
      },
      shelfUnit: {
        findMany: async (args: any) => {
          findManyArgs = args;
          return [makeShelfUnitRow({ unitId: "book-3" })];
        },
      },
      shelfUnitRelation: { findMany: async () => [] },
    });

    const { shelfService } = await import("./shelf.service");
    await shelfService.getShelfUnits(
      "shelf-1",
      { q: "private note" },
      { viewerUserId: "owner-1" },
    );

    expect(collectionSearchMock).toHaveBeenCalledWith("private note", {
      limit: 1000,
      filter: 'ownerUserId = "owner-1"',
      attributesToRetrieve: ["unitId"],
    });
    expect(findManyArgs.where.unitId.in).toEqual(["book-3"]);
  });

  test("getShelfUnits intersects owner tag filters with q matches", async () => {
    contentSearchMock.mockClear();
    collectionSearchMock.mockClear();
    contentSearchMock.mockResolvedValueOnce({
      hits: [{ id: "book-1" }, { id: "book-2" }],
    });
    collectionSearchMock.mockResolvedValueOnce({ hits: [] });

    let findManyArgs: any;
    Object.assign(prismaMock, {
      shelf: {
        findUnique: async () => ({ unit: { userId: "owner-1" } }),
      },
      userTagApplication: {
        findMany: async ({ where }: any) => {
          expect(where).toEqual({
            userId: "owner-1",
            tagUnitId: { in: ["tag-a", "tag-b"] },
          });
          return [
            { unitId: "book-1", tagUnitId: "tag-a" },
            { unitId: "book-1", tagUnitId: "tag-b" },
            { unitId: "book-2", tagUnitId: "tag-a" },
          ];
        },
      },
      shelfUnit: {
        findMany: async (args: any) => {
          findManyArgs = args;
          return [makeShelfUnitRow({ unitId: "book-1" })];
        },
      },
      shelfUnitRelation: { findMany: async () => [] },
    });

    const { shelfService } = await import("./shelf.service");
    await shelfService.getShelfUnits(
      "shelf-1",
      { q: "space", tagUnitIds: ["tag-a", "tag-b", "tag-a"] },
      { viewerUserId: "owner-1" },
    );

    expect(findManyArgs.where.unitId.in).toEqual(["book-1"]);
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
    enqueueMock.mockClear();

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
            findUniqueOrThrow: async () => makeShelfUnitRow({ unitId: "b-1" }),
          },
          shelf: { update: async () => ({}) },
        }),
      shelfUnit: {
        findMany: async () => [],
        findUnique: async () =>
          makeShelfUnitRow({ unitId: "b-1", position: "z0" }),
      },
      unitWork: {
        findMany: async () => [],
        deleteMany: async () => ({ count: 0 }),
        upsert: async () => ({}),
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
    expect(enqueueMock).toHaveBeenCalledTimes(1);
  });

  test("applyBatch records per-op failure without rolling back successful ops", async () => {
    enqueueMock.mockClear();

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
      shelfUnit: { findMany: async () => [], findUnique: async () => null },
      unitWork: {
        findMany: async () => [],
        deleteMany: async () => ({ count: 0 }),
        upsert: async () => ({}),
      },
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
    enqueueMock.mockClear();

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

  test("create persists tagIds as pinned UnitTag rows", async () => {
    const captured: { unitTagsCreate?: any[] } = {};
    Object.assign(prismaMock, {
      unit: {
        create: async ({ data }: any) => {
          captured.unitTagsCreate = data?.unitTags?.create;
          return { id: "shelf-new" };
        },
      },
      shelf: {
        create: async () => ({
          unitId: "shelf-new",
          extra: null,
          itemCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          unit: {
            userId: "u1",
            user: null,
            defaultLanguage: "en",
            translations: [],
            unitTags: [],
          },
        }),
      },
    });

    const { shelfService } = await import("./shelf.service");
    await shelfService.create(
      {
        title: "My Shelf",
        tagIds: [SEED_TAG_ID_BY_NAME.book!, SEED_TAG_ID_BY_NAME.media!],
      },
      "u1",
    );

    expect(captured.unitTagsCreate).toBeDefined();
    expect(captured.unitTagsCreate).toHaveLength(2);
    expect(captured.unitTagsCreate![0]!.pinned).toBe(true);
    expect(captured.unitTagsCreate![1]!.pinned).toBe(true);
  });

  test("create rejects non-seed tagIds", async () => {
    Object.assign(prismaMock, {});

    const { shelfService } = await import("./shelf.service");
    let status = 0;
    let message = "";
    try {
      await shelfService.create(
        {
          title: "My Shelf",
          tagIds: ["99999999-9999-9999-9999-999999999999"],
        },
        "u1",
      );
    } catch (err) {
      status = (err as { statusCode?: number }).statusCode ?? 0;
      message = (err as Error).message;
    }
    expect(status).toBe(400);
    expect(message).toBe("invalid-pin-target");
  });

  test("setPinnedTags inserts added rows only (insert-only diff)", async () => {
    const calls: { op: string; payload?: any }[] = [];
    Object.assign(prismaMock, {
      shelf: {
        findUnique: async () => ({ unit: { userId: "u1" } }),
      },
      $transaction: async (fn: any) =>
        fn({
          unitTag: {
            findMany: async ({ select }: any) => {
              if (select?.tagUnitId && !select.score) {
                return []; // initial existing
              }
              return [
                {
                  tagUnitId: SEED_TAG_ID_BY_NAME.book,
                  score: 0,
                },
              ];
            },
            deleteMany: async (args: any) => {
              calls.push({ op: "deleteMany", payload: args });
              return { count: 0 };
            },
            createMany: async (args: any) => {
              calls.push({ op: "createMany", payload: args });
              return { count: args.data?.length ?? 0 };
            },
          },
        }),
    });

    const { shelfService } = await import("./shelf.service");
    const result = await shelfService.setPinnedTags(
      "shelf-1",
      [SEED_TAG_ID_BY_NAME.book!],
      "u1",
    );

    expect(calls.find((c) => c.op === "createMany")).toBeDefined();
    expect(calls.find((c) => c.op === "deleteMany")).toBeUndefined();
    expect(result.tags).toHaveLength(1);
    expect(result.tags[0]!.tagUnitId).toBe(SEED_TAG_ID_BY_NAME.book!);
  });

  test("setPinnedTags deletes removed rows only (delete-only diff)", async () => {
    const calls: { op: string; payload?: any }[] = [];
    Object.assign(prismaMock, {
      shelf: {
        findUnique: async () => ({ unit: { userId: "u1" } }),
      },
      $transaction: async (fn: any) =>
        fn({
          unitTag: {
            findMany: async ({ select }: any) => {
              if (select?.tagUnitId && !select.score) {
                return [
                  { tagUnitId: SEED_TAG_ID_BY_NAME.book },
                  { tagUnitId: SEED_TAG_ID_BY_NAME.media },
                ];
              }
              return [{ tagUnitId: SEED_TAG_ID_BY_NAME.book, score: 0 }];
            },
            deleteMany: async (args: any) => {
              calls.push({ op: "deleteMany", payload: args });
              return { count: args.where.tagUnitId.in.length };
            },
            createMany: async (args: any) => {
              calls.push({ op: "createMany", payload: args });
              return { count: 0 };
            },
          },
        }),
    });

    const { shelfService } = await import("./shelf.service");
    await shelfService.setPinnedTags(
      "shelf-1",
      [SEED_TAG_ID_BY_NAME.book!],
      "u1",
    );

    const del = calls.find((c) => c.op === "deleteMany");
    expect(del).toBeDefined();
    expect(del!.payload.where.tagUnitId.in).toEqual([
      SEED_TAG_ID_BY_NAME.media!,
    ]);
    expect(calls.find((c) => c.op === "createMany")).toBeUndefined();
  });

  test("setPinnedTags performs mixed-diff insert + delete", async () => {
    const calls: { op: string; payload?: any }[] = [];
    Object.assign(prismaMock, {
      shelf: {
        findUnique: async () => ({ unit: { userId: "u1" } }),
      },
      $transaction: async (fn: any) =>
        fn({
          unitTag: {
            findMany: async ({ select }: any) => {
              if (select?.tagUnitId && !select.score) {
                return [{ tagUnitId: SEED_TAG_ID_BY_NAME.book }];
              }
              return [{ tagUnitId: SEED_TAG_ID_BY_NAME.game, score: 0 }];
            },
            deleteMany: async (args: any) => {
              calls.push({ op: "deleteMany", payload: args });
              return { count: 1 };
            },
            createMany: async (args: any) => {
              calls.push({ op: "createMany", payload: args });
              return { count: args.data?.length ?? 0 };
            },
          },
        }),
    });

    const { shelfService } = await import("./shelf.service");
    await shelfService.setPinnedTags(
      "shelf-1",
      [SEED_TAG_ID_BY_NAME.game!],
      "u1",
    );

    const del = calls.find((c) => c.op === "deleteMany");
    const create = calls.find((c) => c.op === "createMany");
    expect(del!.payload.where.tagUnitId.in).toEqual([
      SEED_TAG_ID_BY_NAME.book!,
    ]);
    expect(create!.payload.data.map((r: any) => r.tagUnitId)).toEqual([
      SEED_TAG_ID_BY_NAME.game!,
    ]);
  });

  test("setPinnedTags is idempotent — same set yields no row churn", async () => {
    const calls: string[] = [];
    Object.assign(prismaMock, {
      shelf: {
        findUnique: async () => ({ unit: { userId: "u1" } }),
      },
      $transaction: async (fn: any) =>
        fn({
          unitTag: {
            findMany: async ({ select }: any) => {
              if (select?.tagUnitId && !select.score) {
                return [{ tagUnitId: SEED_TAG_ID_BY_NAME.book }];
              }
              return [{ tagUnitId: SEED_TAG_ID_BY_NAME.book, score: 0 }];
            },
            deleteMany: async () => {
              calls.push("deleteMany");
              return { count: 0 };
            },
            createMany: async () => {
              calls.push("createMany");
              return { count: 0 };
            },
          },
        }),
    });

    const { shelfService } = await import("./shelf.service");
    await shelfService.setPinnedTags(
      "shelf-1",
      [SEED_TAG_ID_BY_NAME.book!],
      "u1",
    );
    expect(calls).toEqual([]);
  });

  test("setPinnedTags rejects non-owner", async () => {
    Object.assign(prismaMock, {
      shelf: {
        findUnique: async () => ({ unit: { userId: "owner" } }),
      },
    });

    const { shelfService } = await import("./shelf.service");
    let status = 0;
    try {
      await shelfService.setPinnedTags(
        "shelf-1",
        [SEED_TAG_ID_BY_NAME.book!],
        "intruder",
      );
    } catch (err) {
      status = (err as { statusCode?: number }).statusCode ?? 0;
    }
    expect(status).toBe(403);
  });

  test("setPinnedTags rejects non-seed identifiers", async () => {
    Object.assign(prismaMock, {
      shelf: {
        findUnique: async () => ({ unit: { userId: "u1" } }),
      },
    });

    const { shelfService } = await import("./shelf.service");
    let status = 0;
    let message = "";
    try {
      await shelfService.setPinnedTags(
        "shelf-1",
        ["99999999-9999-9999-9999-999999999999"],
        "u1",
      );
    } catch (err) {
      status = (err as { statusCode?: number }).statusCode ?? 0;
      message = (err as Error).message;
    }
    expect(status).toBe(400);
    expect(message).toBe("invalid-pin-target");
  });

  test("getByOwnerAndSlug returns 200-shaped payload for a system slug", async () => {
    Object.assign(prismaMock, {
      unit: {
        findFirst: async ({ where }: any) => {
          if (
            where.type === "SHELF" &&
            where.slug === "favorites" &&
            where.slugScope === "alice-unit"
          ) {
            return { id: "favorites-unit" };
          }
          return null;
        },
      },
      shelf: {
        findUnique: async ({ where }: any) => {
          if (where.unitId !== "favorites-unit") return null;
          return {
            unitId: "favorites-unit",
            kindKey: "favorites",
            extra: null,
            itemCount: 0,
            pinnedTagOrder: [],
            createdAt: new Date(),
            updatedAt: new Date(),
            unit: {
              id: "favorites-unit",
              type: "SHELF",
              slug: "favorites",
              slugScope: "alice-unit",
              userId: "alice-unit",
              user: null,
              defaultLanguage: "en",
              translations: [{ language: "en", title: "Favorites" }],
              unitTags: [],
              status: "PUBLISHED",
              visibility: "PRIVATE",
              rating: "GENERAL",
              extra: null,
              createdAt: new Date(),
              updatedAt: new Date(),
              publishedAt: null,
            },
          };
        },
      },
    });

    const { shelfService } = await import("./shelf.service");
    const result = await shelfService.getByOwnerAndSlug(
      "alice-unit",
      "favorites",
    );
    expect(result).not.toBeNull();
    expect(result!.unitId).toBe("favorites-unit");
  });

  test("getByOwnerAndSlug returns null for a non-system slug", async () => {
    Object.assign(prismaMock, {
      unit: {
        findFirst: async () => ({ id: "should-not-be-read" }),
      },
    });

    const { shelfService } = await import("./shelf.service");
    const result = await shelfService.getByOwnerAndSlug(
      "alice-unit",
      "my-custom-list",
    );
    expect(result).toBeNull();
  });

  test("getByOwnerAndSlug returns null when no matching unit exists", async () => {
    Object.assign(prismaMock, {
      unit: { findFirst: async () => null },
    });

    const { shelfService } = await import("./shelf.service");
    const result = await shelfService.getByOwnerAndSlug(
      "ghost-user-unit",
      "favorites",
    );
    expect(result).toBeNull();
  });

  test("removeUnit enqueues containedUnitIds sync after the canonical delete", async () => {
    enqueueMock.mockClear();

    Object.assign(prismaMock, {
      $transaction: async (fn: any) =>
        fn({
          shelfUnit: { deleteMany: async () => ({ count: 1 }) },
          shelf: { update: async () => ({}) },
        }),
      shelfUnit: {
        findMany: async () => [],
      },
      unitWork: {
        findMany: async () => [],
        deleteMany: async () => ({ count: 0 }),
        upsert: async () => ({}),
      },
    });

    const { shelfService } = await import("./shelf.service");
    await shelfService.removeUnit("shelf-1", "book-1");

    expect(enqueueMock).toHaveBeenCalledTimes(1);
    expect(enqueueMock.mock.calls[0]?.[0]).toMatchObject({
      kind: "search.content.patchContainedUnitIds",
      payload: { unitId: "shelf-1" },
    });
  });
});
