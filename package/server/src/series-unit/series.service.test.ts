import type {
  ContentStructureItem,
  SeriesDiagnosticsDTO,
} from "@rezics/contract";
import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { SeriesRepository } from "./series.service";

const enqueueMock = mock(async (_command: unknown) => ({ status: "created" }));
const txMock = { source: "content-structure" };
const contentStructureUpdateMock = mock(
  async (_ownerId: string, nodes: ContentStructureItem[], options: any) => {
    await options.afterMutate?.(txMock, {
      ownerUnitId: "series-1",
      submitted: nodes,
    });
    return {
      ownerUnitId: "series-1",
      nodes,
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

mock.module("@/content-structure", () => ({
  contentStructureService: {
    getByOwnerUnitId: mock(async () => ({
      ownerUnitId: "series-1",
      nodes: [],
      createdAt: new Date("2026-05-27T00:00:00.000Z"),
      updatedAt: new Date("2026-05-27T00:00:00.000Z"),
    })),
    update: contentStructureUpdateMock,
  },
}));

const { SeriesService } = await import("./series.service");

function createRepository(
  overrides: Partial<SeriesRepository> = {},
): SeriesRepository {
  return {
    list: mock(async () => ({ series: [], total: 0 })),
    getByUnitId: mock(async () => {
      throw new Error("unused");
    }),
    create: mock(async () => {
      throw new Error("unused");
    }),
    update: mock(async () => {
      throw new Error("unused");
    }),
    assertSeriesUnit: mock(async () => undefined),
    assertValidSeriesContentNodes: mock(async () => undefined),
    listContentIndex: mock(async () => []),
    diagnostics: mock(async () => ({
      seriesUnitId: "series-1",
      nestedSeriesReferenceUnitIds: [],
      weakDisplayReleaseUnitIds: [],
      missingTranslationReleaseUnitIds: [],
      missingSourceReleaseUnitIds: [],
    })),
    reconcileSeriesProjections: mock(async () => ["release-1"]),
    ...overrides,
  };
}

describe("SeriesService", () => {
  beforeEach(() => {
    enqueueMock.mockClear();
    contentStructureUpdateMock.mockClear();
  });

  test("reconciles direct release index through the repository", async () => {
    const repository = createRepository();
    const service = new SeriesService(repository);

    await service.reconcileSeriesProjections(txMock, "series-1");

    expect(repository.reconcileSeriesProjections).toHaveBeenCalledWith(
      txMock,
      "series-1",
    );
    expect(enqueueMock).toHaveBeenCalledTimes(1);
  });

  test("allows nested Series references without expanding their child releases", async () => {
    const repository = createRepository();
    const service = new SeriesService(repository);
    const nodes = [
      {
        title: "Nested",
        contentUnitId: "nested-series-1",
      },
    ];

    await service.updateContentStructure("series-1", nodes, "editor-1");

    expect(repository.assertSeriesUnit).toHaveBeenCalledWith("series-1");
    expect(repository.assertValidSeriesContentNodes).toHaveBeenCalledWith(
      nodes,
    );
    expect(contentStructureUpdateMock).toHaveBeenCalledWith(
      "series-1",
      nodes,
      expect.objectContaining({
        actorUserId: "editor-1",
        eventType: "series.contentStructure.batch",
        changedFieldKeys: ["series.contentStructure"],
      }),
    );
    expect(repository.reconcileSeriesProjections).toHaveBeenCalledWith(
      txMock,
      "series-1",
    );
  });

  test("allows native release Units as direct Series content nodes", async () => {
    const repository = createRepository();
    const service = new SeriesService(repository);
    const nodes = [{ title: "Release", contentUnitId: "release-2" }];

    await expect(
      service.updateContentStructure("series-1", nodes, "editor-1"),
    ).resolves.toBeDefined();
  });

  test("rejects unsupported direct Series content nodes", async () => {
    const repository = createRepository({
      assertValidSeriesContentNodes: mock(async () => {
        throw new Error(
          "Series content nodes must reference release Units or nested Series references",
        );
      }),
    });
    const service = new SeriesService(repository);

    await expect(
      service.updateContentStructure(
        "series-1",
        [{ title: "Post", contentUnitId: "post-1" }],
        "editor-1",
      ),
    ).rejects.toThrow(/release Units or nested Series/);
    expect(contentStructureUpdateMock).not.toHaveBeenCalled();
  });

  test("reports nested Series and weak release diagnostics", async () => {
    const diagnostics: SeriesDiagnosticsDTO = {
      seriesUnitId: "series-1",
      nestedSeriesReferenceUnitIds: ["nested-series-1"],
      weakDisplayReleaseUnitIds: ["release-1"],
      missingTranslationReleaseUnitIds: ["release-1"],
      missingSourceReleaseUnitIds: ["release-1"],
    };
    const service = new SeriesService(
      createRepository({
        diagnostics: mock(async () => diagnostics),
      }),
    );

    await expect(service.diagnostics("series-1")).resolves.toEqual(diagnostics);
  });
});
