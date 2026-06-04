import { describe, expect, mock, test } from "bun:test";
import type {
  UserUnitCollectionRepository,
  UserUnitCollectionService,
} from "./user-unit-collection.service";

const enqueueMock = mock(async () => ({ status: "created" }));
type SearchHit = { id?: string; unitId?: string };

const contentSearchMock = mock(
  async (_query: string, _options?: any): Promise<{ hits: SearchHit[] }> => ({
    hits: [],
  }),
);
const collectionSearchMock = mock(
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
    collectionIndex: { search: collectionSearchMock },
  },
}));

function createRepository(
  overrides: Partial<UserUnitCollectionRepository> = {},
): UserUnitCollectionRepository {
  return {
    get: mock(async () => null),
    patchMetadata: mock(async () => {}),
    listTagApplicationsByTags: mock(async () => []),
    listShelfUnits: mock(async () => []),
    listMetadataRows: mock(async () => []),
    listTagRows: mock(async () => []),
    ...overrides,
  };
}

async function createService(
  repository: UserUnitCollectionRepository,
): Promise<UserUnitCollectionService> {
  const { UserUnitCollectionService } = await import(
    "./user-unit-collection.service"
  );
  return new UserUnitCollectionService(repository);
}

describe("UserUnitCollectionService", () => {
  test("gets caller-scoped collection metadata", async () => {
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

  test("searches my collection with content and private collection index hits", async () => {
    contentSearchMock.mockClear();
    collectionSearchMock.mockClear();
    contentSearchMock.mockResolvedValueOnce({ hits: [{ id: "unit-1" }] });
    collectionSearchMock.mockResolvedValueOnce({
      hits: [{ unitId: "unit-2" }],
    });

    const listShelfUnits = mock(async () => [
      { shelfId: "shelf-a", unitId: "unit-1" },
      { shelfId: "shelf-b", unitId: "unit-1" },
      { shelfId: "shelf-a", unitId: "unit-2" },
    ]);
    const repository = createRepository({
      listShelfUnits,
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

    expect(collectionSearchMock).toHaveBeenCalledWith("space", {
      limit: 1000,
      filter: 'ownerUserId = "user-1"',
      attributesToRetrieve: ["unitId"],
    });
    expect(listShelfUnits).toHaveBeenCalledWith({
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

  test("public collection search excludes private search text", async () => {
    contentSearchMock.mockClear();
    collectionSearchMock.mockClear();
    contentSearchMock.mockResolvedValueOnce({ hits: [{ id: "unit-1" }] });

    const listShelfUnits = mock(async () => [
      { shelfId: "public-shelf", unitId: "unit-1" },
    ]);
    const repository = createRepository({
      listShelfUnits,
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

    expect(collectionSearchMock).not.toHaveBeenCalled();
    expect(listShelfUnits).toHaveBeenCalledWith({
      ownerUserId: "owner-1",
      unitIds: ["unit-1"],
      publicOnly: true,
    });
    expect(result.units[0]?.searchText).toBeNull();
  });
});
