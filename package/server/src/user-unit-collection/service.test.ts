import { describe, expect, mock, test } from "bun:test";
import { installPrismaClientMock, prismaMock } from "@/test/prisma-client-mock";

const enqueueMock = mock(async () => ({ status: "created" }));

mock.module("@/job/job-boundary", () => ({
  serverJobProducer: {
    enqueue: enqueueMock,
  },
}));

installPrismaClientMock();

describe("UserUnitCollectionService", () => {
  test("gets caller-scoped collection metadata", async () => {
    const findUnique = mock(async () => null);
    Object.assign(prismaMock, {
      userUnitCollection: { findUnique },
    });

    const { UserUnitCollectionService } = await import("./service");
    await new UserUnitCollectionService().get("user-1", "unit-1");

    expect(findUnique).toHaveBeenCalledWith({
      where: { userId_unitId: { userId: "user-1", unitId: "unit-1" } },
    });
  });

  test("patches shared metadata and syncs search text", async () => {
    enqueueMock.mockClear();
    const upsert = mock(async () => ({}));
    const deleteMany = mock(async () => ({ count: 0 }));
    const createMany = mock(async () => ({ count: 1 }));
    const findUnique = mock(async () => ({
      userId: "user-1",
      unitId: "unit-1",
      searchText: "keeper note",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    }));
    const transaction = mock(async (fn: any) =>
      fn({
        userUnitCollection: { upsert },
        userTagApplication: { deleteMany, createMany },
      }),
    );
    Object.assign(prismaMock, {
      $transaction: transaction,
      userUnitCollection: { findUnique },
    });

    const { UserUnitCollectionService } = await import("./service");
    const result = await new UserUnitCollectionService().patch("user-1", {
      unitId: "unit-1",
      searchText: "keeper note",
      tagUnitIds: ["tag-1"],
    });

    expect(upsert).toHaveBeenCalledWith({
      where: { userId_unitId: { userId: "user-1", unitId: "unit-1" } },
      create: {
        userId: "user-1",
        unitId: "unit-1",
        searchText: "keeper note",
      },
      update: { searchText: "keeper note" },
    });
    expect(createMany).toHaveBeenCalledWith({
      data: [
        {
          userId: "user-1",
          unitId: "unit-1",
          tagUnitId: "tag-1",
          position: "00000000",
        },
      ],
      skipDuplicates: true,
    });
    expect(enqueueMock).toHaveBeenCalledTimes(1);
    expect(result?.searchText).toBe("keeper note");
  });
});
