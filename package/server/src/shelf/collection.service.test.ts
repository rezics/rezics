import { afterEach, describe, expect, mock, test } from "bun:test";
import type {
  CollectionRepository,
  CollectionService,
} from "./collection.service";

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
  overrides: Partial<CollectionRepository> = {},
): CollectionRepository {
  return {
    findFavoritesShelfId: mock(async () => null),
    getUnitTarget: mock(async (_targetId: string) => ({
      type: "BOOK" as const,
      targetUnitId: null,
      postKind: null,
    })),
    listUnitTargets: mock(async (targetIds: string[]) =>
      targetIds.map((id) => ({
        id,
        type: "BOOK" as const,
        targetUnitId: null,
        postKind: null,
      })),
    ),
    applyCollectionMetadata: mock(async () => {}),
    collectToShelves: mock(async () => ({ savedTo: [], isNew: false })),
    hasShelfItem: mock(async () => false),
    removeFavorite: mock(async () => {}),
    addFavorite: mock(async () => {}),
    listDirectShelfIds: mock(async () => []),
    listReviewShelfIds: mock(async () => []),
    listShelfTitles: mock(async () => []),
    ...overrides,
  };
}

async function createService(repository: CollectionRepository) {
  const module = await import("./collection.service");
  return new module.CollectionService(repository) as CollectionService;
}

afterEach(() => {
  enqueueMock.mockClear();
});

describe("CollectionService — missing favorites shelf", () => {
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

  test("getCollectionStatus throws 404 when favorites shelf absent", async () => {
    const service = await createService(createRepositoryStub());

    let captured: TestAppError | null = null;
    try {
      await service.getCollectionStatus("user-y", "unit-y");
    } catch (err) {
      captured = err as TestAppError;
    }

    expect(captured).toBeInstanceOf(TestAppError);
    expect(captured?.statusCode).toBe(404);
    expect(captured?.code).toBe("system_shelf_missing");
  });
});

describe("CollectionService — user collection metadata", () => {
  test("collect writes tags to the resolved interaction target and note text to shelf items", async () => {
    const repository = createRepositoryStub();
    const service = await createService(repository);

    const result = await service.collect("user-1", {
      targetId: "book-1",
      shelfIds: [],
      tagUnitIds: ["tag-1"],
      searchText: "private alias",
    });

    expect(result).toEqual({ savedTo: [], isNew: false });
    expect(repository.applyCollectionMetadata).toHaveBeenCalledWith({
      userId: "user-1",
      unitId: "book-1",
      tagUnitIds: ["tag-1"],
    });
    expect(repository.collectToShelves).toHaveBeenCalledWith({
      userId: "user-1",
      resolved: {
        parentUnitId: "book-1",
        parentKind: "book",
      },
      variantUnitId: undefined,
      searchText: "private alias",
      shelfIds: [],
    });
  });

  test("collect stores variant context on the primary shelf item", async () => {
    const repository = createRepositoryStub({
      collectToShelves: mock(async () => ({
        savedTo: ["shelf-1"],
        isNew: true,
      })),
    });
    const service = await createService(repository);

    const result = await service.collect("user-1", {
      targetId: "main-1",
      variantUnitId: "variant-1",
      shelfIds: ["shelf-1"],
    });

    expect(result).toEqual({ savedTo: ["shelf-1"], isNew: true });
    expect(repository.collectToShelves).toHaveBeenCalledWith({
      userId: "user-1",
      resolved: {
        parentUnitId: "main-1",
        parentKind: "book",
      },
      variantUnitId: "variant-1",
      shelfIds: ["shelf-1"],
    });
    expect(enqueueMock).toHaveBeenCalledTimes(1);
  });

  test("collect attaches review posts under their target work by default", async () => {
    const repository = createRepositoryStub({
      getUnitTarget: mock(async (targetId: string) => {
        if (targetId === "review-1") {
          return {
            type: "POST" as const,
            targetUnitId: "book-1",
            postKind: "REVIEW" as const,
          };
        }
        return {
          type: "BOOK" as const,
          targetUnitId: null,
          postKind: null,
        };
      }),
    });
    const service = await createService(repository);

    await service.collect("user-1", {
      targetId: "review-1",
      shelfIds: ["shelf-1"],
    });

    expect(repository.collectToShelves).toHaveBeenCalledWith({
      userId: "user-1",
      resolved: {
        parentUnitId: "book-1",
        parentKind: "book",
        reviewUnitId: "review-1",
        reviewKind: "review",
      },
      variantUnitId: undefined,
      searchText: undefined,
      shelfIds: ["shelf-1"],
    });
  });

  test("collect can save another shelf as a shelf item", async () => {
    const repository = createRepositoryStub({
      getUnitTarget: mock(async () => ({
        type: "SHELF" as const,
        targetUnitId: null,
        postKind: null,
      })),
    });
    const service = await createService(repository);

    await service.collect("user-1", {
      targetId: "shelf-target",
      shelfIds: ["saved-shelf"],
      searchText: "reference shelf",
    });

    expect(repository.collectToShelves).toHaveBeenCalledWith({
      userId: "user-1",
      resolved: {
        parentUnitId: "shelf-target",
        parentKind: "shelf",
      },
      variantUnitId: undefined,
      searchText: "reference shelf",
      shelfIds: ["saved-shelf"],
    });
  });
});
