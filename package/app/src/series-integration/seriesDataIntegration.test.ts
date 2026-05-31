import { describe, expect, test } from "bun:test";
import {
  releaseSeriesAddData,
  releaseWorkSeriesAddData,
  seriesManagementData,
  workAbstractData,
} from "./seriesDataIntegration";

describe("Series frontend data integration placeholders", () => {
  test("provides Series management query placeholders", () => {
    const data = seriesManagementData("series-1");
    expect(data.detail.queryKey).toEqual(["series", "detail", "series-1"]);
    expect(data.contentIndex.queryKey).toEqual([
      "series",
      "detail",
      "series-1",
      "contentIndex",
    ]);
    expect(data.diagnostics.queryKey).toEqual([
      "series",
      "detail",
      "series-1",
      "diagnostics",
    ]);
  });

  test("provides Work abstract placeholders without slug scope", () => {
    expect(workAbstractData("work-1").releaseListScope).toEqual({
      workUnitId: "work-1",
    });
  });

  test("provides release and work-level Series add placeholders", () => {
    expect(releaseSeriesAddData("release-1").containingSeries.queryKey).toEqual(
      ["series", "list", { containsReleaseUnitId: "release-1", limit: 50 }],
    );
    expect(
      releaseWorkSeriesAddData("release-1", "work-1").representativeRelease
        .queryKey,
    ).toEqual([
      "series",
      "representativeReleaseSuggestions",
      "work-1",
      "release-1",
    ]);
  });
});
