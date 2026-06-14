import { afterEach, describe, expect, mock, test } from "bun:test";
import type {
  ShelfItemActionRepository,
  ShelfItemActionService,
} from "./shelf-item-action.service";

const enqueueMock = mock(async () => ({ status: "created" }));
class TestAppError extends Error {
  statusCode: number;
  code?: string;
  details?: unknown;

  constructor(
    statusCode: number,
    message: string,
    options?: { code?: string; details?: unknown },
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = options?.code;
    this.details = options?.details;
  }
}

mock.module("@/job/job-boundary", () => ({
  serverJobProducer: {
    enqueue: enqueueMock,
  },
}));
mock.module("@/utils/errors", () => ({
  AppError: TestAppError,
}));

function createRepositoryStub(
  overrides: Partial<ShelfItemActionRepository> = {},
): ShelfItemActionRepository {
  return {
    findFavoritesShelfId: mock(async () => null),
    getUnitTarget: mock(async (_targetId: string) => ({
      type: "BOOK" as const,
      catalogEntryKind: "MAIN" as const,
      targetUnitId: null,
      postKind: null,
    })),
    listUnitTargets: mock(async (targetIds: string[]) =>
      targetIds.map((id) => ({
        id,
        type: "BOOK" as const,
        catalogEntryKind: "MAIN" as const,
        targetUnitId: null,
        postKind: null,
      })),
    ),
    applyShelfItemMetadata: mock(async () => {}),
    addToShelves: mock(async () => ({ savedTo: [], isNew: false })),
    hasShelfItem: mock(async () => false),
    hasVariantShelfItem: mock(async () => false),
    removeFavorite: mock(async () => {}),
    addFavorite: mock(async () => {}),
    listDirectShelfIds: mock(async () => []),
    listReviewShelfIds: mock(async () => []),
    listVariantShelfIds: mock(async () => []),
    listShelfTitles: mock(async () => []),
    ...overrides,
  };
}

async function createService(repository: ShelfItemActionRepository) {
  const module = await import("./shelf-item-action.service");
  return new module.ShelfItemActionService(
    repository,
  ) as ShelfItemActionService;
}

afterEach(() => {
  enqueueMock.mockClear();
});

describe("ShelfItemActionService — missing favorites shelf", () => {
  test("toggleFavorite throws 404 with system_shelf_missing when shelf absent", async () => {
    const service = await createService(createRepositoryStub());

    let captured: TestAppError | null = null;
    try {
      await service.toggleFavorite("user-x", "unit-x");
    } catch (err) {
      captured = err as TestAppError;
    }

    expect(captured).toBeInstanceOf(TestAppError);
    expect(captured?.statusCode).toBe(404);
    expect(captured?.code).toBe("system_shelf_missing");
    expect(captured?.details).toEqual({ kindKey: "favorites" });
  });

  test("getShelfItemStatus throws 404 when favorites shelf absent", async () => {
    const service = await createService(createRepositoryStub());

    let captured: TestAppError | null = null;
    try {
      await service.getShelfItemStatus("user-y", "unit-y");
    } catch (err) {
      captured = err as TestAppError;
    }

    expect(captured).toBeInstanceOf(TestAppError);
    expect(captured?.statusCode).toBe(404);
    expect(captured?.code).toBe("system_shelf_missing");
  });
});

describe("ShelfItemActionService — user shelf item metadata", () => {
  test("addToShelves writes tags to the resolved interaction target and note text to shelf items", async () => {
    const repository = createRepositoryStub();
    const service = await createService(repository);

    const result = await service.addToShelves("user-1", {
      targetId: "book-1",
      shelfIds: [],
      tagUnitIds: ["tag-1"],
      searchText: "private alias",
    });

    expect(result).toEqual({ savedTo: [], isNew: false });
    expect(repository.applyShelfItemMetadata).toHaveBeenCalledWith({
      userId: "user-1",
      unitId: "book-1",
      tagUnitIds: ["tag-1"],
    });
    expect(repository.addToShelves).toHaveBeenCalledWith({
      userId: "user-1",
      resolved: {
        parentUnitId: "book-1",
        parentKind: "book",
      },
      searchText: "private alias",
      shelfIds: [],
    });
  });

  test("addToShelves attaches a resolved variant under its main target", async () => {
    const repository = createRepositoryStub({
      getUnitTarget: mock(async (targetId: string) => {
        if (targetId === "variant-1") {
          return {
            type: "BOOK" as const,
            catalogEntryKind: "VARIANT" as const,
            targetUnitId: "main-1",
            postKind: null,
          };
        }
        return {
          type: "BOOK" as const,
          catalogEntryKind: "MAIN" as const,
          targetUnitId: null,
          postKind: null,
        };
      }),
      addToShelves: mock(async () => ({
        savedTo: ["shelf-1"],
        isNew: true,
      })),
    });
    const service = await createService(repository);

    const result = await service.addToShelves("user-1", {
      targetId: "main-1",
      variantUnitId: "variant-1",
      shelfIds: ["shelf-1"],
    });

    expect(result).toEqual({ savedTo: ["shelf-1"], isNew: true });
    expect(repository.addToShelves).toHaveBeenCalledWith({
      userId: "user-1",
      resolved: {
        parentUnitId: "main-1",
        parentKind: "book",
        variantUnitId: "variant-1",
        variantKind: "book",
      },
      shelfIds: ["shelf-1"],
    });
    expect(enqueueMock).toHaveBeenCalledTimes(1);
  });

  test("addToShelves rejects arbitrary variant hints instead of storing weak context", async () => {
    const repository = createRepositoryStub({
      getUnitTarget: mock(async (targetId: string) => {
        if (targetId === "missing-variant") {
          throw new Error("Unit not found: missing-variant");
        }
        return {
          type: "BOOK" as const,
          catalogEntryKind: "MAIN" as const,
          targetUnitId: null,
          postKind: null,
        };
      }),
    });
    const service = await createService(repository);

    await expect(
      service.addToShelves("user-1", {
        targetId: "main-1",
        variantUnitId: "missing-variant",
        shelfIds: ["shelf-1"],
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "invalid_variant_unit",
    });
    expect(repository.addToShelves).not.toHaveBeenCalled();
  });

  test("addToShelves rejects selected variants that do not point to the main target", async () => {
    const repository = createRepositoryStub({
      getUnitTarget: mock(async (targetId: string) => {
        if (targetId === "variant-1") {
          return {
            type: "BOOK" as const,
            catalogEntryKind: "VARIANT" as const,
            targetUnitId: "other-main",
            postKind: null,
          };
        }
        return {
          type: "BOOK" as const,
          catalogEntryKind: "MAIN" as const,
          targetUnitId: null,
          postKind: null,
        };
      }),
    });
    const service = await createService(repository);

    await expect(
      service.addToShelves("user-1", {
        targetId: "main-1",
        variantUnitId: "variant-1",
        shelfIds: ["shelf-1"],
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "variant_target_mismatch",
    });
    expect(repository.addToShelves).not.toHaveBeenCalled();
  });

  test("addToShelves attaches review posts under their target work by default", async () => {
    const repository = createRepositoryStub({
      getUnitTarget: mock(async (targetId: string) => {
        if (targetId === "review-1") {
          return {
            type: "POST" as const,
            catalogEntryKind: "NONE" as const,
            targetUnitId: "book-1",
            postKind: "REVIEW" as const,
          };
        }
        return {
          type: "BOOK" as const,
          catalogEntryKind: "MAIN" as const,
          targetUnitId: null,
          postKind: null,
        };
      }),
    });
    const service = await createService(repository);

    await service.addToShelves("user-1", {
      targetId: "review-1",
      shelfIds: ["shelf-1"],
    });

    expect(repository.addToShelves).toHaveBeenCalledWith({
      userId: "user-1",
      resolved: {
        parentUnitId: "book-1",
        parentKind: "book",
        reviewUnitId: "review-1",
        reviewKind: "review",
      },
      searchText: undefined,
      shelfIds: ["shelf-1"],
    });
  });

  test("addToShelves can save another shelf as a shelf item", async () => {
    const repository = createRepositoryStub({
      getUnitTarget: mock(async () => ({
        type: "SHELF" as const,
        catalogEntryKind: "NONE" as const,
        targetUnitId: null,
        postKind: null,
      })),
    });
    const service = await createService(repository);

    await service.addToShelves("user-1", {
      targetId: "shelf-target",
      shelfIds: ["saved-shelf"],
      searchText: "reference shelf",
    });

    expect(repository.addToShelves).toHaveBeenCalledWith({
      userId: "user-1",
      resolved: {
        parentUnitId: "shelf-target",
        parentKind: "shelf",
      },
      searchText: "reference shelf",
      shelfIds: ["saved-shelf"],
    });
  });
});

describe("ShelfItemActionService — variant shelf items", () => {
  test("direct VARIANT targets resolve to main root plus variant child", async () => {
    const repository = createRepositoryStub({
      getUnitTarget: mock(async (targetId: string) => {
        if (targetId === "variant-1") {
          return {
            type: "BOOK" as const,
            catalogEntryKind: "VARIANT" as const,
            targetUnitId: "main-1",
            postKind: null,
          };
        }
        return {
          type: "BOOK" as const,
          catalogEntryKind: "MAIN" as const,
          targetUnitId: null,
          postKind: null,
        };
      }),
    });
    const service = await createService(repository);

    await service.addToShelves("user-1", {
      targetId: "variant-1",
      shelfIds: ["shelf-1"],
    });

    expect(repository.addToShelves).toHaveBeenCalledWith({
      userId: "user-1",
      resolved: {
        parentUnitId: "main-1",
        parentKind: "book",
        variantUnitId: "variant-1",
        variantKind: "book",
      },
      searchText: undefined,
      shelfIds: ["shelf-1"],
    });
  });

  test("variant favorite toggles by child occurrence", async () => {
    const repository = createRepositoryStub({
      findFavoritesShelfId: mock(async () => "favorites-1"),
      getUnitTarget: mock(async (targetId: string) => {
        if (targetId === "variant-1") {
          return {
            type: "BOOK" as const,
            catalogEntryKind: "VARIANT" as const,
            targetUnitId: "main-1",
            postKind: null,
          };
        }
        return {
          type: "BOOK" as const,
          catalogEntryKind: "MAIN" as const,
          targetUnitId: null,
          postKind: null,
        };
      }),
      hasVariantShelfItem: mock(async () => true),
    });
    const service = await createService(repository);

    const result = await service.toggleFavorite("user-1", "variant-1");

    expect(result).toEqual({ isFavorited: false });
    expect(repository.hasVariantShelfItem).toHaveBeenCalledWith(
      "favorites-1",
      "variant-1",
    );
    expect(repository.removeFavorite).toHaveBeenCalledWith({
      shelfId: "favorites-1",
      resolved: {
        parentUnitId: "main-1",
        parentKind: "book",
        variantUnitId: "variant-1",
        variantKind: "book",
      },
    });
    expect(repository.hasShelfItem).not.toHaveBeenCalled();
  });

  test("variant status comes from variant child shelf rows", async () => {
    const repository = createRepositoryStub({
      findFavoritesShelfId: mock(async () => "favorites-1"),
      getUnitTarget: mock(async (targetId: string) => {
        if (targetId === "variant-1") {
          return {
            type: "BOOK" as const,
            catalogEntryKind: "VARIANT" as const,
            targetUnitId: "main-1",
            postKind: null,
          };
        }
        return {
          type: "BOOK" as const,
          catalogEntryKind: "MAIN" as const,
          targetUnitId: null,
          postKind: null,
        };
      }),
      listVariantShelfIds: mock(async () => [
        { childUnitId: "variant-1", shelfId: "favorites-1" },
        { childUnitId: "variant-1", shelfId: "shelf-2" },
      ]),
      listShelfTitles: mock(async () => [
        { id: "favorites-1", title: "Favorites" },
        { id: "shelf-2", title: "Editions" },
      ]),
    });
    const service = await createService(repository);

    const result = await service.getShelfItemStatus("user-1", "variant-1");

    expect(result).toEqual({
      isFavorited: true,
      shelves: [
        { id: "favorites-1", title: "Favorites" },
        { id: "shelf-2", title: "Editions" },
      ],
    });
    expect(repository.listVariantShelfIds).toHaveBeenCalledWith({
      userId: "user-1",
      variantUnitIds: ["variant-1"],
    });
    expect(repository.listDirectShelfIds).not.toHaveBeenCalled();
  });

  test("batch status separates main roots from variant children", async () => {
    const repository = createRepositoryStub({
      findFavoritesShelfId: mock(async () => "favorites-1"),
      listUnitTargets: mock(async (targetIds: string[]) =>
        targetIds.map((id) => {
          if (id === "variant-1") {
            return {
              id,
              type: "BOOK" as const,
              catalogEntryKind: "VARIANT" as const,
              targetUnitId: "main-1",
              postKind: null,
            };
          }
          return {
            id,
            type: "BOOK" as const,
            catalogEntryKind: "MAIN" as const,
            targetUnitId: null,
            postKind: null,
          };
        }),
      ),
      listDirectShelfIds: mock(async () => [
        { unitId: "main-1", shelfId: "main-shelf" },
      ]),
      listVariantShelfIds: mock(async () => [
        { childUnitId: "variant-1", shelfId: "favorites-1" },
      ]),
      listShelfTitles: mock(async () => [
        { id: "main-shelf", title: "Main" },
        { id: "favorites-1", title: "Favorites" },
      ]),
    });
    const service = await createService(repository);

    const result = await service.getShelfItemStatusBatch("user-1", [
      "main-1",
      "variant-1",
    ]);

    expect(result.statusesByTarget).toEqual({
      "main-1": {
        isFavorited: false,
        shelves: [{ id: "main-shelf", title: "Main" }],
      },
      "variant-1": {
        isFavorited: true,
        shelves: [{ id: "favorites-1", title: "Favorites" }],
      },
    });
    expect(repository.listDirectShelfIds).toHaveBeenCalledWith({
      userId: "user-1",
      unitIds: ["main-1"],
    });
    expect(repository.listVariantShelfIds).toHaveBeenCalledWith({
      userId: "user-1",
      variantUnitIds: ["variant-1"],
    });
  });
});
