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
