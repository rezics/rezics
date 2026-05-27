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
    workMemberships: [{ workUnitId: "work-1" }],
  },
  {
    id: "nested-series-1",
    type: "SERIES",
    workMemberships: [],
  },
]);
const contentNodeFindManyMock = mock(async () => [
  {
    id: "node-release-1",
    contentUnitId: "release-1",
    contentUnit: {
      workMemberships: [{ workUnitId: "work-1" }],
    },
  },
]);
const seriesContentIndexDeleteManyMock = mock(async () => ({ count: 0 }));
const seriesContentIndexCreateManyMock = mock(async () => ({ count: 1 }));
const unitWorkDeleteManyMock = mock(async () => ({ count: 0 }));
const unitWorkUpsertMock = mock(async () => ({}));

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
  unitWork: {
    deleteMany: unitWorkDeleteManyMock,
    upsert: unitWorkUpsertMock,
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
  unitWork: {
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
        workMemberships: [{ workUnitId: "work-1" }],
      },
      {
        id: "nested-series-1",
        type: "SERIES",
        workMemberships: [],
      },
    ]);
    contentNodeFindManyMock.mockClear();
    seriesContentIndexDeleteManyMock.mockClear();
    seriesContentIndexCreateManyMock.mockClear();
    unitWorkDeleteManyMock.mockClear();
    unitWorkUpsertMock.mockClear();
  });

  test("reconciles direct release index and SERIES work projection from release nodes only", async () => {
    await service.reconcileSeriesProjections(txMock as any, "series-1");

    expect(contentNodeFindManyMock.mock.calls[0]?.[0]).toMatchObject({
      where: {
        ownerUnitId: "series-1",
        contentUnit: {
          type: { in: ["BOOK", "GAME", "MEDIA"] },
          workMemberships: { some: { role: "RELEASE" } },
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
    expect(unitWorkUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          unitId_workUnitId_role: {
            unitId: "series-1",
            workUnitId: "work-1",
            role: "SERIES",
          },
        },
      }),
    );
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

  test("rejects hidden Work Units as direct Series content nodes", async () => {
    unitFindManyMock.mockImplementationOnce(async () => [
      {
        id: "work-1",
        type: "BOOK",
        workMemberships: [],
      },
    ]);

    await expect(
      service.updateContentStructure(
        "series-1",
        [{ title: "Work", contentUnitId: "work-1" }],
        "editor-1",
      ),
    ).rejects.toThrow(/release Units or nested Series/);
  });

  test("explains representative release candidates with explicit selection preference", async () => {
    const findMany = mock(async () => [
      {
        unitId: "release-2",
        workUnitId: "work-1",
        displayPolicy: "PRIMARY",
        createdAt: new Date("2026-05-27T00:00:00.000Z"),
        unit: {
          translations: [{ language: "en", title: "Release 2" }],
          externalRefs: [],
        },
      },
      {
        unitId: "release-1",
        workUnitId: "work-1",
        displayPolicy: "SECONDARY",
        createdAt: new Date("2026-05-27T00:00:00.000Z"),
        unit: {
          translations: [{ language: "en", title: "Release 1" }],
          externalRefs: [{ id: "ref-1" }],
        },
      },
    ]);
    Object.assign(prismaMock, {
      unitWork: { findMany },
    });

    const selection = await service.explainRepresentativeRelease(
      "work-1",
      "release-1",
    );

    expect(selection.selectedReleaseUnitId).toBe("release-1");
    expect(selection.reason).toBe("explicit_selection");
    expect(
      selection.candidates.map((candidate) => candidate.releaseUnitId),
    ).toEqual(["release-2", "release-1"]);
  });

  test("reports nested Series and weak representative-release diagnostics", async () => {
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
              workMemberships: [
                { workUnitId: "work-1", displayPolicy: "SECONDARY" },
              ],
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
      betterRepresentativeCandidateWorkUnitIds: ["work-1"],
    });
  });
});
