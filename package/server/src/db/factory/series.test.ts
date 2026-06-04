import { describe, expect, test } from "bun:test";
import { buildFactorySeriesVerificationPlan } from "./series";

describe("factory Series verification plan", () => {
  test("captures extension, direct release node, and index", () => {
    expect(
      buildFactorySeriesVerificationPlan({
        seriesUnitId: "series-1",
        kindKey: "book_series",
        releaseUnitId: "release-1",
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
    });
  });
});
