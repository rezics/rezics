import { describe, expect, mock, test } from "bun:test";
import { installPrismaClientMock, prismaMock } from "@/test/prisma-client-mock";

const enqueueMock = mock(async () => ({ status: "created" }));
const contentSearchMock = mock(async (_query: string, _options?: any) => ({
  hits: [],
}));
const collectionSearchMock = mock(async (_query: string, _options?: any) => ({
  hits: [],
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

installPrismaClientMock();

describe("UserUnitCollectionService", () => {
  test("gets caller-scoped collection metadata", async () => {
    const findUnique = mock(async () => null);
    Object.assign(prismaMock, {
      userUnitCollection: { findUnique },
    });

    const { UserUnitCollectionService } = await import(
      "./user-unit-collection.service"
    );
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

    const { UserUnitCollectionService } = await import(
      "./user-unit-collection.service"
    );
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

  test("searches my collection with content and private collection index hits", async () => {
    contentSearchMock.mockClear();
    collectionSearchMock.mockClear();
    contentSearchMock.mockResolvedValueOnce({ hits: [{ id: "unit-1" }] });
    collectionSearchMock.mockResolvedValueOnce({
      hits: [{ unitId: "unit-2" }],
    });

    let shelfUnitWhere: any;
    Object.assign(prismaMock, {
      shelfUnit: {
        findMany: async (args: any) => {
          shelfUnitWhere = args.where;
          return [
            { shelfId: "shelf-a", unitId: "unit-1" },
            { shelfId: "shelf-b", unitId: "unit-1" },
            { shelfId: "shelf-a", unitId: "unit-2" },
          ];
        },
      },
      userUnitCollection: {
        findMany: async () => [
          {
            userId: "user-1",
            unitId: "unit-2",
            searchText: "private alias",
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-02T00:00:00.000Z"),
          },
        ],
      },
      userTagApplication: {
        findMany: async () => [{ unitId: "unit-1", tagUnitId: "tag-1" }],
      },
    });

    const { UserUnitCollectionService } = await import(
      "./user-unit-collection.service"
    );
    const result = await new UserUnitCollectionService().search(
      "user-1",
      { q: "space", limit: 10 },
      { viewerUserId: "user-1" },
    );

    expect(collectionSearchMock).toHaveBeenCalledWith("space", {
      limit: 1000,
      filter: 'ownerUserId = "user-1"',
      attributesToRetrieve: ["unitId"],
    });
    expect(shelfUnitWhere).toMatchObject({
      unitId: { in: ["unit-1", "unit-2"] },
      shelf: { unit: { userId: "user-1" } },
    });
    expect(result.units).toMatchObject([
      {
        unitId: "unit-1",
        shelfIds: ["shelf-a", "shelf-b"],
        tagUnitIds: ["tag-1"],
        searchText: null,
      },
      {
        unitId: "unit-2",
        shelfIds: ["shelf-a"],
        searchText: "private alias",
      },
    ]);
  });

  test("public collection search excludes private search text", async () => {
    contentSearchMock.mockClear();
    collectionSearchMock.mockClear();
    contentSearchMock.mockResolvedValueOnce({ hits: [{ id: "unit-1" }] });

    let shelfUnitWhere: any;
    Object.assign(prismaMock, {
      shelfUnit: {
        findMany: async (args: any) => {
          shelfUnitWhere = args.where;
          return [{ shelfId: "public-shelf", unitId: "unit-1" }];
        },
      },
      userUnitCollection: {
        findMany: async () => [
          {
            userId: "owner-1",
            unitId: "unit-1",
            searchText: "private alias",
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-02T00:00:00.000Z"),
          },
        ],
      },
      userTagApplication: { findMany: async () => [] },
    });

    const { UserUnitCollectionService } = await import(
      "./user-unit-collection.service"
    );
    const result = await new UserUnitCollectionService().search(
      "owner-1",
      { q: "public title" },
      { viewerUserId: "viewer-1", publicOnly: true },
    );

    expect(collectionSearchMock).not.toHaveBeenCalled();
    expect(shelfUnitWhere).toMatchObject({
      unitId: { in: ["unit-1"] },
      shelf: {
        unit: {
          userId: "owner-1",
          status: "PUBLISHED",
          visibility: "PUBLIC",
        },
      },
    });
    expect(result.units[0]?.searchText).toBeNull();
  });
});
