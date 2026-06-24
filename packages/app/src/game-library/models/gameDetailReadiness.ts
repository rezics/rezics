import {
  contentSearchQueryOptions,
  contentStructureQuery,
  gameSystemRequirementsByGameQueryOptions,
} from "@rezics/contract/api";

export const gameDetailTabs = [
  "overview",
  "content",
  "releases",
  "community",
  "metadata",
] as const;

export type GameDetailTab = (typeof gameDetailTabs)[number];

export const gameDetailHeroRegions = [
  "key-art",
  "release-metadata",
  "primary-actions",
  "domain-media",
] as const;

export const gameDetailDomainMediaPolicy = {
  heroRegion: "domain-media",
  sources: ["UnitExternalLink", "ContentDoc", "future-typed-media-asset"],
  excludedGameColumns: ["trailerUrl", "screenshotUrls", "carouselUrls"],
} as const;

export function gameDetailData(unitId: string) {
  return {
    releaseSearch: contentSearchQueryOptions({
      type: "GAME",
      catalogEntryKind: "VARIANT",
      targetUnitId: unitId,
      releasePresentation: "expanded",
      limit: 1,
    }),
    contentStructure: contentStructureQuery(unitId),
    systemRequirements: gameSystemRequirementsByGameQueryOptions(unitId),
  };
}
