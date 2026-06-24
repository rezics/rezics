import { describe, expect, test } from "bun:test";
import {
  releaseSeriesAddData,
  seriesManagementData,
} from "./seriesDataIntegration";

describe("Series frontend data integration placeholders", () => {
  test("provides Series management query placeholders", () => {
    const data = seriesManagementData("series-1");
    expect([...data.detail.queryKey]).toEqual(["series", "detail", "series-1"]);
    expect([...data.contentIndex.queryKey]).toEqual([
      "series",
      "detail",
      "series-1",
      "contentIndex",
    ]);
    expect([...data.diagnostics.queryKey]).toEqual([
      "series",
      "detail",
      "series-1",
      "diagnostics",
    ]);
  });

  test("provides release-level Series add placeholders", () => {
    expect([
      ...releaseSeriesAddData("release-1").containingSeries.queryKey,
    ]).toEqual([
      "series",
      "list",
      { containsReleaseUnitId: "release-1", limit: 50 },
    ]);
  });
});
