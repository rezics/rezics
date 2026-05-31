import { afterEach, describe, expect, mock, test } from "bun:test";
import { installPrismaClientMock, prismaMock } from "@/test/prisma-client-mock";
import { AppError } from "@/utils/errors";

installPrismaClientMock();

const unitFindFirstMock = mock(async () => null as { id: string } | null);
const unitFindUniqueOrThrowMock = mock(async () => ({
  type: "BOOK",
  post: null,
}));

Object.assign(prismaMock, {
  unit: {
    findFirst: unitFindFirstMock,
    findUniqueOrThrow: unitFindUniqueOrThrowMock,
  },
});

afterEach(() => {
  unitFindFirstMock.mockClear();
  unitFindUniqueOrThrowMock.mockClear();
  unitFindFirstMock.mockResolvedValue(null);
});

describe("CollectionService — missing favorites shelf", () => {
  test("toggleFavorite throws 404 with system_shelf_missing when shelf absent", async () => {
    const { collectionService } = await import("./collection.service");

    let captured: AppError | null = null;
    try {
      await collectionService.toggleFavorite("user-x", "unit-x");
    } catch (err) {
      captured = err as AppError;
    }

    expect(captured).toBeInstanceOf(AppError);
    expect(captured?.statusCode).toBe(404);
    expect(captured?.code).toBe("system_shelf_missing");
    expect(captured?.details).toEqual({ kindKey: "favorites" });
  });

  test("getCollectionStatus throws 404 when favorites shelf absent", async () => {
    const { collectionService } = await import("./collection.service");

    let captured: AppError | null = null;
    try {
      await collectionService.getCollectionStatus("user-y", "unit-y");
    } catch (err) {
      captured = err as AppError;
    }

    expect(captured).toBeInstanceOf(AppError);
    expect(captured?.statusCode).toBe(404);
    expect(captured?.code).toBe("system_shelf_missing");
  });
});

describe("CollectionService — user collection metadata", () => {
  test("collect writes metadata to the resolved interaction target", async () => {
    const upsert = mock(async () => ({}));
    const deleteMany = mock(async () => ({ count: 0 }));
    const createMany = mock(async () => ({ count: 1 }));

    Object.assign(prismaMock, {
      unit: {
        findUniqueOrThrow: unitFindUniqueOrThrowMock,
      },
      $transaction: async (fn: any) =>
        fn({
          userUnitCollection: { upsert },
          userTagApplication: { deleteMany, createMany },
        }),
    });

    const { collectionService } = await import("./collection.service");
    const result = await collectionService.collect("user-1", {
      targetId: "book-1",
      shelfIds: [],
      tagUnitIds: ["tag-1"],
      searchText: "private alias",
    });

    expect(result).toEqual({ savedTo: [], isNew: false });
    expect(upsert).toHaveBeenCalledWith({
      where: { userId_unitId: { userId: "user-1", unitId: "book-1" } },
      create: {
        userId: "user-1",
        unitId: "book-1",
        searchText: "private alias",
      },
      update: { searchText: "private alias" },
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
});
