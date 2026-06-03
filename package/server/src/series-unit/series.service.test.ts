import { beforeEach, describe, expect, mock, test } from "bun:test";
import { installPrismaClientMock, prismaMock } from "@/test/prisma-client-mock";

installPrismaClientMock();

const enqueueMock = mock(async (_command: any) => ({ status: "created" }));
const contentStructureUpdateMock = mock(
  async (_ownerId: string, _nodes: any[], options: any) => {
    await options.afterMutate?.(txMock, {
      ownerUnitId: "series-1",
      submitted: _nodes,
    });
    return {
      ownerUnitId: "series-1",
      nodes: _nodes,
      createdAt: new Date("2026-05-27T00:00:00.000Z"),
      updatedAt: new Date("2026-05-27T00:00:00.000Z"),
    };
  },
);

mock.module("@/job/job-boundary", () => ({
  serverJobProducer: {
    enqueue: enqueueMock,
  },
}));

mock.module("@/infra/slug-scopes", () => ({
  pickSlugScope: () => "entity-scope",
}));

mock.module("@/content-structure", () => ({
  contentStructureService: {
    ensureForOwner: mock(async () => undefined),
    getByOwnerUnitId: mock(async () => ({
      ownerUnitId: "series-1",
      nodes: [],
      createdAt: new Date("2026-05-27T00:00:00.000Z"),
      updatedAt: new Date("2026-05-27T00:00:00.000Z"),
    })),
    update: contentStructureUpdateMock,
  },
}));

const seriesFindUniqueMock = mock(async () => ({ unitId: "series-1" }));
const unitFindManyMock = mock(async () => [
  {
    id: "release-1",
    type: "BOOK",
  },
  {
    id: "nested-series-1",
    type: "SERIES",
  },
]);
const contentNodeFindManyMock = mock(async (_args: any) => [
  {
    id: "node-release-1",
    contentUnitId: "release-1",
  },
]);
const seriesContentIndexDeleteManyMock = mock(async () => ({ count: 0 }));
const seriesContentIndexCreateManyMock = mock(async () => ({ count: 1 }));

const txMock = {
  series: {
    findUnique: seriesFindUniqueMock,
  },
  unit: {
    findMany: unitFindManyMock,
  },
  contentStructureNode: {
    findMany: contentNodeFindManyMock,
  },
  seriesContentIndex: {
    deleteMany: seriesContentIndexDeleteManyMock,
    createMany: seriesContentIndexCreateManyMock,
  },
};

Object.assign(prismaMock, {
  $transaction: async (fn: any) => fn(txMock),
  contentStructureNode: {
    findMany: mock(async () => []),
  },
  seriesContentIndex: {
    findMany: mock(async () => []),
  },
});

const { SeriesService } = await import("./series.service");

describe("SeriesService", () => {
  const service = new SeriesService();

  beforeEach(() => {
    enqueueMock.mockClear();
    contentStructureUpdateMock.mockClear();
    seriesFindUniqueMock.mockClear();
    unitFindManyMock.mockClear();
    unitFindManyMock.mockImplementation(async () => [
      {
        id: "release-1",
        type: "BOOK",
      },
      {
        id: "nested-series-1",
        type: "SERIES",
      },
    ]);
    contentNodeFindManyMock.mockClear();
    seriesContentIndexDeleteManyMock.mockClear();
    seriesContentIndexCreateManyMock.mockClear();
  });

  test("reconciles direct release index from release nodes only", async () => {
    await service.reconcileSeriesProjections(txMock as any, "series-1");

    const findManyArgs = contentNodeFindManyMock.mock.calls[0]?.[0] as any;
    expect(findManyArgs).toMatchObject({
      where: {
        ownerUnitId: "series-1",
        contentUnit: {
          type: { in: ["BOOK", "GAME", "MEDIA"] },
        },
      },
    });
    expect(seriesContentIndexCreateManyMock).toHaveBeenCalledWith({
      data: [
        {
          seriesUnitId: "series-1",
          releaseUnitId: "release-1",
          contentNodeId: "node-release-1",
        },
      ],
      skipDuplicates: true,
    });
  });

  test("allows nested Series references without expanding their child releases", async () => {
    await service.updateContentStructure(
      "series-1",
      [
        {
          title: "Nested",
          contentUnitId: "nested-series-1",
        },
      ],
      "editor-1",
    );

    expect(contentStructureUpdateMock).toHaveBeenCalledWith(
      "series-1",
      expect.any(Array),
      expect.objectContaining({
        eventType: "series.contentStructure.batch",
        changedFieldKeys: ["series.contentStructure"],
      }),
    );
    expect(contentNodeFindManyMock).toHaveBeenCalledTimes(1);
  });

  test("allows native release Units as direct Series content nodes", async () => {
    unitFindManyMock.mockImplementationOnce(async () => [
      {
        id: "release-2",
        type: "BOOK",
      },
    ]);

    await expect(
      service.updateContentStructure(
        "series-1",
        [{ title: "Release", contentUnitId: "release-2" }],
        "editor-1",
      ),
    ).resolves.toBeDefined();
  });

  test("rejects unsupported direct Series content nodes", async () => {
    unitFindManyMock.mockImplementationOnce(async () => [
      {
        id: "post-1",
        type: "POST",
      },
    ]);

    await expect(
      service.updateContentStructure(
        "series-1",
        [{ title: "Post", contentUnitId: "post-1" }],
        "editor-1",
      ),
    ).rejects.toThrow(/release Units or nested Series/);
  });

  test("reports nested Series and weak release diagnostics", async () => {
    Object.assign(prismaMock, {
      contentStructureNode: {
        findMany: mock(async () => [
          { contentUnitId: "nested-series-1" },
          { contentUnitId: "nested-series-1" },
        ]),
      },
      seriesContentIndex: {
        findMany: mock(async () => [
          {
            releaseUnitId: "release-1",
            releaseUnit: {
              translations: [],
              externalRefs: [],
            },
          },
        ]),
      },
    });

    const diagnostics = await service.diagnostics("series-1");

    expect(diagnostics).toEqual({
      seriesUnitId: "series-1",
      nestedSeriesReferenceUnitIds: ["nested-series-1"],
      weakDisplayReleaseUnitIds: ["release-1"],
      missingTranslationReleaseUnitIds: ["release-1"],
      missingSourceReleaseUnitIds: ["release-1"],
    });
  });
});
