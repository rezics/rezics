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
    expect(patchContentContainedUnitIdsToMeiliMock).toHaveBeenCalledWith("shelf-1");
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
    expect(patchContentContainedUnitIdsToMeiliMock).toHaveBeenCalledWith("shelf-1");
  });
});
