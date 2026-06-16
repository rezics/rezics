import { describe, expect, test } from "bun:test";
import {
  mediaDetailData,
  mediaDetailDomainMediaPolicy,
  mediaDetailHeroRegions,
  mediaDetailTabs,
} from "./mediaDetailReadiness";

describe("media detail readiness", () => {
  test("declares book-like hero and tab integration points", () => {
    expect(mediaDetailHeroRegions).toContain("domain-media");
    expect(mediaDetailTabs).toEqual([
      "overview",
      "content",
      "releases",
      "community",
      "metadata",
    ]);
  });

  test("wires data placeholders for release and content structure", () => {
    const data = mediaDetailData("media-1");

    expect(Array.from(data.releaseSearch.queryKey)).toEqual([
      "meili",
      "content",
      {
        type: "MEDIA",
        catalogEntryKind: "VARIANT",
        targetUnitId: "media-1",
        releasePresentation: "expanded",
        limit: 1,
      },
    ]);
    expect(Array.from(data.contentStructure.queryKey)).toEqual([
      "contentStructure",
      "detail",
      "media-1",
    ]);
  });

  test("keeps hero media as domain media instead of raw media columns", () => {
    expect(mediaDetailDomainMediaPolicy.sources).toContain("UnitExternalLink");
    expect(mediaDetailDomainMediaPolicy.excludedMediaColumns).toContain(
      "trailerUrl",
    );
  });
});
