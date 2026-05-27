import { describe, expect, test } from "bun:test";
import { buildFactorySeriesVerificationPlan } from "./series";

describe("factory Series verification plan", () => {
  test("captures extension, direct release node, index, representative release, and work projection", () => {
    expect(
      buildFactorySeriesVerificationPlan({
        seriesUnitId: "series-1",
        kindKey: "book_series",
        representativeReleaseUnitId: "release-1",
        workUnitId: "work-1",
        contentNodeId: "node-1",
      }),
    ).toEqual({
      seriesExtension: {
        unitId: "series-1",
        kindKey: "book_series",
      },
      directReleaseNode: {
        ownerUnitId: "series-1",
        contentUnitId: "release-1",
        id: "node-1",
      },
      directIndexRow: {
        seriesUnitId: "series-1",
        releaseUnitId: "release-1",
        contentNodeId: "node-1",
      },
      representativeRelease: {
        releaseUnitId: "release-1",
        workUnitId: "work-1",
      },
      workProjection: {
        unitId: "series-1",
        workUnitId: "work-1",
        role: "SERIES",
      },
    });
  });
});
