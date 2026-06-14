import { describe, expect, mock, test } from "bun:test";
import type {
  UserShelfItemRepository,
  UserShelfItemService,
} from "./user-shelf-item.service";

const enqueueMock = mock(async () => ({ status: "created" }));
type SearchHit = { id?: string; itemId?: string; unitId?: string };

const contentSearchMock = mock(
  async (_query: string, _options?: any): Promise<{ hits: SearchHit[] }> => ({
    hits: [],
  }),
);
const shelfItemSearchMock = mock(
  async (_query: string, _options?: any): Promise<{ hits: SearchHit[] }> => ({
    hits: [],
  }),
);

mock.module("@/job/job-boundary", () => ({
  serverJobProducer: {
    enqueue: enqueueMock,
  },
}));
mock.module("../meili/search-client", () => ({
  searchClient: {
    contentIndex: { search: contentSearchMock },
    shelfItemIndex: { search: shelfItemSearchMock },
  },
}));

function createRepository(
  overrides: Partial<UserShelfItemRepository> = {},
): UserShelfItemRepository {
  return {
    get: mock(async () => null),
    patchMetadata: mock(async () => {}),
    listTagApplicationsByTags: mock(async () => []),
    listShelfItems: mock(async () => []),
    listMetadataRows: mock(async () => []),
    listTagRows: mock(async () => []),
    ...overrides,
  };
}

async function createService(
  repository: UserShelfItemRepository,
): Promise<UserShelfItemService> {
  const { UserShelfItemService } = await import("./user-shelf-item.service");
  return new UserShelfItemService(repository);
}

describe("UserShelfItemService", () => {
  test("gets caller-scoped shelf item metadata", async () => {
    const get = mock(async () => null);
    const repository = createRepository({ get });

    await (await createService(repository)).get("user-1", "unit-1");

    expect(get).toHaveBeenCalledWith("user-1", "unit-1");
  });

  test("patches shared metadata and syncs search text", async () => {
    enqueueMock.mockClear();
    const row = {
      userId: "user-1",
      unitId: "unit-1",
      searchText: "keeper note",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    const patchMetadata = mock(async () => {});
    const get = mock(async () => row);
    const repository = createRepository({ patchMetadata, get });

    const result = await (await createService(repository)).patch("user-1", {
      unitId: "unit-1",
      searchText: "keeper note",
      tagUnitIds: ["tag-1"],
    });

    expect(patchMetadata).toHaveBeenCalledWith("user-1", {
      unitId: "unit-1",
      searchText: "keeper note",
      tagUnitIds: ["tag-1"],
    });
    expect(enqueueMock).toHaveBeenCalledTimes(1);
    expect(result?.searchText).toBe("keeper note");
  });

  test("searches my shelf items with content and private shelf item hits", async () => {
    contentSearchMock.mockClear();
    shelfItemSearchMock.mockClear();
    contentSearchMock.mockResolvedValueOnce({ hits: [{ id: "unit-1" }] });
    shelfItemSearchMock.mockResolvedValueOnce({
      hits: [{ itemId: "unit-2" }],
    });

    const listShelfItems = mock(async () => [
      { shelfId: "shelf-a", unitId: "unit-1" },
      { shelfId: "shelf-b", unitId: "unit-1" },
      { shelfId: "shelf-a", unitId: "unit-2" },
    ]);
    const repository = createRepository({
      listShelfItems,
      listMetadataRows: mock(async () => [
        {
          userId: "user-1",
          unitId: "unit-2",
          searchText: "private alias",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-02T00:00:00.000Z"),
        },
      ]),
      listTagRows: mock(async () => [{ unitId: "unit-1", tagUnitId: "tag-1" }]),
    });

    const result = await (await createService(repository)).search(
      "user-1",
      { q: "space", limit: 10 },
      { viewerUserId: "user-1" },
    );

    expect(shelfItemSearchMock).toHaveBeenCalledWith("space", {
      limit: 1000,
      filter: 'shelfOwnerUserId = "user-1" AND itemType = "unit"',
      attributesToRetrieve: ["itemId"],
    });
    expect(listShelfItems).toHaveBeenCalledWith({
      ownerUserId: "user-1",
      unitIds: ["unit-1", "unit-2"],
      publicOnly: undefined,
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

  test("public shelf item search excludes private search text", async () => {
    contentSearchMock.mockClear();
    shelfItemSearchMock.mockClear();
    contentSearchMock.mockResolvedValueOnce({ hits: [{ id: "unit-1" }] });

    const listShelfItems = mock(async () => [
      { shelfId: "public-shelf", unitId: "unit-1" },
    ]);
    const repository = createRepository({
      listShelfItems,
      listMetadataRows: mock(async () => [
        {
          userId: "owner-1",
          unitId: "unit-1",
          searchText: "private alias",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-02T00:00:00.000Z"),
        },
      ]),
    });

    const result = await (await createService(repository)).search(
      "owner-1",
      { q: "public title" },
      { viewerUserId: "viewer-1", publicOnly: true },
    );

    expect(shelfItemSearchMock).not.toHaveBeenCalled();
    expect(listShelfItems).toHaveBeenCalledWith({
      ownerUserId: "owner-1",
      unitIds: ["unit-1"],
      publicOnly: true,
    });
    expect(result.units[0]?.searchText).toBeNull();
  });
});
