import { describe, expect, test } from "bun:test";
import {
  gameDetailData,
  gameDetailDomainMediaPolicy,
  gameDetailHeroRegions,
  gameDetailTabs,
  mediaDetailData,
  mediaDetailDomainMediaPolicy,
  mediaDetailHeroRegions,
  mediaDetailTabs,
} from "./detailReadiness";

describe("domain detail readiness descriptors", () => {
  test("declares game detail hero and tab integration points", () => {
    expect(gameDetailHeroRegions).toContain("domain-media");
    expect(gameDetailTabs).toEqual([
      "overview",
      "content",
      "releases",
      "community",
      "metadata",
    ]);
  });

  test("describes game detail data as Eden/SWR requests", () => {
    const data = gameDetailData("game-1");

    expect(data.releaseSearch).toEqual({
      method: "POST",
      path: "/meili/content/search",
      body: {
        type: "GAME",
        catalogEntryKind: "VARIANT",
        targetUnitId: "game-1",
        releasePresentation: "expanded",
        limit: 1,
      },
      swrKey: [
        "eden",
        "POST",
        "/meili/content/search",
        {
          type: "GAME",
          catalogEntryKind: "VARIANT",
          targetUnitId: "game-1",
          releasePresentation: "expanded",
          limit: 1,
        },
      ],
    });
    expect(data.contentStructure).toEqual({
      method: "GET",
      path: "/content-structure/:ownerUnitId",
      params: { ownerUnitId: "game-1" },
      swrKey: ["eden", "GET", "/content-structure/:ownerUnitId", "game-1"],
    });
    expect(data.systemRequirements).toEqual({
      method: "GET",
      path: "/game-system-requirement",
      query: { gameUnitId: "game-1" },
      swrKey: [
        "eden",
        "GET",
        "/game-system-requirement",
        { gameUnitId: "game-1" },
      ],
    });
  });

  test("keeps game hero media as domain media instead of raw game columns", () => {
    expect(gameDetailDomainMediaPolicy.sources).toContain("UnitExternalLink");
    expect(gameDetailDomainMediaPolicy.excludedGameColumns).toContain(
      "trailerUrl",
    );
  });

  test("declares media detail hero and tab integration points", () => {
    expect(mediaDetailHeroRegions).toContain("domain-media");
    expect(mediaDetailTabs).toEqual([
      "overview",
      "content",
      "releases",
      "community",
      "metadata",
    ]);
  });

  test("describes media detail data as Eden/SWR requests", () => {
    const data = mediaDetailData("media-1");

    expect(data.releaseSearch).toEqual({
      method: "POST",
      path: "/meili/content/search",
      body: {
        type: "MEDIA",
        catalogEntryKind: "VARIANT",
        targetUnitId: "media-1",
        releasePresentation: "expanded",
        limit: 1,
      },
      swrKey: [
        "eden",
        "POST",
        "/meili/content/search",
        {
          type: "MEDIA",
          catalogEntryKind: "VARIANT",
          targetUnitId: "media-1",
          releasePresentation: "expanded",
          limit: 1,
        },
      ],
    });
    expect(data.contentStructure).toEqual({
      method: "GET",
      path: "/content-structure/:ownerUnitId",
      params: { ownerUnitId: "media-1" },
      swrKey: ["eden", "GET", "/content-structure/:ownerUnitId", "media-1"],
    });
  });

  test("keeps media hero media as domain media instead of raw media columns", () => {
    expect(mediaDetailDomainMediaPolicy.sources).toContain("UnitExternalLink");
    expect(mediaDetailDomainMediaPolicy.excludedMediaColumns).toContain(
      "trailerUrl",
    );
  });
});
