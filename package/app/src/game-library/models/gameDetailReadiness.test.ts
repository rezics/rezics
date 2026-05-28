import { describe, expect, test } from "bun:test";
import {
  gameDetailData,
  gameDetailDomainMediaPolicy,
  gameDetailHeroRegions,
  gameDetailTabs,
} from "./gameDetailReadiness";

describe("game detail readiness", () => {
  test("declares book-like hero and tab integration points", () => {
    expect(gameDetailHeroRegions).toContain("domain-media");
    expect(gameDetailTabs).toEqual([
      "overview",
      "content",
      "releases",
      "community",
      "metadata",
    ]);
  });

  test("wires data placeholders for release, content, and requirements", () => {
    const data = gameDetailData("game-1");

    expect(Array.from(data.releaseSearch.queryKey)).toEqual([
      "meili",
      "content",
      {
        type: "GAME",
        searchGroupId: "game-1",
        releasePresentation: "expanded",
        limit: 1,
      },
    ]);
    expect(Array.from(data.contentStructure.queryKey)).toEqual([
      "contentStructure",
      "detail",
      "game-1",
    ]);
    expect(Array.from(data.systemRequirements.queryKey)).toEqual([
      "game-system-requirement",
      "list",
      "game",
      "game-1",
      undefined,
    ]);
  });

  test("keeps hero media as domain media instead of raw game columns", () => {
    expect(gameDetailDomainMediaPolicy.sources).toContain("UnitExternalRef");
    expect(gameDetailDomainMediaPolicy.excludedGameColumns).toContain(
      "trailerUrl",
    );
  });
});
